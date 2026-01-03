#include "bl_main.h"
#include "board.h"


#define TIMER_PERIOD_US 1000000UL
#define TIMER_TICK_PERIOD_US 1000
int32_t last_cnt = 0;
int32_t tick_cnt = 0;


void check_timer(void)
{
    int32_t current_cnt = CPUTimer_getTimerCount(BASE_1ms_TIMER_BASE);
    // 减计数，判断是否到了1ms
    if (last_cnt - current_cnt >= TIMER_TICK_PERIOD_US) {
        last_cnt = current_cnt;
        bl_main_tick(TIMER_TICK_PERIOD_US);
        tick_cnt += 1;
    }
    else if (last_cnt - current_cnt < 0) {
        last_cnt += TIMER_PERIOD_US;
    }
}

int main_in_ram()
{
    Device_init();

    Board_init();

    bl_main_init();

    CPUTimer_startTimer(BASE_1ms_TIMER_BASE);

    while (1) {
        check_timer();
        bl_main_process();
    }
}

extern uint32_t _Ram_ramfunc_Start, _Flash_ramfunc_Start, _Flash_ramfunc_Size;

__attribute__((section(".flash_res_funcs")))
int main()
{
    SysCtl_disableWatchdog();
    uint16_t* sourceAddr = (uint16_t*)&_Flash_ramfunc_Start;
    uint16_t* targetAddr = (uint16_t*)&_Ram_ramfunc_Start;

    for (uint32_t i = 0; i < (uint32_t)&_Flash_ramfunc_Size; i++)
    {
        *(targetAddr++) = *(sourceAddr++);
    }

    main_in_ram();
}
