#ifndef BL_PROTOCOL_H
#define BL_PROTOCOL_H

/**
 * @file bl_protocol.h
 * @brief Bootloader协议处理接口定义
 *
 * 基于Modbus的引导加载程序协议，支持本地MCU和从MCU的固件更新。
 * 使用会话状态机制实现通用的擦除、编程、验证和跳转操作。
 */

#include <stdint.h>
#include <stdbool.h>
#include "bl_common.h"
#include "bl_flash.h"
#include "bl_main.h"
#include "lwmb.h"

#ifdef __cplusplus
extern "C"
{
#endif

#define BL_PROTO_MAJOR_VERSION 0x01        /**< 协议主版本号 */
#define BL_PROTO_MINOR_VERSION 0x00        /**< 协议次版本号 */

#define BL_APP_INFO_SIZE 64                                     /**< app_info结构体大小(按地址) */
#define BL_APP_INFO_ADDR (BL_APP_START_ADDR - BL_APP_INFO_SIZE) /**< app_info结构体存储地址 */

/**
 * @brief 协议功能码定义
 */
#define BL_PROTO_FUNC_READ_INPUT 0x04       /**< 读输入寄存器 */
#define BL_PROTO_FUNC_ENTER_BL 0x65         /**< 进入引导加载程序模式 */
#define BL_PROTO_FUNC_ERASE 0x66            /**< 擦除闪存 */
#define BL_PROTO_FUNC_WRITE 0x67            /**< 写入闪存 */
#define BL_PROTO_FUNC_FLUSH_CACHE 0x68      /**< 刷新FLASH缓存 */
#define BL_PROTO_FUNC_JUMP 0x69             /**< 跳转到应用程序 */
#define BL_PROTO_FUNC_FINISH_APP_WRITE 0x6A /**< 完成APP写入 */
#define BL_PROTO_FUNC_SET_TARGET 0x70       /**< 设置会话目标 */
#define BL_PROTO_FUNC_QUERY_SESSION 0x74    /**< 查询会话状态 */
#define BL_PROTO_FUNC_RESET 0x75            /**< 重置设备 */

/**
 * @brief 协议返回状态码定义（由modbus返回）
 *
 */
#define BL_PROTO_STATUS_SUCCESS 0x00       /**< 成功 */
#define BL_PROTO_STATUS_INVALID_APP 0x01   /**< 无效应用程序 */
#define BL_PROTO_STATUS_INVALID_RANGE 0x02 /**< 无效范围 */
#define BL_PROTO_STATUS_ERASE_FAIL 0x03    /**< 擦除失败 */
#define BL_PROTO_STATUS_WRITE_FAIL 0x04    /**< 写入失败 */
#define BL_PROTO_STATUS_ADDR_UNALIGN 0x05  /**< 地址未对齐 */
#define BL_PROTO_STATUS_ERROR 0xFF         /**< 错误 */

#define BL_PROTO_TARGET_LOCAL 0x00
#define BL_PROTO_TARGET_SLAVE 0x01

#define BL_PROTO_MAX_RX_DATA_LEN (LWMB_RX_MAX_LENGTH - 10)
#define BL_PROTO_MAX_TX_DATA_LEN (LWMB_TX_MAX_LENGTH - 10)

typedef enum
{
    BL_PROTO_STATE_IDLE = 0,
    BL_PROTO_STATE_BOOTLOADER,
    BL_PROTO_STATE_UPDATING
} bl_proto_state_t;

typedef enum
{
    BL_PROTO_TARGET_LOCAL_MCU = 0,
    BL_PROTO_TARGET_SLAVE_MCU1,
    BL_PROTO_TARGET_SLAVE_MCU2,
    BL_PROTO_TARGET_MAX
} bl_proto_target_t;

/**
 * @brief 应用程序信息结构体
 *
 * 存储在应用程序起始地址前64字节的位置，包含应用程序的元数据信息
 */
typedef struct
{
    uint32_t magic;         /**< 魔数标识 (0xDEADBEEF) */
    uint8_t valid_flag;     /**< 有效标志位 (0xAA = 有效) */
    uint32_t entry_addr;    /**< 应用程序入口地址 */
    uint16_t major_version; /**< 主版本号 */
    uint16_t minor_version; /**< 次版本号 */
    uint32_t build_version; /**< 构建版本号 */
    uint32_t app_length;    /**< 应用程序长度 (末地址-首地址) */
    uint32_t crc32;         /**< CRC32校验码 */
    uint32_t timestamp;     /**< 时间戳 */
    uint8_t reserved[3];   /**< 保留字段，用于未来扩展 */
} bl_app_info_t;

typedef struct
{
    uint8_t slave_addr;
    uint8_t func_code;
    uint8_t *data;
    uint16_t data_len;
} bl_proto_request_t;

typedef struct
{
    uint8_t slave_addr;
    uint8_t func_code;
    uint8_t *data;
    uint16_t data_len;
} bl_proto_response_t;

typedef struct
{
    bl_proto_state_t state;
    uint32_t app_start_addr;
    uint32_t app_max_size;
    bool in_bootloader;
    int32_t last_error;
    bl_flash_t *flash;
    bl_app_info_t app_info;
} bl_proto_t;

int bl_proto_init(bl_proto_t *proto, bl_flash_t *flash);
int bl_proto_deinit(bl_proto_t *proto);

lwmb_err_t bl_proto_process_request(bl_proto_t *proto, const bl_proto_request_t *req,
                                bl_proto_response_t *resp);

#ifdef __cplusplus
}
#endif

#endif
