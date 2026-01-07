#ifndef BL_FLASH_CM_H
#define BL_FLASH_CM_H

#include <stdint.h>
#include <stdbool.h>
#include "bl_common.h"

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
    uint32_t data_offset;
    uint16_t data[BL_FLASH_CM_DATA_BUFFER_SIZE];
} bl_flash_cm_cmd_t;

typedef struct
{
    int32_t result;
    uint32_t actual_addr;
    uint32_t actual_size;
    uint32_t written_size;
    uint16_t data[BL_FLASH_CM_DATA_BUFFER_SIZE];
} bl_flash_cm_resp_t;

int bl_flash_cm_init(void);

int bl_flash_cm_deinit(void);

int bl_flash_cm_erase(uint32_t addr, uint32_t size, uint32_t* actual_addr, uint32_t* actual_size);

int bl_flash_cm_write(uint32_t addr, const uint16_t* data, uint32_t size);

int bl_flash_cm_read(uint32_t addr, uint16_t *data, uint32_t size);

int bl_flash_cm_flush(void);

uint32_t bl_flash_cm_get_size(void);

uint8_t bl_flash_cm_addr_to_sector(uint32_t addr);

uint32_t bl_flash_cm_get_sector_start_addr(uint8_t sector_num);

#ifdef __cplusplus
}
#endif

#endif
