/**
 * @file bl_common.h
 * @brief Bootloader公共定义
 *
 * 定义通用的返回值和错误码。
 */

#ifndef BL_H
#define BL_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C"
{
#endif

/**
 * @brief 应用程序起始地址
 */
#define BL_APP_START_ADDR 0x088000         /**< 应用程序起始地址 */
#define BL_APP_DEFAULT_ENTRY_ADDR 0x088040 /**< 默认应用程序入口地址 */
#define BL_APP_MAX_SIZE 0x00030000         /**< 应用程序最大大小 */

#define BL_APP_INFO_SIZE 0x40              /**< app_info结构体大小(按地址) */
#define BL_APP_INFO_ADDR BL_APP_START_ADDR /**< app_info结构体存储地址 */

#define BL_STAY_IN_BOOTLOADER_ADDR 0x00CFFE /**< 在该地址检测到为0xDEADBEEF时，保持在Bootloader */

/**
 * @brief 应用程序信息结构体
 *
 * 存储在应用程序起始地址前64字节的位置，包含应用程序的元数据信息
 */
typedef struct
{
    uint32_t magic;          /**< 魔数标识 (0xDEADBEEF) */
    uint32_t entry_addr;     /**< 应用程序入口地址 */
    uint16_t major_version;  /**< 主版本号 */
    uint16_t minor_version;  /**< 次版本号 */
    uint32_t app_start_addr; /**< 应用程序起始地址 */
    uint32_t app_length;     /**< 应用程序长度 (末地址-首地址) */
    uint32_t crc32;          /**< CRC32校验码 */
    uint32_t timestamp;      /**< 时间戳 */
    uint32_t git_commit_id;  /**< Git提交ID */
    uint16_t valid_flag;     /**< 有效标志位 (0xAA55 = 有效) */
    uint16_t git_tag_length; /**< Git标签长度 */
    char git_tag[32];        /**< Git标签,放在结构体随后的地址中，每个字符占一个地址 */
} bl_app_info_t;

/**
 * @brief 返回值定义
 */
#define BL_SUCCESS 0        /**< 操作成功 */
#define BL_ERROR -1         /**< 通用错误 */
#define BL_INVALID_PARAM -2 /**< 无效参数 */
#define BL_TIMEOUT -3       /**< 超时 */

/**
 * @brief FLASH错误码定义
 */
#define BL_FLASH_ERROR -10          /**< FLASH错误 */
#define BL_FLASH_ERASE_FAILED -11   /**< 擦除失败 */
#define BL_FLASH_PROGRAM_FAILED -12 /**< 编程失败 */
#define BL_FLASH_VERIFY_FAILED -13  /**< 校验失败 */
#define BL_FLASH_CACHE_ERROR -14    /**< 缓存错误 */

#ifdef __cplusplus
}
#endif

#endif
