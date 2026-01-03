;//###########################################################################
;//
;// FILE:  f2838x_codestartbranch.asm
;//
;// TITLE: Branch for redirecting code execution after boot.
;//
;// For these examples, code_start is the first code that is executed after
;// exiting the boot ROM code.
;//
;// The codestart section in the linker cmd file is used to physically place
;// this code at the correct memory location.  This section should be placed
;// at the location the BOOT ROM will re-direct the code to.  For example,
;// for boot to FLASH this code will be located at 0x3f7ff6.
;//
;// In addition, the example F2838x projects are setup such that the codegen
;// entry point is also set to the code_start label.  This is done by linker
;// option -e in the project build options.  When the debugger loads the code,
;// it will automatically set the PC to the "entry point" address indicated by
;// the -e linker option.  In this case the debugger is simply assigning the PC,
;// it is not the same as a full reset of the device.
;//
;// The compiler may warn that the entry point for the project is other then
;//  _c_init00.  _c_init00 is the C environment setup and is run before
;// main() is entered. The code_start code will re-direct the execution
;// to _c_init00 and thus there is no worry and this warning can be ignored.
;//
;//###########################################################################
;//
;//
;// $Copyright:
;// Copyright (C) 2022 Texas Instruments Incorporated - http://www.ti.com
;//
;// Redistribution and use in source and binary forms, with or without 
;// modification, are permitted provided that the following conditions 
;// are met:
;// 
;//   Redistributions of source code must retain the above copyright 
;//   notice, this list of conditions and the following disclaimer.
;// 
;//   Redistributions in binary form must reproduce the above copyright
;//   notice, this list of conditions and the following disclaimer in the 
;//   documentation and/or other materials provided with the   
;//   distribution.
;// 
;//   Neither the name of Texas Instruments Incorporated nor the names of
;//   its contributors may be used to endorse or promote products derived
;//   from this software without specific prior written permission.
;// 
;// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 
;// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT 
;// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
;// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT 
;// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, 
;// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT 
;// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
;// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
;// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT 
;// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE 
;// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
;// $
;//###########################################################################

***********************************************************************

WD_DISABLE  .set  1    ;set to 1 to disable WD, else set to 0

    .ref _c_int00
    .global code_start


***********************************************************************
* Function: codestart section
*
* Description: Branch to code starting point
***********************************************************************

    .sect "codestart"
    .retain

code_start:
    .if WD_DISABLE == 1
        LB wd_disable       ;Branch to watchdog disable code
    .else
	    LB _CopyTextToRAM
        LB _c_int00         ;Branch to start of boot._asm in RTS library
    .endif

;end codestart section

***********************************************************************
* Function: wd_disable
*
* Description: Disables the watchdog timer
***********************************************************************
    .if WD_DISABLE == 1

    .ref    _Flash_text_Start
    .ref    _Flash_text_Size
    .ref    _Ram_text_Start
    .sect ".flash_res_funcs"
    .align  4

wd_disable:
    SETC OBJMODE        ;Set OBJMODE for 28x object code
    EALLOW              ;Enable EALLOW protected register access
    MOVZ DP, #7029h>>6  ;Set data page for WDCR register
    MOV @7029h, #0068h  ;Set WDDIS bit in WDCR to disable WD
    EDIS                ;Disable EALLOW protected register access
****************************************************************************
;* 步骤1：加载拷贝地址和长度（参考官方BOOT.ASM，分高低16位加载32位地址）
;* 修正点：拷贝长度直接加载，无需右移÷2
****************************************************************************
; 源地址（Flash）：_Flash_text_Start → 加载到XAR0（AR0+AH）
    MOVL    XAR7, #_Flash_text_Start   ; 加载32位源地址到XAR0

; 目标地址（RAM）：_RAM_text_Start → 加载到XAR1（AR1+AL）
    MOVL    XAR6, #_Ram_text_Start     ; 加载32位目标地址到XAR1

; 拷贝长度：_Flash_text_Size（16位字的总个数）→ 直接加载到ACC，然后存入AR2（循环计数器）
	MOVL    XAR2, #_Flash_text_Size
    MOV     AL, AR2                    ; 将低16位长度存入AR2（假设长度不超过65535，所以忽略AH）

****************************************************************************
;* 步骤2：批量16位拷贝（参考官方BOOT.ASM，用PREAD+RPT指令，高效块拷贝）
****************************************************************************
; 官方风格块拷贝：RPT重复拷贝，PREAD从程序存储区（Flash）读取到数据存储区（RAM）
    RPT     AL                        ; 重复AR2次（_Flash_text_Size低16位字长，无需修正）
||  PREAD   *XAR6++, *XAR7               ; 并行拷贝：[XAR1] = [XAR0]，地址自动自增2（16位对齐）
    LB _c_int00         ;Branch to start of boot._asm in RTS library

    .endif

;end wd_disable

    .end

;//
;// End of file.
;//
