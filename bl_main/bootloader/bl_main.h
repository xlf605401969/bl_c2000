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

void bl_main_init();

void bl_main_process();

void bl_main_tick(uint32_t tick);

int bl_main_deinit();

#ifdef __cplusplus
}
#endif

#endif
