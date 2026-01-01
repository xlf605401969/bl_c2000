#include "lwmb.h"
#include "lwmbcrc.h"
#include "lwmb_port.h"
#include <stdint.h>
#include <string.h>

lwmb_context ctx;

// 使用lwmbcrc模块的CRC计算
static uint16_t crc16(uint8_t *data, uint16_t len)
{
    return lwmb_crc16(data, len);
}

static void lwmb_rx_frame_error_callback(void);
static void lwmb_rx_frame_callback(uint8_t *data, uint16_t len);

static void lwmb_start_tx_mb()
{
    // 启动Modbus发送
    if (ctx.mb_send_ready)
    {
        lwmb_send_data(ctx.tx_buf, ctx.tx_idx);
        ctx.mb_send_ready = 0; // 清除发送标记
    }
}

#if !LWMB_FRAME_MODE
// 流模式处理
static void process_stream(uint8_t *data, uint16_t len)
{
    // 缓存接收数据到单缓冲，只检查缓冲区边界
    if (ctx.rx_idx + len > LWMB_RX_MAX_LENGTH)
    {
        len = LWMB_RX_MAX_LENGTH - ctx.rx_idx;
        if (len == 0)
        {
            ctx.rx_idx = 0;
            ctx.state  = STATE_IDLE;
            return;
        }
    }

    memcpy(&ctx.rx_buf[ctx.rx_idx], data, len);
    ctx.rx_idx += len;
    ctx.last_rx_time = 0;        // 重置超时计时
    ctx.state        = STATE_RX; // 设置状态为接收中
}
#endif

static void lwmb_build_error_response(uint8_t *buf, uint8_t func, lwmb_err_t err)
{
    buf[0]     = ctx.rx_buf[0]; // 保留地址
    buf[1]     = func | 0x80;    // 错误响应功能码
    buf[2]     = (uint8_t)err;   // 错误码
    ctx.tx_idx = 3;              // 错误响应长度
}

// 检查并处理完整帧(由lwmb_poll调用)
static void check_complete_frame(void)
{
    // 直接使用单缓冲处理
    uint8_t *proc_buffer = ctx.rx_buf;
    uint16_t proc_len    = ctx.rx_idx;
    uint8_t *mb_send_buf = ctx.tx_buf;

    // 检查最小帧长度
    if (proc_len < 4)
    {
        // 帧长度不足，忽略
        return;
    }

    uint16_t crc       = crc16(proc_buffer, proc_len - 2);
    uint16_t frame_crc = (proc_buffer[proc_len - 1] << 8) | proc_buffer[proc_len - 2];

    if (crc == frame_crc)
    {
        uint8_t    addr = proc_buffer[0];
        uint8_t    func = proc_buffer[1];
        uint8_t   *data = &proc_buffer[2];
        uint16_t   data_len = proc_len - 4; // 减去地址、功能码和CRC
        lwmb_err_t res = LWMB_OK;
        
        // 调用自定义回调函数处理所有功能码
        if (ctx.func_callback != NULL)
        {
            res = ctx.func_callback(addr, func, data, data_len, mb_send_buf, &ctx.tx_idx);
        }
        else
        {
            res = LWMB_ERR_FUNC;
        }
        
        if (res == LWMB_OK)
        {
            // 计算CRC
            uint16_t response_crc = crc16(mb_send_buf, ctx.tx_idx);
            // 添加CRC到响应
            mb_send_buf[ctx.tx_idx++] = response_crc & 0xFF;        // CRC低字节
            mb_send_buf[ctx.tx_idx++] = (response_crc >> 8) & 0xFF; // CRC高字节
            ctx.mb_send_ready = 1; // 设置发送标记
        }
        else if (res == LWMB_OK_NO_REPLY)
        {
            // 如果没有回复，则不发送数据
            ctx.tx_idx = 0; // 清除发送索引
        }
        else
        {
            lwmb_build_error_response(mb_send_buf, func, res);
            ctx.tx_idx = 3; // 错误响应长度
            // 计算错误响应CRC
            uint16_t error_crc        = crc16(mb_send_buf, ctx.tx_idx);
            mb_send_buf[ctx.tx_idx++] = error_crc & 0xFF;        // CRC低字节
            mb_send_buf[ctx.tx_idx++] = (error_crc >> 8) & 0xFF; // CRC高字节
            ctx.mb_send_ready = 1; // 设置发送标记
        }
    }
    else
    {
        // CRC错误，发送错误响应
        uint8_t func = proc_buffer[1];
        lwmb_build_error_response(mb_send_buf, func, LWMB_ERR_CRC);
        ctx.tx_idx = 3; // 错误响应长度
        // 计算错误响应CRC
        uint16_t error_crc        = crc16(mb_send_buf, ctx.tx_idx);
        mb_send_buf[ctx.tx_idx++] = error_crc & 0xFF;        // CRC低字节
        mb_send_buf[ctx.tx_idx++] = (error_crc >> 8) & 0xFF; // CRC高字节
        ctx.mb_send_ready = 1; // 设置发送标记
    }
}

