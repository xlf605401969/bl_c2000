#ifndef BL_CONFIG_H
#define BL_CONFIG_H

#ifdef __cplusplus
extern "C"
{
#endif

/**
 * @brief 应用程序起始地址
 */
#define BL_APP_START_ADDR 0x088000                              /**< 应用程序起始地址 */
#define BL_APP_MAX_SIZE 0x00030000                              /**< 应用程序最大大小 */

#ifdef __cplusplus
}
#endif

#endif
