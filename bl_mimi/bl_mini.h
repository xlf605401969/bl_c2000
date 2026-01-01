#ifndef BL_MINI_H
#define BL_MINI_H

#include <stdint.h>
#include <stdbool.h>

#define BL_MINI_VERSION_MAJOR    1
#define BL_MINI_VERSION_MINOR    0

#define BL_MAIN_FLASH_START      0x082000
#define BL_MAIN_FLASH_END        0x083FFF
#define BL_MAIN_FLASH_SIZE       0x2000

#define BL_MAIN_CRC_ADDR         0x083FFC

#define BL_MAIN_RAM_ADDR         0x008000

#define CRC32_POLYNOMIAL         0x04C11DB7
#define CRC32_INITIAL_VALUE      0xFFFFFFFF
#define CRC32_XOR_OUT_VALUE      0xFFFFFFFF

typedef enum {
    BL_MINI_OK = 0,
    BL_MINI_ERROR_CRC_FAILED,
    BL_MINI_ERROR_INVALID_ADDRESS,
    BL_MINI_ERROR_INVALID_SIZE,
    BL_MINI_ERROR_COPY_FAILED,
    BL_MINI_ERROR_JUMP_FAILED
} BL_MINI_Status;

uint32_t BL_MINI_calculateCRC32(const uint16_t *data, uint32_t length);
BL_MINI_Status BL_MINI_verifyBLMain(void);
BL_MINI_Status BL_MINI_copyBLMainToRAM(void);
void BL_MINI_jumpToBLMain(void);

#endif
