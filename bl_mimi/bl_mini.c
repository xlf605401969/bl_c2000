#include "bl_mini.h"
#include "board.h"
#include <string.h>

typedef void (*FunctionPointer)(void);

uint32_t BL_MINI_calculateCRC32(const uint16_t *data, uint32_t length)
{
    uint32_t crc = CRC32_INITIAL_VALUE;
    uint32_t i;
    uint32_t j;
    uint16_t word;

    for (i = 0; i < length; i++)
    {
        word = data[i];
        for (j = 0; j < 16; j++)
        {
            if ((crc ^ word) & 0x01)
            {
                crc = (crc >> 1) ^ CRC32_POLYNOMIAL;
            }
            else
            {
                crc = crc >> 1;
            }
            word = word >> 1;
        }
    }

    return crc ^ CRC32_XOR_OUT_VALUE;
}

BL_MINI_Status BL_MINI_verifyBLMain(void)
{
    uint32_t calculatedCRC;
    uint32_t storedCRC;
    const uint16_t *blMainFlashAddr;

    blMainFlashAddr = (const uint16_t *)BL_MAIN_FLASH_START;

    calculatedCRC = BL_MINI_calculateCRC32(blMainFlashAddr, BL_MAIN_FLASH_SIZE - 2);

    storedCRC = *((const uint32_t *)BL_MAIN_CRC_ADDR);

    if (calculatedCRC == storedCRC)
    {
        return BL_MINI_OK;
    }
    else
    {
        return BL_MINI_ERROR_CRC_FAILED;
    }
}

BL_MINI_Status BL_MINI_copyBLMainToRAM(void)
{
    const uint16_t *srcAddr;
    uint16_t *dstAddr;
    uint32_t i;

    if (BL_MAIN_FLASH_START == 0 || BL_MAIN_RAM_ADDR == 0)
    {
        return BL_MINI_ERROR_INVALID_ADDRESS;
    }

    if (BL_MAIN_FLASH_SIZE == 0)
    {
        return BL_MINI_ERROR_INVALID_SIZE;
    }

    srcAddr = (const uint16_t *)BL_MAIN_FLASH_START;
    dstAddr = (uint16_t *)BL_MAIN_RAM_ADDR;

    for (i = 0; i < BL_MAIN_FLASH_SIZE; i++)
    {
        dstAddr[i] = srcAddr[i];
    }

    return BL_MINI_OK;
}

void BL_MINI_jumpToBLMain(void)
{
    FunctionPointer blMainEntry;

    blMainEntry = (FunctionPointer)BL_MAIN_RAM_ADDR;

    blMainEntry();

    while (1)
    {
    }
}

int main(void)
{
    BL_MINI_Status status;

    Device_init();

    Device_initGPIO();

    status = BL_MINI_verifyBLMain();

    if (status != BL_MINI_OK)
    {
        while (1)
        {
        }
    }

    status = BL_MINI_copyBLMainToRAM();

    if (status != BL_MINI_OK)
    {
        while (1)
        {
        }
    }

    BL_MINI_jumpToBLMain();

    return 0;
}
