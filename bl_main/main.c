#include "bl_main.h"
#include "bootloader/bl_time.h"
#include "board.h"

static bl_timeout_t g_main_tick_timeout;

int main_in_ram()
{
    Device_init();

    Board_init();

    bl_main_init();

    bl_time_init();

    bl_timeout_init_periodic(&g_main_tick_timeout, 100);

    CPUTimer_startTimer(BASE_1ms_TIMER_BASE);

    while (1) {
        if (bl_timeout_is_expired(&g_main_tick_timeout)) {
            bl_main_tick(100);
        }
        
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
