/**
 * @file bl_main.h
 * @brief Bootloader主模块头文件
 */

#ifndef BL_MAIN_H
#define BL_MAIN_H

#include <stdint.h>
#include <stdbool.h>
#include "bl_flash.h"
#include "bl_protocol.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief 初始化bootloader主模块
 */
void bl_main_init();

/**
 * @brief 处理bootloader主循环
 */
void bl_main_process();

/**
 * @brief bootloader定时器回调
 * @param tick 定时器计数值
 */
void bl_main_tick(uint32_t tick);

/**
 * @brief 反初始化bootloader主模块
 * @return 成功返回BL_SUCCESS
 */
int bl_main_deinit();

#ifdef __cplusplus
}
#endif

#endif
