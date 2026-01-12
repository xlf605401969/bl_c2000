/**
 * @file bl_flash_cm.h
 * @brief CM Flash驱动接口定义
 *
 * 通过IPC与CM核心通信，实现对CM Flash的远程操作。
 * 所有地址和长度参数均以16位字为基本单位。
 */

#ifndef BL_FLASH_CM_H
#define BL_FLASH_CM_H

#include <stdint.h>
#include <stdbool.h>
#include "bl_common.h"

#ifdef __cplusplus
extern "C"
{
#endif

/**
 * @brief CM Flash数据缓冲区大小(以16位字为单位)
 */
#define BL_FLASH_CM_DATA_BUFFER_SIZE 256

/**
 * @brief CM Flash命令类型枚举
 */
typedef enum
{
    BL_FLASH_CM_CMD_READ = 0x04,                   /**< 读取命令 */
    BL_FLASH_CM_CMD_ERASE = 0x66,                 /**< 擦除命令 */
    BL_FLASH_CM_CMD_WRITE = 0x67,                  /**< 写入命令 */
    BL_FLASH_CM_CMD_FLUSH = 0x68,                  /**< 刷新缓存命令 */
    BL_FLASH_CM_CMD_GET_SIZE = 0x69,               /**< 获取大小命令 */
    BL_FLASH_CM_CMD_ADDR_TO_SECTOR = 0x6A,        /**< 地址转扇区号命令 */
    BL_FLASH_CM_CMD_GET_SECTOR_START_ADDR = 0x6B   /**< 获取扇区起始地址命令 */
} bl_flash_cm_cmd_type_t;

/**
 * @brief CM Flash命令结构体
 */
typedef struct
{
    uint32_t cmd;                                 /**< 命令类型 */
    uint32_t addr;                                /**< 操作地址(16位字地址) */
    uint32_t size;                                /**< 操作大小(以16位字为单位) */
    uint32_t data_offset;                         /**< 数据偏移 */
    uint16_t data[BL_FLASH_CM_DATA_BUFFER_SIZE];  /**< 数据缓冲区 */
} bl_flash_cm_cmd_t;

/**
 * @brief CM Flash响应结构体
 */
typedef struct
{
    int32_t result;                               /**< 操作结果 */
    uint32_t actual_addr;                         /**< 实际操作地址 */
    uint32_t actual_size;                         /**< 实际操作大小 */
    uint32_t written_size;                        /**< 已写入大小 */
    uint16_t data[BL_FLASH_CM_DATA_BUFFER_SIZE];  /**< 数据缓冲区 */
} bl_flash_cm_resp_t;

/**
 * @brief 初始化CM Flash驱动
 * @return 成功返回BL_SUCCESS，失败返回错误码
 */
int bl_flash_cm_init(void);

/**
 * @brief 反初始化CM Flash驱动
 * @return 成功返回BL_SUCCESS，失败返回错误码
 */
int bl_flash_cm_deinit(void);

/**
 * @brief 擦除CM Flash指定地址范围
 * @param addr 起始地址(16位字地址)
 * @param size 擦除大小(以16位字为单位)
 * @param actual_addr 实际擦除起始地址(16位字地址)
 * @param actual_size 实际擦除大小(以16位字为单位)
 * @return 成功返回BL_SUCCESS，失败返回错误码
 */
int bl_flash_cm_erase(uint32_t addr, uint32_t size, uint32_t* actual_addr, uint32_t* actual_size);

/**
 * @brief 向CM Flash写入数据
 * @param addr 写入起始地址(16位字地址)
 * @param data 写入数据缓冲区指针
 * @param size 写入数据大小(以16位字为单位)
 * @return 成功返回BL_SUCCESS，失败返回错误码
 */
int bl_flash_cm_write(uint32_t addr, const uint16_t* data, uint32_t size);

/**
 * @brief 从CM Flash读取数据
 * @param addr 读取起始地址(16位字地址)
 * @param data 读取数据缓冲区指针
 * @param size 读取数据大小(以16位字为单位)
 * @return 成功返回BL_SUCCESS，失败返回错误码
 */
int bl_flash_cm_read(uint32_t addr, uint16_t *data, uint32_t size);

/**
 * @brief 刷新CM Flash缓存
 * @return 成功返回BL_SUCCESS，失败返回错误码
 */
int bl_flash_cm_flush(void);

/**
 * @brief 获取CM Flash总大小
 * @return Flash总大小(以16位字为单位)，失败返回0
 */
uint32_t bl_flash_cm_get_size(void);

/**
 * @brief 根据地址查找所在扇区
 * @param addr 16位字地址
 * @return 物理扇区号(1-13)，未找到返回0xFF
 */
uint8_t bl_flash_cm_addr_to_sector(uint32_t addr);

/**
 * @brief 获取扇区起始地址
 * @param sector_num 物理扇区号(1-13)
 * @return 扇区起始地址(16位字地址)，失败返回0xFFFFFFFF
 */
uint32_t bl_flash_cm_get_sector_start_addr(uint8_t sector_num);

#ifdef __cplusplus
}
#endif

#endif
