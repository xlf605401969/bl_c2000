#ifndef BL_PROTOCOL_H
#define BL_PROTOCOL_H

#include <stdint.h>
#include <stdbool.h>
#include "bl_flash.h"

#ifdef __cplusplus
extern "C" {
#endif

#define BL_PROTO_FUNC_READ_INPUT       0x04
#define BL_PROTO_FUNC_ENTER_BL         0x65
#define BL_PROTO_FUNC_ERASE            0x66
#define BL_PROTO_FUNC_WRITE            0x67
#define BL_PROTO_FUNC_VERIFY          0x68
#define BL_PROTO_FUNC_JUMP             0x69
#define BL_PROTO_FUNC_SET_TARGET      0x70
#define BL_PROTO_FUNC_QUERY_SESSION    0x74
#define BL_PROTO_FUNC_RESET           0x75

#define BL_PROTO_STATUS_SUCCESS        0x00
#define BL_PROTO_STATUS_ALREADY_BL     0x01
#define BL_PROTO_STATUS_INVALID_PARAM  0x02
#define BL_PROTO_STATUS_INVALID_ALIGN  0x02
#define BL_PROTO_STATUS_INVALID_RANGE  0x03
#define BL_PROTO_STATUS_WRITE_PROT     0x04
#define BL_PROTO_STATUS_ERASE_FAIL     0x05
#define BL_PROTO_STATUS_WRITE_FAIL     0x04
#define BL_PROTO_STATUS_VERIFY_FAIL    0x04
#define BL_PROTO_STATUS_LENGTH_LIMIT   0x05
#define BL_PROTO_STATUS_INVALID_APP    0x02
#define BL_PROTO_STATUS_INVALID_TARGET 0x01
#define BL_PROTO_STATUS_INVALID_ADDR   0x02
#define BL_PROTO_STATUS_UNKNOWN_ERROR  0xFF

#define BL_PROTO_TARGET_LOCAL          0x00
#define BL_PROTO_TARGET_SLAVE          0x01

#define BL_PROTO_MAX_DATA_LEN          128

typedef enum {
    BL_PROTO_STATE_IDLE = 0,
    BL_PROTO_STATE_BOOTLOADER,
    BL_PROTO_STATE_UPDATING
} bl_proto_state_t;

typedef enum {
    BL_PROTO_TARGET_LOCAL_MCU = 0,
    BL_PROTO_TARGET_SLAVE_MCU1,
    BL_PROTO_TARGET_SLAVE_MCU2,
    BL_PROTO_TARGET_MAX
} bl_proto_target_t;

typedef struct {
    bl_proto_state_t      state;
    bl_proto_target_t     target;
    uint16_t              slave_addr;
    uint32_t              app_start_addr;
    uint32_t              app_size;
    bool                  in_bootloader;
} bl_proto_session_t;

typedef struct {
    uint8_t  slave_addr;
    uint8_t  func_code;
    uint8_t  data[BL_PROTO_MAX_DATA_LEN];
    uint16_t data_len;
} bl_proto_request_t;

typedef struct {
    uint8_t  slave_addr;
    uint8_t  func_code;
    uint8_t  status;
    uint8_t  data[BL_PROTO_MAX_DATA_LEN];
    uint16_t data_len;
} bl_proto_response_t;

typedef struct {
    bl_proto_session_t session;
    bl_flash_t        *flash;
} bl_proto_t;

int bl_proto_init(bl_proto_t *proto, bl_flash_t *flash);
int bl_proto_deinit(bl_proto_t *proto);

int bl_proto_process_request(bl_proto_t *proto, const bl_proto_request_t *req, 
                             bl_proto_response_t *resp);

int bl_proto_handle_enter_bl(bl_proto_t *proto, bl_proto_response_t *resp);
int bl_proto_handle_erase(bl_proto_t *proto, const bl_proto_request_t *req, 
                          bl_proto_response_t *resp);
int bl_proto_handle_write(bl_proto_t *proto, const bl_proto_request_t *req, 
                          bl_proto_response_t *resp);
int bl_proto_handle_verify(bl_proto_t *proto, const bl_proto_request_t *req, 
                           bl_proto_response_t *resp);
int bl_proto_handle_jump(bl_proto_t *proto, const bl_proto_request_t *req, 
                         bl_proto_response_t *resp);
int bl_proto_handle_set_target(bl_proto_t *proto, const bl_proto_request_t *req, 
                               bl_proto_response_t *resp);
int bl_proto_handle_query_session(bl_proto_t *proto, bl_proto_response_t *resp);
int bl_proto_handle_reset(bl_proto_t *proto, bl_proto_response_t *resp);

bl_proto_session_t *bl_proto_get_session(bl_proto_t *proto);

#ifdef __cplusplus
}
#endif

#endif
