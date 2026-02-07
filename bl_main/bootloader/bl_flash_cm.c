/**
 * @file bl_flash_cm.c
 * @brief CM Flash驱动实现
 *
 * 通过IPC与CM核心通信，实现对CM Flash的远程操作。
 */

#include <string.h>
#include "bl_flash_cm.h"
#include "bl_time.h"
#include "device/driverlib/ipc.h"

#define BL_FLASH_CM_CMD_BUFFER_ADDR  0x039000
#define BL_FLASH_CM_RESP_BUFFER_ADDR 0x038000
#define BL_FLASH_CM_IPC_TIMEOUT_US   20000

static bl_flash_cm_ipc_t *bl_flash_cm_cmd_buffer = (bl_flash_cm_ipc_t *)BL_FLASH_CM_CMD_BUFFER_ADDR;
static bl_flash_cm_ipc_t *bl_flash_cm_resp_buffer = (bl_flash_cm_ipc_t *)BL_FLASH_CM_RESP_BUFFER_ADDR;

static bool bl_flash_cm_initialized = false;

static int bl_flash_cm_ipc_wait_for_ack(void)
{
    bl_timeout_t timeout;
    
    bl_timeout_init(&timeout, BL_FLASH_CM_IPC_TIMEOUT_US);
    
    while (!bl_timeout_is_expired(&timeout)) {
        if (!IPC_isFlagBusyRtoL(IPC_CPU1_L_CM_R, IPC_FLAG0)) {
            return BL_SUCCESS;
        }
    }
    
    return BL_TIMEOUT;
}

int bl_flash_cm_init(void)
{
    if (bl_flash_cm_initialized) {
        return BL_SUCCESS;
    }

    memset(bl_flash_cm_cmd_buffer, 0, sizeof(bl_flash_cm_ipc_t));
    memset(bl_flash_cm_resp_buffer, 0, sizeof(bl_flash_cm_ipc_t));

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

    bl_flash_cm_cmd_buffer->cmd = BL_FLASH_CM_CMD_ERASE;
    bl_flash_cm_cmd_buffer->addr = addr;
    bl_flash_cm_cmd_buffer->size = size;
    bl_flash_cm_cmd_buffer->data_start = 0;

    IPC_sendCommand(IPC_CPU1_L_CM_R, IPC_FLAG0, IPC_ADDR_CORRECTION_ENABLE,
                    bl_flash_cm_cmd_buffer->cmd, (uint32_t)bl_flash_cm_cmd_buffer, 
                    sizeof(bl_flash_cm_ipc_t));

    int result = bl_flash_cm_ipc_wait_for_ack();
    
    if (result != BL_SUCCESS) {
        return result;
    }

    if (actual_addr != NULL) {
        *actual_addr = bl_flash_cm_resp_buffer->addr;
    }

    if (actual_size != NULL) {
        *actual_size = bl_flash_cm_resp_buffer->size;
    }

    return (bl_flash_cm_resp_buffer->cmd == BL_FLASH_CM_CMD_ERASE) ? BL_SUCCESS : BL_ERROR;
}

int bl_flash_cm_read(uint32_t addr, uint16_t *data, uint32_t size)
{
    if (!bl_flash_cm_initialized) {
        return BL_INVALID_PARAM;
    }

    if (data == NULL) {
        return BL_INVALID_PARAM;
    }

    uint32_t remaining = size;
    uint32_t read_offset = 0;
    uint32_t current_addr = addr;

    while (remaining > 0) {
        uint32_t chunk_size = (remaining > BL_FLASH_CM_DATA_BUFFER_SIZE) ? 
                              BL_FLASH_CM_DATA_BUFFER_SIZE : remaining;

        bl_flash_cm_cmd_buffer->cmd = BL_FLASH_CM_CMD_READ;
        bl_flash_cm_cmd_buffer->addr = current_addr;
        bl_flash_cm_cmd_buffer->size = chunk_size;
        bl_flash_cm_cmd_buffer->data_start = 0;

        IPC_sendCommand(IPC_CPU1_L_CM_R, IPC_FLAG0, IPC_ADDR_CORRECTION_ENABLE,
                        bl_flash_cm_cmd_buffer->cmd, (uint32_t)bl_flash_cm_cmd_buffer, 
                        sizeof(bl_flash_cm_ipc_t));

        int result = bl_flash_cm_ipc_wait_for_ack();
        
        if (result != BL_SUCCESS) {
            return result;
        }

        if (bl_flash_cm_resp_buffer->cmd != BL_FLASH_CM_CMD_READ) {
            return BL_ERROR;
        }

        memcpy(&data[read_offset], &bl_flash_cm_resp_buffer->data_start, chunk_size * sizeof(uint16_t));

        current_addr += chunk_size;
        read_offset += chunk_size;
        remaining -= chunk_size;
    }

    return BL_SUCCESS;
}

