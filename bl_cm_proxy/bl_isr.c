#include "bl_isr.h"
#include "bl_cm_ipc.h"
#include "driverlib_cm.h"
#include "cm.h"
#include "ipc.h"
#include "interrupt.h"

#ifdef __cplusplus
#pragma CODE_SECTION(".TI.ramfunc");
#else
#pragma CODE_SECTION(cpu1tocm_ipc0_isr, ".TI.ramfunc");
#endif
void cpu1tocm_ipc0_isr(void)
{
    if (IPC_isFlagBusyRtoL(IPC_CM_L_CPU1_R, IPC_FLAG0)) {
        bl_flash_cm_ipc_process_cmd();
    }
}
