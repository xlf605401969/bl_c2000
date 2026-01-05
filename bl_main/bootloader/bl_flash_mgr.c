#include "bl_flash_mgr.h"
#include "bl_flash.h"
#include "bl_flash_cm.h"
#include <string.h>

static bl_flash_mgr_t g_flash_mgrs[BL_FLASH_MGR_COUNT];
static uint8_t g_active_flash_mgr_idx = 0xFF;

static int bl_flash_mgr_read_cm(uint32_t addr, uint16_t *data, uint32_t size)
{
    (void)addr;
    (void)data;
    (void)size;
    return BL_ERROR;
}

static uint32_t bl_flash_mgr_get_size_cm(void)
{
    return 0;
}

static uint8_t bl_flash_mgr_addr_to_sector_cm(uint32_t addr)
{
    (void)addr;
    return 0xFF;
}

static uint32_t bl_flash_mgr_get_sector_start_addr_cm(uint8_t sector_num)
{
    (void)sector_num;
    return 0xFFFFFFFF;
}

int bl_flash_mgr_init_local(uint8_t mgr_idx)
{
    if (mgr_idx >= BL_FLASH_MGR_COUNT) {
        return BL_INVALID_PARAM;
    }

    int ret = bl_flash_init();
    if (ret != BL_SUCCESS) {
        return ret;
    }

    g_flash_mgrs[mgr_idx].type = BL_FLASH_TYPE_LOCAL;
    g_flash_mgrs[mgr_idx].ops.erase = bl_flash_erase_range;
    g_flash_mgrs[mgr_idx].ops.write = bl_flash_write;
    g_flash_mgrs[mgr_idx].ops.read = bl_flash_read;
    g_flash_mgrs[mgr_idx].ops.flush = bl_flash_cache_flush;
    g_flash_mgrs[mgr_idx].ops.get_size = bl_flash_get_size;
    g_flash_mgrs[mgr_idx].ops.addr_to_sector = bl_flash_addr_to_sector;
    g_flash_mgrs[mgr_idx].ops.get_sector_start_addr = bl_flash_get_sector_start_addr;
    g_flash_mgrs[mgr_idx].initialized = true;

    return BL_SUCCESS;
}

int bl_flash_mgr_init_cm(uint8_t mgr_idx)
{
    if (mgr_idx >= BL_FLASH_MGR_COUNT) {
        return BL_INVALID_PARAM;
    }

    int ret = bl_flash_cm_init();
    if (ret != BL_SUCCESS) {
        return ret;
    }

    g_flash_mgrs[mgr_idx].type = BL_FLASH_TYPE_CM;
    g_flash_mgrs[mgr_idx].ops.erase = bl_flash_cm_erase;
    g_flash_mgrs[mgr_idx].ops.write = bl_flash_cm_write;
    g_flash_mgrs[mgr_idx].ops.read = bl_flash_mgr_read_cm;
    g_flash_mgrs[mgr_idx].ops.flush = bl_flash_cm_flush;
    g_flash_mgrs[mgr_idx].ops.get_size = bl_flash_mgr_get_size_cm;
    g_flash_mgrs[mgr_idx].ops.addr_to_sector = bl_flash_mgr_addr_to_sector_cm;
    g_flash_mgrs[mgr_idx].ops.get_sector_start_addr = bl_flash_mgr_get_sector_start_addr_cm;
    g_flash_mgrs[mgr_idx].initialized = true;

    return BL_SUCCESS;
}

int bl_flash_mgr_deinit(uint8_t mgr_idx)
{
    if (mgr_idx >= BL_FLASH_MGR_COUNT) {
        return BL_INVALID_PARAM;
    }

    if (!g_flash_mgrs[mgr_idx].initialized) {
        return BL_INVALID_PARAM;
    }

    if (g_flash_mgrs[mgr_idx].type == BL_FLASH_TYPE_LOCAL) {
        bl_flash_deinit();
    } else if (g_flash_mgrs[mgr_idx].type == BL_FLASH_TYPE_CM) {
        bl_flash_cm_deinit();
    }

    memset(&g_flash_mgrs[mgr_idx], 0, sizeof(bl_flash_mgr_t));

    if (g_active_flash_mgr_idx == mgr_idx) {
        g_active_flash_mgr_idx = 0xFF;
    }

    return BL_SUCCESS;
}

int bl_flash_mgr_activate(uint8_t mgr_idx)
{
    if (mgr_idx >= BL_FLASH_MGR_COUNT) {
        return BL_INVALID_PARAM;
    }

    if (!g_flash_mgrs[mgr_idx].initialized) {
        return BL_INVALID_PARAM;
    }

    g_active_flash_mgr_idx = mgr_idx;

    return BL_SUCCESS;
}

bl_flash_mgr_t* bl_flash_mgr_get_active(void)
{
    if (g_active_flash_mgr_idx >= BL_FLASH_MGR_COUNT) {
        return NULL;
    }

    if (!g_flash_mgrs[g_active_flash_mgr_idx].initialized) {
        return NULL;
    }

    return &g_flash_mgrs[g_active_flash_mgr_idx];
}
