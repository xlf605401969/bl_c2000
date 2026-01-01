#ifndef __LWMB_H__
#define __LWMB_H__

#include <stdint.h>
#include <stdbool.h>

#define LWMB_VER_MAJOR 1
#define LWMB_VER_MINOR 0

// 模式配置 - 简化为直接定义
#ifndef LWMB_FRAME_MODE
#define LWMB_FRAME_MODE 1 // 1:帧模式 0:流模式
#endif

// 超时配置
#define LWMB_FRAME_TIMEOUT_US 10000 // 帧超时时间，单位:微秒
#define LWMB_STREAM_TIMEOUT_US 5000  // 流模式下字符间超时时间，单位:微秒

// 通信配置
#define LWMB_COMM_BAUDRATE 2000000L // 通信波特率

#define LWMB_TX_MAX_LENGTH 20 // 最大发送长度
#define LWMB_RX_MAX_LENGTH 20 // 最大接收长度
// 内部状态定义
typedef enum
{
    STATE_IDLE,
    STATE_RX,
    STATE_RX_END,
} lwmb_state_t;

// 自定义功能码回调函数类型定义
typedef lwmb_err_t (*lwmb_func_callback_t)(uint8_t addr, uint8_t func, uint8_t *data, uint16_t len, uint8_t *reply_data, uint16_t *reply_len);

typedef struct
{
    lwmb_state_t state;
    uint32_t     last_rx_time;
    uint8_t      rx_buf[LWMB_RX_MAX_LENGTH]; // 接收单缓冲
    uint16_t     rx_idx;
    uint8_t      tx_buf[LWMB_TX_MAX_LENGTH]; // 发送单缓冲
    uint16_t     tx_idx;
    volatile uint8_t  mb_send_ready;
    lwmb_func_callback_t func_callback; // 自定义功能码回调函数
} lwmb_context;

// 回调函数类型定义
typedef void (*lwmb_rx_callback_t)(uint8_t *data, uint16_t len);

// 时间基准处理(在中断中调用)
void lwmb_tick(uint32_t elapsed_us);

// 轮询处理(在主循环中调用)
void lwmb_poll(void);

// 初始化Modbus协议栈，并设置自定义功能码回调函数
void lwmb_init(lwmb_func_callback_t func_callback);

// 启动modbus
void lwmb_start();

extern lwmb_context ctx;

// 错误码定义
typedef enum
{
    LWMB_OK = 0,
    LWMB_OK_NO_REPLY,
    LWMB_ERR_TIMEOUT,
    LWMB_ERR_CRC,
    LWMB_ERR_FRAME,
    LWMB_ERR_FUNC
} lwmb_err_t;

// 初始化Modbus协议栈，并设置自定义功能码回调函数
void lwmb_init(lwmb_func_callback_t func_callback);

#endif // __LWMB_H__