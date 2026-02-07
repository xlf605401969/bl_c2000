#include <string.h>
#include "bl_cm_ipc.h"
#include "driverlib_cm.h"
#include "cm.h"
#include "F021_F2838x_CM.h"
#include "ipc.h"
#include "bootloader/bl_flash_8bit.h"

#define BL_FLASH_CM_CMD_BUFFER_ADDR  0x20080000
#define BL_FLASH_CM_RESP_BUFFER_ADDR 0x20082000

static bl_flash_cm_ipc_t *bl_flash_cm_cmd_buffer = (bl_flash_cm_ipc_t *)BL_FLASH_CM_CMD_BUFFER_ADDR;
static bl_flash_cm_ipc_t *bl_flash_cm_resp_buffer = (bl_flash_cm_ipc_t *)BL_FLASH_CM_RESP_BUFFER_ADDR;

static bool bl_flash_cm_ipc_initialized = false;

void bl_flash_cm_ipc_init(void)
{
    if (bl_flash_cm_ipc_initialized) {
        return;
    }

    //memset(bl_flash_cm_cmd_buffer, 0, sizeof(bl_flash_cm_ipc_t));
    memset(bl_flash_cm_resp_buffer, 0, sizeof(bl_flash_cm_ipc_t));

    int32_t result = bl_flash_init();
    if (result != 0) {
        // Flash初始化失败，不设置initialized标志
        return;
    }

    bl_flash_cm_ipc_initialized = true;
}

void bl_flash_cm_ipc_process_cmd(void)
{
    if (!bl_flash_cm_ipc_initialized) {
        bl_flash_cm_resp_buffer->cmd = 0xFFFFFFFF;
        IPC_ackFlagRtoL(IPC_CM_L_CPU1_R, IPC_FLAG0);
        return;
    }

    uint32_t cmd = bl_flash_cm_cmd_buffer->cmd;
    uint32_t addr = bl_flash_cm_cmd_buffer->addr;
    uint32_t size = bl_flash_cm_cmd_buffer->size;
    uint16_t *cmd_data_ptr = (uint16_t *)&bl_flash_cm_cmd_buffer->data_start;
    uint16_t *resp_data_ptr = (uint16_t *)&bl_flash_cm_resp_buffer->data_start;

    switch (cmd) {
        case BL_FLASH_CM_CMD_READ: {
            // 直接读到响应缓冲区，避免额外拷贝
            int32_t result = bl_flash_read(addr, resp_data_ptr, size);
            bl_flash_cm_resp_buffer->cmd = (result == 0) ? BL_FLASH_CM_CMD_READ : 0xFFFFFFFF;
            bl_flash_cm_resp_buffer->addr = addr;
            bl_flash_cm_resp_buffer->size = size;
            break;
        }

        case BL_FLASH_CM_CMD_ERASE: {
            uint32_t actual_addr = 0;
            uint32_t actual_size = 0;
            int32_t result = bl_flash_erase_range(addr, size, &actual_addr, &actual_size);
            bl_flash_cm_resp_buffer->cmd = (result == 0) ? BL_FLASH_CM_CMD_ERASE : 0xFFFFFFFF;
            bl_flash_cm_resp_buffer->addr = actual_addr;
            bl_flash_cm_resp_buffer->size = actual_size;
            break;
        }

        case BL_FLASH_CM_CMD_WRITE: {
            int32_t result = bl_flash_write(addr, cmd_data_ptr, size);
            bl_flash_cm_resp_buffer->cmd = (result == 0) ? BL_FLASH_CM_CMD_WRITE : 0xFFFFFFFF;
            bl_flash_cm_resp_buffer->addr = addr;
            bl_flash_cm_resp_buffer->size = size;
            break;
        }

        case BL_FLASH_CM_CMD_FLUSH: {
            int32_t result = bl_flash_cache_flush();
            bl_flash_cm_resp_buffer->cmd = (result == 0) ? BL_FLASH_CM_CMD_FLUSH : 0xFFFFFFFF;
            bl_flash_cm_resp_buffer->addr = 0;
            bl_flash_cm_resp_buffer->size = 0;
            break;
        }

        case BL_FLASH_CM_CMD_GET_SIZE: {
            uint32_t total_size = bl_flash_get_size();
            bl_flash_cm_resp_buffer->cmd = BL_FLASH_CM_CMD_GET_SIZE;
            bl_flash_cm_resp_buffer->addr = 0;
            bl_flash_cm_resp_buffer->size = total_size;
            break;
        }

        case BL_FLASH_CM_CMD_ADDR_TO_SECTOR: {
            uint8_t sector = bl_flash_addr_to_sector(addr);
            bl_flash_cm_resp_buffer->cmd = BL_FLASH_CM_CMD_ADDR_TO_SECTOR;
            bl_flash_cm_resp_buffer->addr = sector;
            bl_flash_cm_resp_buffer->size = 0;
            break;
        }

        case BL_FLASH_CM_CMD_GET_SECTOR_START_ADDR: {
            uint32_t sector_addr = bl_flash_get_sector_start_addr((uint8_t)addr);
            bl_flash_cm_resp_buffer->cmd = BL_FLASH_CM_CMD_GET_SECTOR_START_ADDR;
            bl_flash_cm_resp_buffer->addr = 0;
            bl_flash_cm_resp_buffer->size = sector_addr;
            break;
        }

        default:
            bl_flash_cm_resp_buffer->cmd = 0xFFFFFFFF;
            bl_flash_cm_resp_buffer->addr = 0;
            bl_flash_cm_resp_buffer->size = 0;
            break;
    }

    IPC_ackFlagRtoL(IPC_CM_L_CPU1_R, IPC_FLAG0);
}
