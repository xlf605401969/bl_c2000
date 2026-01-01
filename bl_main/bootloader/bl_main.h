#ifndef BL_MAIN_H
#define BL_MAIN_H

#include <stdint.h>
#include <stdbool.h>
#include "bl_flash.h"
#include "bl_protocol.h"

#ifdef __cplusplus
extern "C" {
#endif

#define BL_MAIN_VERSION_MAJOR  1
#define BL_MAIN_VERSION_MINOR  0
#define BL_MAIN_VERSION_PATCH  0

typedef enum {
    BL_MAIN_STATE_IDLE = 0,
    BL_MAIN_STATE_BOOTLOADER,
    BL_MAIN_STATE_UPDATING,
    BL_MAIN_STATE_JUMPING,
    BL_MAIN_STATE_ERROR
} bl_main_state_t;

typedef struct {
    bl_flash_t            flash;
    bl_proto_t            proto;
    bl_main_state_t       state;
    uint32_t              system_tick;
    bool                  initialized;
    bool                  app_valid;
} bl_main_t;

int bl_main_init(bl_main_t *bl);
int bl_main_deinit(bl_main_t *bl);

int bl_main_process(bl_main_t *bl);
int bl_main_tick(bl_main_t *bl, uint32_t tick);

int bl_main_handle_modbus_request(bl_main_t *bl, uint8_t *data, uint16_t len);
int bl_main_send_modbus_response(bl_main_t *bl, uint8_t *data, uint16_t len);

int bl_main_check_app_valid(bl_main_t *bl);
int bl_main_jump_to_app(bl_main_t *bl);

bl_main_state_t bl_main_get_state(bl_main_t *bl);

#ifdef __cplusplus
}
#endif

#endif
