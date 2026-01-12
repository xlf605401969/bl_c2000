/**
 * @file bl_config.h
 * @brief Bootloader配置参数定义
 *
 * 定义应用程序的起始地址、最大大小等配置参数。
 */

#ifndef BL_CONFIG_H
#define BL_CONFIG_H

#ifdef __cplusplus
extern "C"
{
#endif

/**
 * @brief 应用程序起始地址
 */
#define BL_APP_START_ADDR 0x088040                              /**< 应用程序起始地址 */
#define BL_APP_MAX_SIZE 0x00030000                              /**< 应用程序最大大小 */

#ifdef __cplusplus
}
#endif

#endif
