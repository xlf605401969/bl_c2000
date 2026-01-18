#ifndef BL_FLASH_CM_IPC_H
#define BL_FLASH_CM_IPC_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C"
{
#endif

#define BL_FLASH_CM_DATA_BUFFER_SIZE 256

typedef enum
{
    BL_FLASH_CM_CMD_READ = 0x04,
    BL_FLASH_CM_CMD_ERASE = 0x66,
    BL_FLASH_CM_CMD_WRITE = 0x67,
    BL_FLASH_CM_CMD_FLUSH = 0x68
} bl_flash_cm_cmd_type_t;

typedef struct
{
    uint32_t cmd;
    uint32_t addr;
    uint32_t size;
    uint16_t data_start;
} bl_flash_cm_ipc_t;

void bl_flash_cm_ipc_init(void);

void bl_flash_cm_ipc_process_cmd(void);

#ifdef __cplusplus
}
#endif

#endif
