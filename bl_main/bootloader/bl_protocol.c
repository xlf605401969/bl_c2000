#include "bl_protocol.h"
#include <string.h>

#define BL_PROTO_APP_START_ADDR    0x088000
#define BL_PROTO_APP_SIZE          0x00040000

static uint16_t bl_proto_calc_crc(const uint8_t *data, uint16_t len)
{
    uint16_t crc = 0xFFFF;
    uint16_t i, j;

    for (i = 0; i < len; i++) {
        crc ^= data[i];
        for (j = 0; j < 8; j++) {
            if (crc & 0x0001) {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }

    return crc;
}

int bl_proto_init(bl_proto_t *proto, bl_flash_t *flash)
{
    if (proto == NULL || flash == NULL) {
        return BL_FLASH_INVALID_PARAM;
    }

    memset(proto, 0, sizeof(bl_proto_t));
    
    proto->session.state = BL_PROTO_STATE_IDLE;
    proto->session.target = BL_PROTO_TARGET_LOCAL_MCU;
    proto->session.slave_addr = 0;
    proto->session.app_start_addr = BL_PROTO_APP_START_ADDR;
    proto->session.app_size = BL_PROTO_APP_SIZE;
    proto->session.in_bootloader = false;
    
    proto->flash = flash;

    return BL_FLASH_SUCCESS;
}

int bl_proto_deinit(bl_proto_t *proto)
{
    if (proto == NULL) {
        return BL_FLASH_INVALID_PARAM;
    }

    return BL_FLASH_SUCCESS;
}

int bl_proto_process_request(bl_proto_t *proto, const bl_proto_request_t *req, 
                             bl_proto_response_t *resp)
{
    if (proto == NULL || req == NULL || resp == NULL) {
        return BL_FLASH_INVALID_PARAM;
    }

    memset(resp, 0, sizeof(bl_proto_response_t));
    resp->slave_addr = req->slave_addr;
    resp->func_code = req->func_code;
    resp->status = BL_PROTO_STATUS_SUCCESS;

    switch (req->func_code) {
        case BL_PROTO_FUNC_ENTER_BL:
            return bl_proto_handle_enter_bl(proto, resp);
            
        case BL_PROTO_FUNC_ERASE:
            return bl_proto_handle_erase(proto, req, resp);
            
        case BL_PROTO_FUNC_WRITE:
            return bl_proto_handle_write(proto, req, resp);
            
        case BL_PROTO_FUNC_VERIFY:
            return bl_proto_handle_verify(proto, req, resp);
            
        case BL_PROTO_FUNC_JUMP:
            return bl_proto_handle_jump(proto, req, resp);
            
        case BL_PROTO_FUNC_SET_TARGET:
            return bl_proto_handle_set_target(proto, req, resp);
            
        case BL_PROTO_FUNC_QUERY_SESSION:
            return bl_proto_handle_query_session(proto, resp);
            
        case BL_PROTO_FUNC_RESET:
            return bl_proto_handle_reset(proto, resp);
            
        default:
            resp->status = BL_PROTO_STATUS_UNKNOWN_ERROR;
            resp->data_len = 0;
            break;
    }

    return BL_FLASH_SUCCESS;
}

int bl_proto_handle_enter_bl(bl_proto_t *proto, bl_proto_response_t *resp)
{
    if (proto->session.in_bootloader) {
        resp->status = BL_PROTO_STATUS_ALREADY_BL;
    } else {
        proto->session.state = BL_PROTO_STATE_BOOTLOADER;
        proto->session.in_bootloader = true;
        resp->status = BL_PROTO_STATUS_SUCCESS;
    }

    resp->data_len = 0;

    return BL_FLASH_SUCCESS;
}

int bl_proto_handle_erase(bl_proto_t *proto, const bl_proto_request_t *req, 
                          bl_proto_response_t *resp)
{
    if (req->data_len < 8) {
        resp->status = BL_PROTO_STATUS_INVALID_PARAM;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    uint32_t start_addr = (req->data[0] << 24) | (req->data[1] << 16) | 
                          (req->data[2] << 8) | req->data[3];
    uint32_t length = (req->data[4] << 24) | (req->data[5] << 16) | 
                     (req->data[6] << 8) | req->data[7];

    if (start_addr == 0xFFFFFFFF && length == 0xFFFFFFFF) {
        start_addr = proto->session.app_start_addr;
        length = proto->session.app_size;
    }

    bl_flash_sector_t sector = bl_flash_addr_to_sector(proto->flash, start_addr);
    if (sector == BL_FLASH_SECTOR_MAX) {
        resp->status = BL_PROTO_STATUS_INVALID_RANGE;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    bl_flash_sector_info_t *info = bl_flash_get_sector_info(proto->flash, sector);
    if (info->write_protected) {
        resp->status = BL_PROTO_STATUS_WRITE_PROT;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    int result = bl_flash_erase_range(proto->flash, start_addr, length);
    if (result != BL_FLASH_SUCCESS) {
        resp->status = BL_PROTO_STATUS_ERASE_FAIL;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    resp->data[0] = (start_addr >> 24) & 0xFF;
    resp->data[1] = (start_addr >> 16) & 0xFF;
    resp->data[2] = (start_addr >> 8) & 0xFF;
    resp->data[3] = start_addr & 0xFF;
    resp->data[4] = (length >> 24) & 0xFF;
    resp->data[5] = (length >> 16) & 0xFF;
    resp->data[6] = (length >> 8) & 0xFF;
    resp->data[7] = length & 0xFF;
    resp->data_len = 8;

    return BL_FLASH_SUCCESS;
}

int bl_proto_handle_write(bl_proto_t *proto, const bl_proto_request_t *req, 
                          bl_proto_response_t *resp)
{
    if (req->data_len < 6) {
        resp->status = BL_PROTO_STATUS_INVALID_PARAM;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    uint32_t addr = (req->data[0] << 24) | (req->data[1] << 16) | 
                   (req->data[2] << 8) | req->data[3];
    uint16_t length = (req->data[4] << 8) | req->data[5];
    const uint8_t *data = &req->data[6];

    if (addr & 0x01) {
        resp->status = BL_PROTO_STATUS_INVALID_ALIGN;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    bl_flash_sector_t sector = bl_flash_addr_to_sector(proto->flash, addr);
    if (sector == BL_FLASH_SECTOR_MAX) {
        resp->status = BL_PROTO_STATUS_INVALID_RANGE;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    if (length > BL_PROTO_MAX_DATA_LEN - 6) {
        resp->status = BL_PROTO_STATUS_LENGTH_LIMIT;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    int result = bl_flash_write(proto->flash, addr, data, length);
    if (result != BL_FLASH_SUCCESS) {
        resp->status = BL_PROTO_STATUS_WRITE_FAIL;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    resp->data[0] = (length >> 8) & 0xFF;
    resp->data[1] = length & 0xFF;
    resp->data_len = 2;

    return BL_FLASH_SUCCESS;
}

int bl_proto_handle_verify(bl_proto_t *proto, const bl_proto_request_t *req, 
                           bl_proto_response_t *resp)
{
    if (req->data_len < 9) {
        resp->status = BL_PROTO_STATUS_INVALID_PARAM;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    uint32_t start_addr = (req->data[0] << 24) | (req->data[1] << 16) | 
                          (req->data[2] << 8) | req->data[3];
    uint32_t length = (req->data[4] << 24) | (req->data[5] << 16) | 
                     (req->data[6] << 8) | req->data[7];
    uint8_t verify_type = req->data[8];

    if (verify_type != 0x00) {
        resp->status = BL_PROTO_STATUS_INVALID_PARAM;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    bl_flash_sector_t sector = bl_flash_addr_to_sector(proto->flash, start_addr);
    if (sector == BL_FLASH_SECTOR_MAX) {
        resp->status = BL_PROTO_STATUS_INVALID_RANGE;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    uint8_t *buffer = (uint8_t *)start_addr;
    uint32_t crc32 = bl_flash_calculate_crc32(buffer, length);

    resp->data[0] = (crc32 >> 24) & 0xFF;
    resp->data[1] = (crc32 >> 16) & 0xFF;
    resp->data[2] = (crc32 >> 8) & 0xFF;
    resp->data[3] = crc32 & 0xFF;
    resp->data_len = 4;

    return BL_FLASH_SUCCESS;
}

int bl_proto_handle_jump(bl_proto_t *proto, const bl_proto_request_t *req, 
                         bl_proto_response_t *resp)
{
    if (req->data_len < 4) {
        resp->status = BL_PROTO_STATUS_INVALID_PARAM;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    uint32_t jump_addr = (req->data[0] << 24) | (req->data[1] << 16) | 
                        (req->data[2] << 8) | req->data[3];

    if (jump_addr == 0xFFFFFFFF) {
        jump_addr = proto->session.app_start_addr;
    }

    uint32_t *app_ptr = (uint32_t *)jump_addr;
    if (*app_ptr == 0xFFFFFFFF) {
        resp->status = BL_PROTO_STATUS_INVALID_APP;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    resp->status = BL_PROTO_STATUS_SUCCESS;
    resp->data_len = 0;

    return BL_FLASH_SUCCESS;
}

int bl_proto_handle_set_target(bl_proto_t *proto, const bl_proto_request_t *req, 
                               bl_proto_response_t *resp)
{
    if (req->data_len < 3) {
        resp->status = BL_PROTO_STATUS_INVALID_PARAM;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    uint8_t target_type = req->data[0];
    uint16_t target_addr = (req->data[1] << 8) | req->data[2];

    if (target_type == BL_PROTO_TARGET_LOCAL) {
        proto->session.target = BL_PROTO_TARGET_LOCAL_MCU;
        proto->session.app_start_addr = BL_PROTO_APP_START_ADDR;
        proto->session.app_size = BL_PROTO_APP_SIZE;
    } else if (target_type == BL_PROTO_TARGET_SLAVE) {
        if (target_addr == 0x0001) {
            proto->session.target = BL_PROTO_TARGET_SLAVE_MCU1;
        } else if (target_addr == 0x0002) {
            proto->session.target = BL_PROTO_TARGET_SLAVE_MCU2;
        } else {
            resp->status = BL_PROTO_STATUS_INVALID_ADDR;
            resp->data_len = 0;
            return BL_FLASH_SUCCESS;
        }
        proto->session.slave_addr = target_addr;
        proto->session.app_start_addr = 0x00000000;
        proto->session.app_size = 0x00040000;
    } else {
        resp->status = BL_PROTO_STATUS_INVALID_TARGET;
        resp->data_len = 0;
        return BL_FLASH_SUCCESS;
    }

    resp->status = BL_PROTO_STATUS_SUCCESS;
    resp->data_len = 0;

    return BL_FLASH_SUCCESS;
}

int bl_proto_handle_query_session(bl_proto_t *proto, bl_proto_response_t *resp)
{
    resp->data[0] = (uint8_t)proto->session.target;
    resp->data[1] = (proto->session.slave_addr >> 8) & 0xFF;
    resp->data[2] = proto->session.slave_addr & 0xFF;
    resp->data_len = 3;

    return BL_FLASH_SUCCESS;
}

int bl_proto_handle_reset(bl_proto_t *proto, bl_proto_response_t *resp)
{
    proto->session.state = BL_PROTO_STATE_IDLE;
    proto->session.target = BL_PROTO_TARGET_LOCAL_MCU;
    proto->session.slave_addr = 0;
    proto->session.app_start_addr = BL_PROTO_APP_START_ADDR;
    proto->session.app_size = BL_PROTO_APP_SIZE;
    proto->session.in_bootloader = false;

    resp->status = BL_PROTO_STATUS_SUCCESS;
    resp->data_len = 0;

    return BL_FLASH_SUCCESS;
}

bl_proto_session_t *bl_proto_get_session(bl_proto_t *proto)
{
    if (proto == NULL) {
        return NULL;
    }

    return &proto->session;
}