uint32_t bl_flash_cm_get_size(void)
{
    if (!bl_flash_cm_initialized) {
        return 0;
    }

    bl_flash_cm_cmd_buffer->cmd = BL_FLASH_CM_CMD_GET_SIZE;
    bl_flash_cm_cmd_buffer->addr = 0;
    bl_flash_cm_cmd_buffer->size = 0;
    bl_flash_cm_cmd_buffer->data_start = 0;

    IPC_sendCommand(IPC_CPU1_L_CM_R, IPC_FLAG0, IPC_ADDR_CORRECTION_ENABLE,
                    bl_flash_cm_cmd_buffer->cmd, (uint32_t)bl_flash_cm_cmd_buffer, 
                    sizeof(bl_flash_cm_ipc_t));

    int result = bl_flash_cm_ipc_wait_for_ack();
    
    if (result != BL_SUCCESS) {
        return 0;
    }

    return bl_flash_cm_resp_buffer->size;
}

uint8_t bl_flash_cm_addr_to_sector(uint32_t addr)
{
    if (!bl_flash_cm_initialized) {
        return 0xFF;
    }

    bl_flash_cm_cmd_buffer->cmd = BL_FLASH_CM_CMD_ADDR_TO_SECTOR;
    bl_flash_cm_cmd_buffer->addr = addr;
    bl_flash_cm_cmd_buffer->size = 0;
    bl_flash_cm_cmd_buffer->data_start = 0;

    IPC_sendCommand(IPC_CPU1_L_CM_R, IPC_FLAG0, IPC_ADDR_CORRECTION_ENABLE,
                    bl_flash_cm_cmd_buffer->cmd, (uint32_t)bl_flash_cm_cmd_buffer, 
                    sizeof(bl_flash_cm_ipc_t));

    int result = bl_flash_cm_ipc_wait_for_ack();
    
    if (result != BL_SUCCESS) {
        return 0xFF;
    }

    return (uint8_t)bl_flash_cm_resp_buffer->addr;
}

uint32_t bl_flash_cm_get_sector_start_addr(uint8_t sector_num)
{
    if (!bl_flash_cm_initialized) {
        return 0xFFFFFFFF;
    }

    bl_flash_cm_cmd_buffer->cmd = BL_FLASH_CM_CMD_GET_SECTOR_START_ADDR;
    bl_flash_cm_cmd_buffer->addr = sector_num;
    bl_flash_cm_cmd_buffer->size = 0;
    bl_flash_cm_cmd_buffer->data_start = 0;

    IPC_sendCommand(IPC_CPU1_L_CM_R, IPC_FLAG0, IPC_ADDR_CORRECTION_ENABLE,
                    bl_flash_cm_cmd_buffer->cmd, (uint32_t)bl_flash_cm_cmd_buffer, 
                    sizeof(bl_flash_cm_ipc_t));

    int result = bl_flash_cm_ipc_wait_for_ack();
    
    if (result != BL_SUCCESS) {
        return 0xFFFFFFFF;
    }

    return bl_flash_cm_resp_buffer->size;
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

        bl_flash_cm_cmd_buffer->cmd = BL_FLASH_CM_CMD_WRITE;
        bl_flash_cm_cmd_buffer->addr = current_addr;
        bl_flash_cm_cmd_buffer->size = chunk_size;
        memcpy(&bl_flash_cm_cmd_buffer->data_start, &data[write_offset], chunk_size * sizeof(uint16_t));

        IPC_sendCommand(IPC_CPU1_L_CM_R, IPC_FLAG0, IPC_ADDR_CORRECTION_ENABLE,
                        bl_flash_cm_cmd_buffer->cmd, (uint32_t)bl_flash_cm_cmd_buffer, 
                        sizeof(bl_flash_cm_ipc_t));

        int result = bl_flash_cm_ipc_wait_for_ack();
        
        if (result != BL_SUCCESS) {
            return result;
        }

        if (bl_flash_cm_resp_buffer->cmd != BL_FLASH_CM_CMD_WRITE) {
            return BL_ERROR;
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

    bl_flash_cm_cmd_buffer->cmd = BL_FLASH_CM_CMD_FLUSH;
    bl_flash_cm_cmd_buffer->addr = 0;
    bl_flash_cm_cmd_buffer->size = 0;
    bl_flash_cm_cmd_buffer->data_start = 0;

    IPC_sendCommand(IPC_CPU1_L_CM_R, IPC_FLAG0, IPC_ADDR_CORRECTION_ENABLE,
                    bl_flash_cm_cmd_buffer->cmd, (uint32_t)bl_flash_cm_cmd_buffer, 
                    sizeof(bl_flash_cm_ipc_t));

    int result = bl_flash_cm_ipc_wait_for_ack();
    
    if (result != BL_SUCCESS) {
        return result;
    }

    return (bl_flash_cm_resp_buffer->cmd == BL_FLASH_CM_CMD_FLUSH) ? BL_SUCCESS : BL_ERROR;
}