void lwmb_start()
{
    // 启动接收帧
    #if LWMB_FRAME_MODE
    lwmb_start_recv_frame(ctx.rx_buf, LWMB_RX_MAX_LENGTH, lwmb_rx_frame_callback, lwmb_rx_frame_error_callback);
    #endif
}

void lwmb_tick(uint32_t elapsed_us)
{
    #if !LWMB_FRAME_MODE
    // 仅流模式下需要超时机制，帧模式下接收到的帧即为完整帧
    if (ctx.state == STATE_RX)
    {
        ctx.last_rx_time += elapsed_us;
        // 流模式下，使用字符间超时时间
        if (ctx.last_rx_time > LWMB_STREAM_TIMEOUT_US)
        {
            ctx.state = STATE_RX_END; // 字符间超时，标记为接收结束
        }
    }
    #endif
}

// 轮询处理函数
void lwmb_poll(void)
{
#if !LWMB_FRAME_MODE
    // 流模式处理
    // 1. 检查是否有新数据，初始状态从IDLE转为RX
    if (ctx.state == STATE_IDLE)
    {
        uint16_t available = lwmb_get_stream_avaliable_data();
        if (available > 0)
        {
            ctx.state = STATE_RX; // 开始接收数据，转换为RX状态
        }
    }
    
    // 2. 接收数据处理
    if (ctx.state == STATE_RX && ctx.rx_idx < LWMB_RX_MAX_LENGTH)
    {
        // 检查接收缓冲区是否有数据
        uint16_t available = lwmb_get_stream_avaliable_data();
        if (available > 0)
        {
            uint8_t  data[available];
            uint16_t data_read = lwmb_read_stream(data, available); // 从流中读取数据
            process_stream(data, data_read);
        }
    }
#endif

    // 帧处理，如果当前状态为接收结束，且上一帧已发送完成
    if (ctx.state == STATE_RX_END)
    {
        if (!ctx.mb_send_ready)
        {
            if (ctx.rx_idx >= 4)
            {
                check_complete_frame();
            }
            // 处理完成或错误后，重置接收状态
            ctx.rx_idx = 0;
            ctx.state  = STATE_IDLE;
        }
    }
    
    // 启动modbus发送
    lwmb_start_tx_mb();
}

// 初始化单缓冲
void lwmb_init(lwmb_func_callback_t func_callback)
{
    ctx.mb_send_ready     = 0;
    ctx.rx_idx            = 0;
    ctx.tx_idx            = 0;
    ctx.func_callback     = func_callback; // 设置自定义功能码回调函数
    ctx.last_rx_time      = 0;
    ctx.state             = STATE_IDLE;
    
    // 初始化发送缓冲区为0
    memset(ctx.tx_buf, 0, LWMB_TX_MAX_LENGTH);
    memset(ctx.rx_buf, 0, LWMB_RX_MAX_LENGTH);
}

static void lwmb_rx_frame_callback(uint8_t *data, uint16_t len)
{
    // 设置idx为数据长度
    ctx.rx_idx = len;
    // 设置状态为接收结束
    ctx.state = STATE_RX_END;
    // 继续接收下一个帧
    #if LWMB_FRAME_MODE
    lwmb_start_recv_frame(ctx.rx_buf, LWMB_RX_MAX_LENGTH, lwmb_rx_frame_callback, lwmb_rx_frame_error_callback);
    #endif
}

static void lwmb_rx_frame_error_callback(void)
{
    // 接收错误处理
    ctx.rx_idx = 0;
    ctx.state  = STATE_IDLE;
    // 重置接收
    #if LWMB_FRAME_MODE
    lwmb_reset_recv_frame(); // 重置接收状态
    // 重新启动接收
    lwmb_start_recv_frame(ctx.rx_buf, LWMB_RX_MAX_LENGTH, lwmb_rx_frame_callback, lwmb_rx_frame_error_callback);
    #endif
}
