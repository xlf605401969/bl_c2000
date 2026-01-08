#include "bl_time.h"
#include "board.h"

#define TIMER_PERIOD_US 1000000UL

void bl_time_init()
{
}

void bl_time_delay_us(uint32_t us)
{
    int32_t start_cnt = CPUTimer_getTimerCount(BASE_1ms_TIMER_BASE);
    
    while (1) {
        int32_t current_cnt = CPUTimer_getTimerCount(BASE_1ms_TIMER_BASE);
        int32_t elapsed = start_cnt - current_cnt;
        
        if (elapsed < 0) {
            elapsed += TIMER_PERIOD_US;
        }
        
        if (elapsed >= us) {
            break;
        }
    }
}

void bl_timeout_init(bl_timeout_t *timeout, uint32_t timeout_us)
{
    if (timeout != NULL) {
        timeout->start_cnt = CPUTimer_getTimerCount(BASE_1ms_TIMER_BASE);
        timeout->timeout_cnt = timeout_us;
        timeout->period_cnt = 0;
        timeout->periodic = false;
    }
}

void bl_timeout_init_periodic(bl_timeout_t *timeout, uint32_t period_us)
{
    if (timeout != NULL) {
        timeout->start_cnt = CPUTimer_getTimerCount(BASE_1ms_TIMER_BASE);
        timeout->timeout_cnt = period_us;
        timeout->period_cnt = period_us;
        timeout->periodic = true;
    }
}

bool bl_timeout_is_expired(bl_timeout_t *timeout)
{
    if (timeout == NULL) {
        return false;
    }
    
    int32_t current_cnt = CPUTimer_getTimerCount(BASE_1ms_TIMER_BASE);
    int32_t elapsed = timeout->start_cnt - current_cnt;
    
    if (elapsed < 0) {
        elapsed += TIMER_PERIOD_US;
    }
    
    if (elapsed >= timeout->timeout_cnt) {
        if (timeout->periodic) {
            timeout->start_cnt = current_cnt;
        }
        return true;
    }
    
    return false;
}

bool bl_timeout_check(bl_timeout_t *timeout, uint32_t *elapsed_us)
{
    if (timeout == NULL) {
        return false;
    }
    
    int32_t current_cnt = CPUTimer_getTimerCount(BASE_1ms_TIMER_BASE);
    int32_t elapsed = timeout->start_cnt - current_cnt;
    
    if (elapsed < 0) {
        elapsed += TIMER_PERIOD_US;
    }
    
    if (elapsed_us != NULL) {
        *elapsed_us = elapsed;
    }
    
    if (elapsed >= timeout->timeout_cnt) {
        if (timeout->periodic) {
            timeout->start_cnt = current_cnt;
        }
        return true;
    }
    
    return false;
}
