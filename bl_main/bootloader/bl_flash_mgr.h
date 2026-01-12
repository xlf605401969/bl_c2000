/**
 * @file bl_flash_mgr.h
 * @brief Flash管理器接口定义
 *
 * 提供统一的Flash操作接口，支持本地Flash和CM Flash的切换。
 * 使用操作函数表实现不同Flash设备的抽象。
 */

#ifndef BL_FLASH_MGR_H
#define BL_FLASH_MGR_H

#include <stdint.h>
#include <stdbool.h>
#include "bl_common.h"

#ifdef __cplusplus
extern "C"
{
#endif

/**
 * @brief Flash类型枚举
 */
typedef enum
{
    BL_FLASH_TYPE_LOCAL = 0, /**< 本地Flash */
    BL_FLASH_TYPE_CM = 1,    /**< CM Flash */
    BL_FLASH_TYPE_MAX        /**< 最大类型值 */
} bl_flash_type_t;

/**
 * @brief Flash操作函数表
 */
typedef struct
{
    int (*erase)(uint32_t addr, uint32_t size, uint32_t* actual_addr, uint32_t* actual_size);  /**< 擦除函数 */
    int (*write)(uint32_t addr, const uint16_t* data, uint32_t size);                          /**< 写入函数 */
    int (*read)(uint32_t addr, uint16_t *data, uint32_t size);                                 /**< 读取函数 */
    int (*flush)(void);                                                                         /**< 刷新缓存函数 */
    uint32_t (*get_size)(void);                                                                /**< 获取大小函数 */
    uint8_t (*addr_to_sector)(uint32_t addr);                                                  /**< 地址转扇区号函数 */
    uint32_t (*get_sector_start_addr)(uint8_t sector_num);                                     /**< 获取扇区起始地址函数 */
} bl_flash_ops_t;

/**
 * @brief Flash管理器结构体
 */
typedef struct
{
    bl_flash_type_t type;     /**< Flash类型 */
    bl_flash_ops_t ops;       /**< 操作函数表 */
    bool initialized;         /**< 初始化标志 */
} bl_flash_mgr_t;

/**
 * @brief Flash管理器数量
 */
#define BL_FLASH_MGR_COUNT 2

/**
 * @brief 初始化本地Flash管理器
 * @param mgr_idx 管理器索引
 * @return 成功返回BL_SUCCESS，失败返回错误码
 */
int bl_flash_mgr_init_local(uint8_t mgr_idx);

/**
 * @brief 初始化CM Flash管理器
 * @param mgr_idx 管理器索引
 * @return 成功返回BL_SUCCESS，失败返回错误码
 */
int bl_flash_mgr_init_cm(uint8_t mgr_idx);

/**
 * @brief 反初始化Flash管理器
 * @param mgr_idx 管理器索引
 * @return 成功返回BL_SUCCESS，失败返回错误码
 */
int bl_flash_mgr_deinit(uint8_t mgr_idx);

/**
 * @brief 激活指定的Flash管理器
 * @param mgr_idx 管理器索引
 * @return 成功返回BL_SUCCESS，失败返回错误码
 */
int bl_flash_mgr_activate(uint8_t mgr_idx);

/**
 * @brief 获取当前激活的Flash管理器
 * @return Flash管理器指针，失败返回NULL
 */
bl_flash_mgr_t* bl_flash_mgr_get_active(void);

#ifdef __cplusplus
}
#endif

#endif
