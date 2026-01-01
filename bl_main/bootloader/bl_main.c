#include "bl_main.h"
#include "lwmodbus_bl/lwmb.h"
#include "lwmodbus_bl/lwmb_port.h"
#include <string.h>

#define BL_MAIN_APP_VECTOR_ADDR   0x088000
#define BL_MAIN_APP_RESET_ADDR    0x088004

static bl_main_t *g_bl_main = NULL;

static void bl_modbus_callback(uint8_t slave_addr, uint8_t func_code, 
                               uint8_t *req_data, uint16_t req_len,
                               uint8_t *resp_data, uint16_t *resp_len)
{
    if (g_bl_main == NULL) {
        return;
    }

    bl_proto_request_t req;
    bl_proto_response_t resp;

    req.slave_addr = slave_addr;
    req.func_code = func_code;
    memcpy(req.data, req_data, req_len);
    req.data_len = req_len;

    bl_proto_process_request(&g_bl_main->proto, &req, &resp);

    resp_data[0] = resp.status;
    if (resp.data_len > 0) {
        memcpy(&resp_data[1], resp.data, resp.data_len);
    }
    *resp_len = resp.data_len + 1;
}

int bl_main_init(bl_main_t *bl)
{
    if (bl == NULL) {
        return BL_FLASH_INVALID_PARAM;
    }

    memset(bl, 0, sizeof(bl_main_t));
    bl->state = BL_MAIN_STATE_IDLE;
    bl->system_tick = 0;
    bl->initialized = false;
    bl->app_valid = false;

    int result;

    result = bl_flash_init(&bl->flash);
    if (result != BL_FLASH_SUCCESS) {
        return result;
    }

    result = bl_proto_init(&bl->proto, &bl->flash);
    if (result != BL_FLASH_SUCCESS) {
        bl_flash_deinit(&bl->flash);
        return result;
    }

    result = bl_session_init(&bl->session);
    if (result != BL_FLASH_SUCCESS) {
        bl_proto_deinit(&bl->proto);
        bl_flash_deinit(&bl->flash);
        return result;
    }

    result = bl_session_add_device(&bl->session, 1, BL_PROTO_TARGET_LOCAL_MCU, 
                                    0, 0x088000, 0x00040000);
    if (result != BL_FLASH_SUCCESS) {
        bl_session_deinit(&bl->session);
        bl_proto_deinit(&bl->proto);
        bl_flash_deinit(&bl->flash);
        return result;
    }

    result = bl_session_add_device(&bl->session, 2, BL_PROTO_TARGET_SLAVE_MCU1, 
                                    1, 0x000000, 0x00040000);
    if (result != BL_FLASH_SUCCESS) {
        bl_session_deinit(&bl->session);
        bl_proto_deinit(&bl->proto);
        bl_flash_deinit(&bl->flash);
        return result;
    }

    result = bl_session_add_device(&bl->session, 3, BL_PROTO_TARGET_SLAVE_MCU2, 
                                    2, 0x000000, 0x00040000);
    if (result != BL_FLASH_SUCCESS) {
        bl_session_deinit(&bl->session);
        bl_proto_deinit(&bl->proto);
        bl_flash_deinit(&bl->flash);
        return result;
    }

    g_bl_main = bl;

    lwmb_init(1, bl_modbus_callback);

    bl->initialized = true;
    bl->state = BL_MAIN_STATE_IDLE;

    return BL_FLASH_SUCCESS;
}

int bl_main_deinit(bl_main_t *bl)
{
    if (bl == NULL || !bl->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    bl_session_deinit(&bl->session);
    bl_proto_deinit(&bl->proto);
    bl_flash_deinit(&bl->flash);

    bl->initialized = false;
    g_bl_main = NULL;

    return BL_FLASH_SUCCESS;
}

int bl_main_process(bl_main_t *bl)
{
    if (bl == NULL || !bl->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

#if !LWMB_FRAME_MODE
    uint16_t available = lwmb_get_stream_avaliable_data();
    if (available > 0) {
        uint8_t buffer[LWMB_RX_MAX_LENGTH];
        uint16_t len = lwmb_read_stream(buffer, LWMB_RX_MAX_LENGTH);
        if (len > 0) {
            lwmb_process_stream(buffer, len);
        }
    }
#endif

    lwmb_poll();

    return BL_FLASH_SUCCESS;
}

int bl_main_tick(bl_main_t *bl, uint32_t tick)
{
    if (bl == NULL || !bl->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    bl->system_tick = tick;

    bl_session_check_timeout(&bl->session, tick);

    if (bl->state == BL_MAIN_STATE_IDLE) {
        bl_main_check_app_valid(bl);
        if (bl->app_valid && !bl_session_is_updating(&bl->session)) {
            bl->state = BL_MAIN_STATE_JUMPING;
            bl_main_jump_to_app(bl);
        }
    }

    return BL_FLASH_SUCCESS;
}

int bl_main_handle_modbus_request(bl_main_t *bl, uint8_t *data, uint16_t len)
{
    if (bl == NULL || !bl->initialized || data == NULL || len == 0) {
        return BL_FLASH_INVALID_PARAM;
    }

    return lwmb_process_stream(data, len);
}

int bl_main_send_modbus_response(bl_main_t *bl, uint8_t *data, uint16_t len)
{
    if (bl == NULL || !bl->initialized || data == NULL || len == 0) {
        return BL_FLASH_INVALID_PARAM;
    }

    lwmb_send_data(data, len);

    return BL_FLASH_SUCCESS;
}

int bl_main_check_app_valid(bl_main_t *bl)
{
    if (bl == NULL || !bl->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    uint32_t *app_vector = (uint32_t *)BL_MAIN_APP_VECTOR_ADDR;
    uint32_t *app_reset = (uint32_t *)BL_MAIN_APP_RESET_ADDR;

    if (*app_vector != 0xFFFFFFFF && *app_reset != 0xFFFFFFFF) {
        bl->app_valid = true;
    } else {
        bl->app_valid = false;
    }

    return BL_FLASH_SUCCESS;
}

int bl_main_jump_to_app(bl_main_t *bl)
{
    if (bl == NULL || !bl->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    if (!bl->app_valid) {
        bl->state = BL_MAIN_STATE_ERROR;
        return BL_FLASH_ERROR;
    }

    uint32_t app_reset_addr = *((uint32_t *)BL_MAIN_APP_RESET_ADDR);
    void (*app_reset)(void) = (void (*)(void))app_reset_addr;

    bl_flash_cache_flush(&bl->flash);

    bl->state = BL_MAIN_STATE_JUMPING;

    app_reset();

    return BL_FLASH_SUCCESS;
}

bl_main_state_t bl_main_get_state(bl_main_t *bl)
{
    if (bl == NULL) {
        return BL_MAIN_STATE_ERROR;
    }

    return bl->state;
}
