#ifndef BL_SESSION_H
#define BL_SESSION_H

#include <stdint.h>
#include <stdbool.h>
#include "bl_protocol.h"

#ifdef __cplusplus
extern "C" {
#endif

#define BL_SESSION_MAX_DEVICES  3
#define BL_SESSION_TIMEOUT_MS   30000

typedef enum {
    BL_SESSION_STATUS_IDLE = 0,
    BL_SESSION_STATUS_ACTIVE,
    BL_SESSION_STATUS_UPDATING,
    BL_SESSION_STATUS_ERROR
} bl_session_status_t;

typedef struct {
    uint8_t              device_id;
    bl_proto_target_t    target_type;
    uint16_t             slave_addr;
    uint32_t             app_start_addr;
    uint32_t             app_size;
    uint32_t             current_addr;
    uint32_t             total_bytes;
    uint32_t             bytes_written;
    bl_session_status_t  status;
    uint32_t             last_activity;
    bool                 is_local;
} bl_session_device_t;

typedef struct {
    bl_session_device_t  devices[BL_SESSION_MAX_DEVICES];
    uint8_t              active_device_count;
    uint8_t              current_device_id;
    bool                 initialized;
} bl_session_manager_t;

int bl_session_init(bl_session_manager_t *manager);
int bl_session_deinit(bl_session_manager_t *manager);

int bl_session_add_device(bl_session_manager_t *manager, uint8_t device_id,
                         bl_proto_target_t target_type, uint16_t slave_addr,
                         uint32_t app_start_addr, uint32_t app_size);

int bl_session_remove_device(bl_session_manager_t *manager, uint8_t device_id);
int bl_session_select_device(bl_session_manager_t *manager, uint8_t device_id);

bl_session_device_t *bl_session_get_current_device(bl_session_manager_t *manager);
bl_session_device_t *bl_session_get_device(bl_session_manager_t *manager, uint8_t device_id);

int bl_session_start_update(bl_session_manager_t *manager, uint8_t device_id,
                           uint32_t total_bytes);
int bl_session_update_progress(bl_session_manager_t *manager, uint8_t device_id,
                               uint32_t bytes_written);
int bl_session_complete_update(bl_session_manager_t *manager, uint8_t device_id);
int bl_session_fail_update(bl_session_manager_t *manager, uint8_t device_id);

int bl_session_check_timeout(bl_session_manager_t *manager, uint32_t current_time);
int bl_session_reset_all(bl_session_manager_t *manager);

uint8_t bl_session_get_device_count(bl_session_manager_t *manager);
bool bl_session_is_updating(bl_session_manager_t *manager);

#ifdef __cplusplus
}
#endif

#endif
