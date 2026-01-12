/**
 * @file bl_time.h
 * @brief 时间管理接口定义
 *
 * 提供基于硬件定时器的延时和超时检查功能。
 * 所有时间单位以微秒为基准，避免除法操作。
 */

#ifndef BL_TIME_H
#define BL_TIME_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief 初始化时间模块
 */
void bl_time_init();

/**
 * @brief 毫秒延时宏(转换为微秒)
 * @param ms 延时时间(毫秒)
 */
#define bl_time_delay_ms(ms) bl_time_delay_us((ms) * 1000)

/**
 * @brief 微秒级阻塞延时
 * @param us 延时时间(微秒)
 */
void bl_time_delay_us(uint32_t us);

/**
 * @brief 超时结构体
 */
typedef struct {
    int32_t start_cnt;   /**< 起始计数值 */
    int32_t timeout_cnt; /**< 超时计数值 */
    int32_t period_cnt;  /**< 周期计数值 */
    bool periodic;       /**< 周期标志 */
} bl_timeout_t;

/**
 * @brief 初始化超时结构体(单次超时)
 * @param timeout 超时结构体指针
 * @param timeout_us 超时时间(微秒)
 */
void bl_timeout_init(bl_timeout_t *timeout, uint32_t timeout_us);

/**
 * @brief 初始化超时结构体(周期性超时)
 * @param timeout 超时结构体指针
 * @param period_us 周期时间(微秒)
 */
void bl_timeout_init_periodic(bl_timeout_t *timeout, uint32_t period_us);

/**
 * @brief 检查超时是否到期
 * @param timeout 超时结构体指针
 * @return 超时返回true，否则返回false
 *
 * 对于周期性超时，每次到期后会自动重置起始时间。
 */
bool bl_timeout_is_expired(bl_timeout_t *timeout);

/**
 * @brief 检查超时并获取已过时间
 * @param timeout 超时结构体指针
 * @param elapsed_us 输出已过时间(微秒)
 * @return 超时返回true，否则返回false
 */
bool bl_timeout_check(bl_timeout_t *timeout, uint32_t *elapsed_us);

#ifdef __cplusplus
}
#endif

#endif
