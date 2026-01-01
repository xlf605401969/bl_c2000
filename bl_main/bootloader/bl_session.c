#include "bl_session.h"
#include <string.h>

int bl_session_init(bl_session_manager_t *manager)
{
    if (manager == NULL) {
        return BL_FLASH_INVALID_PARAM;
    }

    memset(manager, 0, sizeof(bl_session_manager_t));
    manager->active_device_count = 0;
    manager->current_device_id = 0;
    manager->initialized = true;

    return BL_FLASH_SUCCESS;
}

int bl_session_deinit(bl_session_manager_t *manager)
{
    if (manager == NULL) {
        return BL_FLASH_INVALID_PARAM;
    }

    manager->initialized = false;

    return BL_FLASH_SUCCESS;
}

int bl_session_add_device(bl_session_manager_t *manager, uint8_t device_id,
                         bl_proto_target_t target_type, uint16_t slave_addr,
                         uint32_t app_start_addr, uint32_t app_size)
{
    if (manager == NULL || !manager->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    if (manager->active_device_count >= BL_SESSION_MAX_DEVICES) {
        return BL_FLASH_ERROR;
    }

    for (uint8_t i = 0; i < manager->active_device_count; i++) {
        if (manager->devices[i].device_id == device_id) {
            return BL_FLASH_ERROR;
        }
    }

    bl_session_device_t *device = &manager->devices[manager->active_device_count];
    device->device_id = device_id;
    device->target_type = target_type;
    device->slave_addr = slave_addr;
    device->app_start_addr = app_start_addr;
    device->app_size = app_size;
    device->current_addr = 0;
    device->total_bytes = 0;
    device->bytes_written = 0;
    device->status = BL_SESSION_STATUS_IDLE;
    device->last_activity = 0;
    device->is_local = (target_type == BL_PROTO_TARGET_LOCAL_MCU);

    manager->active_device_count++;

    if (manager->current_device_id == 0) {
        manager->current_device_id = device_id;
    }

    return BL_FLASH_SUCCESS;
}

int bl_session_remove_device(bl_session_manager_t *manager, uint8_t device_id)
{
    if (manager == NULL || !manager->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    int found_index = -1;
    for (uint8_t i = 0; i < manager->active_device_count; i++) {
        if (manager->devices[i].device_id == device_id) {
            found_index = i;
            break;
        }
    }

    if (found_index == -1) {
        return BL_FLASH_ERROR;
    }

    for (uint8_t i = found_index; i < manager->active_device_count - 1; i++) {
        manager->devices[i] = manager->devices[i + 1];
    }

    manager->active_device_count--;

    if (manager->current_device_id == device_id) {
        if (manager->active_device_count > 0) {
            manager->current_device_id = manager->devices[0].device_id;
        } else {
            manager->current_device_id = 0;
        }
    }

    return BL_FLASH_SUCCESS;
}

int bl_session_select_device(bl_session_manager_t *manager, uint8_t device_id)
{
    if (manager == NULL || !manager->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    for (uint8_t i = 0; i < manager->active_device_count; i++) {
        if (manager->devices[i].device_id == device_id) {
            manager->current_device_id = device_id;
            return BL_FLASH_SUCCESS;
        }
    }

    return BL_FLASH_ERROR;
}

bl_session_device_t *bl_session_get_current_device(bl_session_manager_t *manager)
{
    if (manager == NULL || !manager->initialized) {
        return NULL;
    }

    if (manager->current_device_id == 0) {
        return NULL;
    }

    return bl_session_get_device(manager, manager->current_device_id);
}

bl_session_device_t *bl_session_get_device(bl_session_manager_t *manager, uint8_t device_id)
{
    if (manager == NULL || !manager->initialized) {
        return NULL;
    }

    for (uint8_t i = 0; i < manager->active_device_count; i++) {
        if (manager->devices[i].device_id == device_id) {
            return &manager->devices[i];
        }
    }

    return NULL;
}

int bl_session_start_update(bl_session_manager_t *manager, uint8_t device_id,
                           uint32_t total_bytes)
{
    if (manager == NULL || !manager->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    bl_session_device_t *device = bl_session_get_device(manager, device_id);
    if (device == NULL) {
        return BL_FLASH_ERROR;
    }

    device->current_addr = device->app_start_addr;
    device->total_bytes = total_bytes;
    device->bytes_written = 0;
    device->status = BL_SESSION_STATUS_UPDATING;
    device->last_activity = 0;

    return BL_FLASH_SUCCESS;
}

int bl_session_update_progress(bl_session_manager_t *manager, uint8_t device_id,
                               uint32_t bytes_written)
{
    if (manager == NULL || !manager->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    bl_session_device_t *device = bl_session_get_device(manager, device_id);
    if (device == NULL) {
        return BL_FLASH_ERROR;
    }

    device->bytes_written += bytes_written;
    device->current_addr = device->app_start_addr + device->bytes_written;
    device->last_activity = 0;

    return BL_FLASH_SUCCESS;
}

int bl_session_complete_update(bl_session_manager_t *manager, uint8_t device_id)
{
    if (manager == NULL || !manager->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    bl_session_device_t *device = bl_session_get_device(manager, device_id);
    if (device == NULL) {
        return BL_FLASH_ERROR;
    }

    device->status = BL_SESSION_STATUS_ACTIVE;
    device->last_activity = 0;

    return BL_FLASH_SUCCESS;
}

int bl_session_fail_update(bl_session_manager_t *manager, uint8_t device_id)
{
    if (manager == NULL || !manager->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    bl_session_device_t *device = bl_session_get_device(manager, device_id);
    if (device == NULL) {
        return BL_FLASH_ERROR;
    }

    device->status = BL_SESSION_STATUS_ERROR;
    device->last_activity = 0;

    return BL_FLASH_SUCCESS;
}

int bl_session_check_timeout(bl_session_manager_t *manager, uint32_t current_time)
{
    if (manager == NULL || !manager->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    for (uint8_t i = 0; i < manager->active_device_count; i++) {
        bl_session_device_t *device = &manager->devices[i];
        
        if (device->status == BL_SESSION_STATUS_UPDATING) {
            if (device->last_activity > 0) {
                uint32_t elapsed = current_time - device->last_activity;
                if (elapsed > BL_SESSION_TIMEOUT_MS) {
                    device->status = BL_SESSION_STATUS_ERROR;
                }
            }
        }
    }

    return BL_FLASH_SUCCESS;
}

int bl_session_reset_all(bl_session_manager_t *manager)
{
    if (manager == NULL || !manager->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    for (uint8_t i = 0; i < manager->active_device_count; i++) {
        bl_session_device_t *device = &manager->devices[i];
        device->current_addr = 0;
        device->total_bytes = 0;
        device->bytes_written = 0;
        device->status = BL_SESSION_STATUS_IDLE;
        device->last_activity = 0;
    }

    return BL_FLASH_SUCCESS;
}

uint8_t bl_session_get_device_count(bl_session_manager_t *manager)
{
    if (manager == NULL || !manager->initialized) {
        return 0;
    }

    return manager->active_device_count;
}

bool bl_session_is_updating(bl_session_manager_t *manager)
{
    if (manager == NULL || !manager->initialized) {
        return false;
    }

    for (uint8_t i = 0; i < manager->active_device_count; i++) {
        if (manager->devices[i].status == BL_SESSION_STATUS_UPDATING) {
            return true;
        }
    }

    return false;
}
