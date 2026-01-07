#include <string.h>
#include "bl_cm_ipc.h"
#include "driverlib_cm.h"
#include "cm.h"
#include "F021_F2838x_CM.h"
#include "ipc.h"
#include "bootloader/bl_flash.h"

#define BL_FLASH_CM_CMD_BUFFER_ADDR  0x20080000
#define BL_FLASH_CM_RESP_BUFFER_ADDR 0x20082000

static bl_flash_cm_cmd_t *bl_flash_cm_cmd_buffer = (bl_flash_cm_cmd_t *)BL_FLASH_CM_CMD_BUFFER_ADDR;
static bl_flash_cm_resp_t *bl_flash_cm_resp_buffer = (bl_flash_cm_resp_t *)BL_FLASH_CM_RESP_BUFFER_ADDR;

static bool bl_flash_cm_ipc_initialized = false;

void bl_flash_cm_ipc_init(void)
{
    if (bl_flash_cm_ipc_initialized) {
        return;
    }

    memset(bl_flash_cm_cmd_buffer, 0, sizeof(bl_flash_cm_cmd_t));
    memset(bl_flash_cm_resp_buffer, 0, sizeof(bl_flash_cm_resp_t));

    Flash_initModule(FLASH0CTRL_BASE, FLASH0ECC_BASE, 2);
    Flash_claimPumpSemaphore(FLASH_CM_WRAPPER);

    Fapi_StatusType status = Fapi_initializeAPI(F021_CPU0_BASE_ADDRESS,
                                                CM_CLK_FREQ/1000000U);
    if (status != Fapi_Status_Success) {
        Fapi_initializeAPI(F021_CPU0_BASE_ADDRESS, CM_CLK_FREQ/1000000U);
    }

    status = Fapi_setActiveFlashBank(Fapi_FlashBank0);
    if (status != Fapi_Status_Success) {
        Fapi_initializeAPI(F021_CPU0_BASE_ADDRESS, CM_CLK_FREQ/1000000U);
    }

    bl_flash_cm_init();

    bl_flash_cm_ipc_initialized = true;
}

void bl_flash_cm_ipc_process_cmd(void)
{
    if (!bl_flash_cm_ipc_initialized) {
        bl_flash_cm_resp_buffer->result = -1;
        IPC_ackFlagRtoL(IPC_CM_L_CPU1_R, IPC_FLAG0);
        return;
    }

    uint32_t cmd = bl_flash_cm_cmd_buffer->cmd;
    uint32_t addr = bl_flash_cm_cmd_buffer->addr;
    uint32_t size = bl_flash_cm_cmd_buffer->size;

    switch (cmd) {
        case BL_FLASH_CM_CMD_READ:
            if (size > 0) {
                int32_t result = bl_flash_cm_read(addr, bl_flash_cm_resp_buffer->data, size);
                bl_flash_cm_resp_buffer->result = result;
                bl_flash_cm_resp_buffer->actual_addr = 0;
                bl_flash_cm_resp_buffer->actual_size = 0;
                bl_flash_cm_resp_buffer->written_size = 0;
            } else if (addr == 0) {
                uint32_t total_size = bl_flash_cm_get_size();
                bl_flash_cm_resp_buffer->result = 0;
                bl_flash_cm_resp_buffer->actual_addr = 0;
                bl_flash_cm_resp_buffer->actual_size = total_size;
                bl_flash_cm_resp_buffer->written_size = 0;
            } else {
                uint8_t sector = bl_flash_cm_addr_to_sector(addr);
                bl_flash_cm_resp_buffer->result = 0;
                bl_flash_cm_resp_buffer->actual_addr = sector;
                bl_flash_cm_resp_buffer->actual_size = 0;
                bl_flash_cm_resp_buffer->written_size = 0;
            }
            break;

        case BL_FLASH_CM_CMD_ERASE: {
            uint32_t actual_addr = 0;
            uint32_t actual_size = 0;
            int32_t result = bl_flash_cm_erase(addr, size, &actual_addr, &actual_size);
            bl_flash_cm_resp_buffer->result = result;
            bl_flash_cm_resp_buffer->actual_addr = actual_addr;
            bl_flash_cm_resp_buffer->actual_size = actual_size;
            bl_flash_cm_resp_buffer->written_size = 0;
            break;
        }

        case BL_FLASH_CM_CMD_WRITE: {
            int32_t result = bl_flash_cm_write(addr, bl_flash_cm_cmd_buffer->data, size);
            bl_flash_cm_resp_buffer->result = result;
            bl_flash_cm_resp_buffer->actual_addr = 0;
            bl_flash_cm_resp_buffer->actual_size = 0;
            bl_flash_cm_resp_buffer->written_size = size;
            break;
        }

        case BL_FLASH_CM_CMD_FLUSH: {
            int32_t result = bl_flash_cm_flush();
            bl_flash_cm_resp_buffer->result = result;
            bl_flash_cm_resp_buffer->actual_addr = 0;
            bl_flash_cm_resp_buffer->actual_size = 0;
            bl_flash_cm_resp_buffer->written_size = 0;
            break;
        }

        default:
            bl_flash_cm_resp_buffer->result = -1;
            bl_flash_cm_resp_buffer->actual_addr = 0;
            bl_flash_cm_resp_buffer->actual_size = 0;
            bl_flash_cm_resp_buffer->written_size = 0;
            break;
    }

    IPC_ackFlagRtoL(IPC_CM_L_CPU1_R, IPC_FLAG0);
}
