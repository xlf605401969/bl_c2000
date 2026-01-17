MEMORY
{
   BOOT_RSVD        : origin = 0x000000, length = 0x0001B0     /* Part of M0, BOOT rom will use this for stack */
   RAMM0            : origin = 0x0001B0, length = 0x000250
   RAMM1            : origin = 0x000400, length = 0x000400     /* on-chip RAM block M1 */
   RAMD0            : origin = 0x00C000, length = 0x000800
   RAMD1            : origin = 0x00C800, length = 0x000800
   RAM_PROG_ALL		: origin = 0x008000, length = 0x003000

   /* Flash sectors */
   BEGIN            : origin = 0x080000, length = 0x000002
   FLASH_RES		: origin = 0x080002, length = 0x000200
   FLASH_PROG_ALL   : origin = 0x080202, length = 0x003DFE

   CPU1TOCPU2RAM    : origin = 0x03A000, length = 0x000800
   CPU2TOCPU1RAM    : origin = 0x03B000, length = 0x000800

   CPUTOCMRAM       : origin = 0x039000, length = 0x000800
   CMTOCPURAM       : origin = 0x038000, length = 0x000800

   CANA_MSG_RAM     : origin = 0x049000, length = 0x000800
   CANB_MSG_RAM     : origin = 0x04B000, length = 0x000800
   RESET            : origin = 0x3FFFC0, length = 0x000002
}


SECTIONS
{
   	codestart			: > BEGIN
	.flash_res_funcs	: > FLASH_RES
	.data 				: > RAM_PROG_ALL

    .TI.ramfunc:	LOAD = FLASH_PROG_ALL,
	                RUN = RAM_PROG_ALL,
	                LOAD_START(_Flash_ramfunc_Start),
	                LOAD_SIZE(_Flash_ramfunc_Size),
	                RUN_START(_Ram_ramfunc_Start),
	                ALIGN(4)

	.text :		LOAD = FLASH_PROG_ALL,
			    RUN = RAM_PROG_ALL,
			    LOAD_START(_Flash_text_Start),
			    LOAD_SIZE(_Flash_text_Size),
			    RUN_START(_Ram_text_Start),
			    ALIGN(4)

	.cinit :	> FLASH_RES

	.const :	LOAD = FLASH_PROG_ALL,
			    RUN = RAM_PROG_ALL,
			    ALIGN(4)
	.switch:    LOAD = FLASH_PROG_ALL,
			    RUN = RAM_PROG_ALL,
                LOAD_START(_Flash_switch_Start),
                LOAD_SIZE(_Flash_switch_Size),
                RUN_START(_Ram_switch_Start),
			    ALIGN(4)


   .reset           : > RESET, TYPE = DSECT /* not used, */
   .stack           : > RAMM0
   .bss             : > RAMM1 | RAMD0
   .bss:output      : > RAMM1
   .sysmem          : > RAMM1


   MSGRAM_CPU1_TO_CPU2 > CPU1TOCPU2RAM, type=NOINIT
   MSGRAM_CPU2_TO_CPU1 > CPU2TOCPU1RAM, type=NOINIT
   MSGRAM_CPU_TO_CM   > CPUTOCMRAM, type=NOINIT
   MSGRAM_CM_TO_CPU   > CMTOCPURAM, type=NOINIT
}

/*
//===========================================================================
// End of file.
//===========================================================================
*/
