/*
 * lwmb_port_template.c
 * Modbus协议栈移植模板文件
 * 
 * 说明：
 * 1. 根据实际硬件平台实现以下函数
 * 2. 根据LWMB_FRAME_MODE宏选择实现帧模式或流模式的函数
 * 3. 帧模式：直接接收完整帧，无需超时机制
 * 4. 流模式：需要实现字符流的读取和可用数据检查
 */

#include "lwmb_port.h"
#include <stdint.h>
#include <stdbool.h>
#include "board.h"

/*
 * 硬件平台相关的头文件，根据实际情况修改
 * 例如：#include "uart.h" 或 #include "usart.h"
 */
// #include "your_hardware_uart.h"

/**
 * @brief 帧模式：启动接收一帧数据
 * @param buf 接收缓冲区指针
 * @param len 接收缓冲区长度
 * @param cplt 接收完成回调函数
 * @param error 接收错误回调函数
 */
#if LWMB_FRAME_MODE
void lwmb_start_recv_frame(uint8_t *buf, uint16_t len, void (*cplt)(uint8_t *data, uint16_t len), void (*error)())
{
    /*
     * 移植说明：
     * 1. 初始化硬件UART的接收功能
     * 2. 设置接收缓冲区和长度
     * 3. 注册接收完成和错误回调函数
     * 4. 启动接收
     */
    
    // 示例实现（根据实际硬件修改）
    // uart_init_receive(buf, len, cplt, error);
    // uart_start_receive();
    
    // 临时实现：直接调用完成回调，用户需要替换为实际硬件代码
    (void)buf;
    (void)len;
    (void)cplt;
    (void)error;
}

/**
 * @brief 帧模式：重置接收帧状态
 */
void lwmb_reset_recv_frame()
{
    /*
     * 移植说明：
     * 1. 重置硬件UART的接收状态
     * 2. 清除接收缓冲区
     */
    
    // 示例实现（根据实际硬件修改）
    // uart_reset_receive();
    
    // 临时实现：空函数，用户需要替换为实际硬件代码
}

#else /* !LWMB_FRAME_MODE */

/**
 * @brief 流模式：获取可用的流数据长度
 * @return 可用数据长度
 */
uint16_t lwmb_get_stream_avaliable_data(void)
{
    /*
     * 移植说明：
     * 1. 查询硬件UART接收缓冲区中的可用数据长度
     * 2. 返回可用数据字节数
     */
    
    uint16_t available = SCI_getRxFIFOStatus(BL_SCI_BASE);
    
    // 临时实现：返回0，用户需要替换为实际硬件代码
    return available;
}

/**
 * @brief 流模式：从流中读取数据
 * @param buf 接收缓冲区指针
 * @param len 要读取的数据长度
 * @return 实际读取的数据长度
 */
uint16_t lwmb_read_stream(uint8_t *buf, uint16_t len)
{
    /*
     * 移植说明：
     * 1. 从硬件UART接收缓冲区读取数据
     * 2. 读取长度不超过len
     * 3. 返回实际读取的字节数
     */
    
    uint16_t available = SCI_getRxFIFOStatus(BL_SCI_BASE);
    if (available == 0) {
        return 0;
    }

    if (available > len) {
        available = len;
    }

    for (uint16_t i = 0; i < available; i++) {
        buf[i] = SCI_readCharNonBlocking(BL_SCI_BASE);
    }

    return available;
}

#endif /* LWMB_FRAME_MODE */

/**
 * @brief 发送数据
 * @param data 要发送的数据指针
 * @param len 要发送的数据长度
 */
void lwmb_send_data(uint8_t *data, uint16_t len)
{
    /*
     * 移植说明：
     * 1. 检查数据长度，确保不超过硬件UART的发送缓冲区大小
     * 2. 将数据发送到硬件UART
     * 3. 等待发送完成或使用中断方式发送
     */
    
    // 限制发送长度，防止缓冲区溢出
    if (len > LWMB_TX_MAX_LENGTH) {
        len = LWMB_TX_MAX_LENGTH;
    }
    
    for (uint16_t i = 0; i < len; i++) {
        SCI_writeCharNonBlocking(BL_SCI_BASE, *data++);
        while (SCI_getTxFIFOStatus(BL_SCI_BASE) >= 10) {
            // 等待发送缓冲区有空间
        }
    }
}

/*
 * 可选：硬件中断处理函数
 * 如果硬件UART使用中断方式，需要实现中断处理函数
 * 例如：
 * 
 * void UART_IRQHandler(void)
 * {
 *     // 处理接收中断
 *     if (uart_is_receive_complete()) {
 *         // 调用接收完成回调
 *         // uart_get_received_data(buf, &len);
 *         // cplt(buf, len);
 *     }
 *     
 *     // 处理发送中断
 *     if (uart_is_send_complete()) {
 *         // 发送完成处理
 *     }
 *     
 *     // 处理接收错误
 *     if (uart_is_receive_error()) {
 *         // 调用接收错误回调
 *         // error();
 *     }
 * }
 */
