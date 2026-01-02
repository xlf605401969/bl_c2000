#include "bl_main.h"
#include "lwmodbus_bl/lwmb.h"
#include "lwmodbus_bl/lwmb_port.h"
#include <string.h>

bl_proto_t g_bl_main_proto;
bl_flash_t g_bl_main_proto_flash;

static lwmb_err_t bl_modbus_callback(uint8_t slave_addr, uint8_t func_code,
                               uint8_t *req_data, uint16_t req_len,
                               uint8_t *resp_data, uint16_t *resp_len)
{
    bl_proto_request_t req;
    bl_proto_response_t resp;
    lwmb_err_t result = LWMB_OK;

    req.slave_addr = slave_addr;
    req.func_code = func_code;
    memcpy(req.data, req_data, req_len);
    req.data_len = req_len;

    result = bl_proto_process_request(&g_bl_main_proto, &req, &resp);
    if (result != LWMB_OK && result != LWMB_OK_NO_REPLY) {
        return result;
    }

    resp_data[0] = resp.status;
    if (resp.data_len > 0) {
        memcpy(&resp_data[1], resp.data, resp.data_len);
    }
    *resp_len = resp.data_len + 1;

    return result;
}

void bl_main_init()
{
    bl_proto_init(&g_bl_main_proto, &g_bl_main_proto_flash);
    lwmb_init(bl_modbus_callback);
}

int bl_main_deinit()
{
    bl_flash_deinit(&g_bl_main_proto_flash);
    return BL_SUCCESS;
}

void bl_main_process()
{
    lwmb_poll();
}

void bl_main_tick(uint32_t tick)
{
    lwmb_tick(tick);
}
