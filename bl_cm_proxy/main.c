#include "cm.h"
#include "bootloader/bl_cm_ipc.h"
#include "device/driverlib_cm/interrupt.h"
#include "device/driverlib_cm/inc/hw_ints.h"

int main_in_ram()
{
    CM_init();

    bl_flash_cm_ipc_init();

    Interrupt_enable(INT_CPU1TOCMIPC0);

    while (1) {

    }
}

int main()
{
    main_in_ram();
}