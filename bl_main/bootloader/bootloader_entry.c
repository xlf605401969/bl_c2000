#include "bl_main.h"
#include "device/driverlib/cpu.h"

static bl_main_t g_bootloader;

void bootloader_main(void)
{
    int result;

    result = bl_main_init(&g_bootloader);
    if (result != BL_FLASH_SUCCESS) {
        while (1) {
            CPU_delay(1000);
        }
    }

    while (1) {
        bl_main_process(&g_bootloader);
        
        uint32_t tick = 0;
        bl_main_tick(&g_bootloader, tick);
        
        CPU_delay(1000);
    }
}
