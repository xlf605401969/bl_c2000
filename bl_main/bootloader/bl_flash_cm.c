#include <string.h>
#include "bl_flash_cm.h"
#include "device/driverlib/ipc.h"

#pragma DATA_SECTION(bl_flash_cm_cmd_buffer, "MSGRAM_CPU1_TO_CM")
static bl_flash_cm_cmd_t bl_flash_cm_cmd_buffer;

#pragma DATA_SECTION(bl_flash_cm_data_buffer, "MSGRAM_CPU1_TO_CM")
static uint16_t bl_flash_cm_data_buffer[BL_FLASH_CM_DATA_BUFFER_SIZE];

#pragma DATA_SECTION(bl_flash_cm_resp_buffer, "MSGRAM_CM_TO_CPU1")
static bl_flash_cm_resp_t bl_flash_cm_resp_buffer;

static bool bl_flash_cm_initialized = false;

int bl_flash_cm_init(void)
{
    if (bl_flash_cm_initialized) {
        return BL_SUCCESS;
    }

    memset(&bl_flash_cm_cmd_buffer, 0, sizeof(bl_flash_cm_cmd_t));
    memset(&bl_flash_cm_resp_buffer, 0, sizeof(bl_flash_cm_resp_t));
    memset(bl_flash_cm_data_buffer, 0xFF, sizeof(bl_flash_cm_data_buffer));

    bl_flash_cm_initialized = true;

    return BL_SUCCESS;
}

int bl_flash_cm_deinit(void)
{
    if (!bl_flash_cm_initialized) {
        return BL_INVALID_PARAM;
    }

    bl_flash_cm_initialized = false;

    return BL_SUCCESS;
}

int bl_flash_cm_erase(uint32_t addr, uint32_t size, uint32_t* actual_addr, uint32_t* actual_size)
{
    if (!bl_flash_cm_initialized) {
        return BL_INVALID_PARAM;
    }

    if (actual_addr != NULL) {
        *actual_addr = 0xFFFFFFFF;
    }

    if (actual_size != NULL) {
        *actual_size = 0;
    }

    bl_flash_cm_cmd_buffer.cmd = BL_FLASH_CM_CMD_ERASE;
    bl_flash_cm_cmd_buffer.addr = addr;
    bl_flash_cm_cmd_buffer.size = size;
    bl_flash_cm_cmd_buffer.data_offset = 0;

    IPC_sendCommand(IPC_CPU1_L_CM_R, IPC_FLAG1, IPC_ADDR_CORRECTION_ENABLE,
                    0, 0, 0);
    IPC_waitForAck(IPC_CPU1_L_CM_R, IPC_FLAG1);

    if (actual_addr != NULL) {
        *actual_addr = bl_flash_cm_resp_buffer.actual_addr;
    }

    if (actual_size != NULL) {
        *actual_size = bl_flash_cm_resp_buffer.actual_size;
    }

    return bl_flash_cm_resp_buffer.result;
}

int bl_flash_cm_write(uint32_t addr, const uint16_t* data, uint32_t size)
{
    if (!bl_flash_cm_initialized) {
        return BL_INVALID_PARAM;
    }

    if (data == NULL) {
        return BL_INVALID_PARAM;
    }

    uint32_t remaining = size;
    uint32_t write_offset = 0;
    uint32_t current_addr = addr;

    while (remaining > 0) {
        uint32_t chunk_size = (remaining > BL_FLASH_CM_DATA_BUFFER_SIZE) ? 
                              BL_FLASH_CM_DATA_BUFFER_SIZE : remaining;

        memcpy(bl_flash_cm_data_buffer, &data[write_offset], chunk_size * sizeof(uint16_t));

        bl_flash_cm_cmd_buffer.cmd = BL_FLASH_CM_CMD_WRITE;
        bl_flash_cm_cmd_buffer.addr = current_addr;
        bl_flash_cm_cmd_buffer.size = chunk_size;
        bl_flash_cm_cmd_buffer.data_offset = 0;

        IPC_sendCommand(IPC_CPU1_L_CM_R, IPC_FLAG2, IPC_ADDR_CORRECTION_ENABLE,
                        0, 0, 0);
        IPC_waitForAck(IPC_CPU1_L_CM_R, IPC_FLAG2);

        if (bl_flash_cm_resp_buffer.result != BL_SUCCESS) {
            return bl_flash_cm_resp_buffer.result;
        }

        current_addr += chunk_size;
        write_offset += chunk_size;
        remaining -= chunk_size;
    }

    return BL_SUCCESS;
}

int bl_flash_cm_flush(void)
{
    if (!bl_flash_cm_initialized) {
        return BL_INVALID_PARAM;
    }

    bl_flash_cm_cmd_buffer.cmd = BL_FLASH_CM_CMD_FLUSH;
    bl_flash_cm_cmd_buffer.addr = 0;
    bl_flash_cm_cmd_buffer.size = 0;
    bl_flash_cm_cmd_buffer.data_offset = 0;

    IPC_sendCommand(IPC_CPU1_L_CM_R, IPC_FLAG3, IPC_ADDR_CORRECTION_ENABLE,
                    0, 0, 0);
    IPC_waitForAck(IPC_CPU1_L_CM_R, IPC_FLAG3);

    return bl_flash_cm_resp_buffer.result;
}
