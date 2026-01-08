#ifndef BL_TIME_H
#define BL_TIME_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

void bl_time_init();

#define bl_time_delay_ms(ms) bl_time_delay_us((ms) * 1000)

void bl_time_delay_us(uint32_t us);

typedef struct {
    int32_t start_cnt;
    int32_t timeout_cnt;
    int32_t period_cnt;
    bool periodic;
} bl_timeout_t;

void bl_timeout_init(bl_timeout_t *timeout, uint32_t timeout_us);

void bl_timeout_init_periodic(bl_timeout_t *timeout, uint32_t period_us);

bool bl_timeout_is_expired(bl_timeout_t *timeout);

bool bl_timeout_check(bl_timeout_t *timeout, uint32_t *elapsed_us);

#ifdef __cplusplus
}
#endif

#endif
