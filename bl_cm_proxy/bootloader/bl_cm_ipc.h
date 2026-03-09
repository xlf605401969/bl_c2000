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
    BL_FLASH_CM_CMD_FLUSH = 0x68,
    BL_FLASH_CM_CMD_GET_SIZE = 0x69,
    BL_FLASH_CM_CMD_ADDR_TO_SECTOR = 0x6A,
    BL_FLASH_CM_CMD_GET_SECTOR_START_ADDR = 0x6B
} bl_flash_cm_cmd_type_t;

typedef struct
{
    uint32_t cmd;        /**< 命令类型 */
    uint32_t addr;       /**< IPC层操作地址，统一使用16位字地址语义 */
    uint32_t size;       /**< IPC层操作大小，统一使用16位字数量语义 */
    uint16_t data_start; /**< 共享数据区起始位置；IPC层按原始缓冲区使用，CM侧在处理时转换为字节视图 */
} bl_flash_cm_ipc_t;

void bl_flash_cm_ipc_init(void);

void bl_flash_cm_ipc_process_cmd(void);

#ifdef __cplusplus
}
#endif

#endif
