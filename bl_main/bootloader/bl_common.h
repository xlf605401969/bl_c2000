#ifndef BL_H
#define BL_H

#include <stdint.h>
#include <stdbool.h>
#include "bl_config.h"

#ifdef __cplusplus
extern "C"
{
#endif

/**
 * @brief 返回值定义
 */
#define BL_SUCCESS 0        /**< 操作成功 */
#define BL_ERROR -1         /**< 通用错误 */
#define BL_INVALID_PARAM -2 /**< 无效参数 */

/**
 * @brief FLASH错误码定义
 */
#define BL_FLASH_ERROR -3          /**< FLASH错误 */
#define BL_FLASH_ERASE_FAILED -4   /**< 擦除失败 */
#define BL_FLASH_PROGRAM_FAILED -5 /**< 编程失败 */
#define BL_FLASH_VERIFY_FAILED -6  /**< 校验失败 */
#define BL_FLASH_CACHE_ERROR -7    /**< 缓存错误 */

#ifdef __cplusplus
}
#endif

#endif
