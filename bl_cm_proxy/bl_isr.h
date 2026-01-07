#ifndef BL_FLASH_CM_ISR_H
#define BL_FLASH_CM_ISR_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C"
{
#endif

void cpu1tocm_ipc0_isr(void);

#ifdef __cplusplus
}
#endif

#endif
