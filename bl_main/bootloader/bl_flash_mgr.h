#ifndef BL_FLASH_MGR_H
#define BL_FLASH_MGR_H

#include <stdint.h>
#include <stdbool.h>
#include "bl_common.h"

typedef enum
{
    BL_FLASH_TYPE_LOCAL = 0,
    BL_FLASH_TYPE_CM = 1,
    BL_FLASH_TYPE_MAX
} bl_flash_type_t;

typedef struct
{
    int (*erase)(uint32_t addr, uint32_t size, uint32_t* actual_addr, uint32_t* actual_size);
    int (*write)(uint32_t addr, const uint16_t* data, uint32_t size);
    int (*read)(uint32_t addr, uint16_t *data, uint32_t size);
    int (*flush)(void);
    uint32_t (*get_size)(void);
    uint8_t (*addr_to_sector)(uint32_t addr);
    uint32_t (*get_sector_start_addr)(uint8_t sector_num);
} bl_flash_ops_t;

typedef struct
{
    bl_flash_type_t type;
    bl_flash_ops_t ops;
    bool initialized;
} bl_flash_mgr_t;

#define BL_FLASH_MGR_COUNT 2

int bl_flash_mgr_init_local(uint8_t mgr_idx);
int bl_flash_mgr_init_cm(uint8_t mgr_idx);
int bl_flash_mgr_deinit(uint8_t mgr_idx);
int bl_flash_mgr_activate(uint8_t mgr_idx);
bl_flash_mgr_t* bl_flash_mgr_get_active(void);

#endif
