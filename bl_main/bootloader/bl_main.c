#include "bl_main.h"
#include "lwmodbus_bl/lwmb.h"
#include "lwmodbus_bl/lwmb_port.h"
#include <string.h>

bl_proto_t g_bl_main_proto;
#define BL_MAIN_FLASH_MGR_IDX 0

static lwmb_err_t bl_modbus_callback(uint8_t slave_addr, uint8_t func_code,
                               uint8_t *req_data, uint16_t req_len,
                               uint8_t *resp_data, uint16_t *resp_len)
{
    bl_proto_request_t req;
    bl_proto_response_t resp;
    lwmb_err_t result = LWMB_OK;

    req.slave_addr = slave_addr;
    req.func_code = func_code;
    // 单线程下可直接使用req_data作为请求数据，避免拷贝
    req.data = req_data;
    req.data_len = req_len;

    // 单线程下可直接使用resp_data作为响应数据，避免拷贝
    resp.data = resp_data;

    result = bl_proto_process_request(&g_bl_main_proto, &req, &resp);
    if (result != LWMB_OK && result != LWMB_OK_NO_REPLY) {
        return result;
    }

    *resp_len = resp.data_len ;

    return result;
}

void bl_main_init()
{
    bl_flash_init();
    bl_flash_mgr_init_local(BL_MAIN_FLASH_MGR_IDX);
    bl_flash_mgr_activate(BL_MAIN_FLASH_MGR_IDX);
    bl_proto_init(&g_bl_main_proto);
    lwmb_init(bl_modbus_callback);
}

int bl_main_deinit()
{
    bl_flash_mgr_deinit(BL_MAIN_FLASH_MGR_IDX);
    bl_flash_deinit();
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
