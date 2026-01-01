#ifndef BL_FLASH_H
#define BL_FLASH_H

/**
 * @file bl_flash.h
 * @brief Flash驱动层接口定义
 *
 * 注意：在C2000架构中，Flash存储器是16位宽度的，每个地址对应一个16位(2字节)数据单元。
 * 本驱动中所有地址和长度参数均以16位单元为基本单位，而非字节。
 * 例如：写入128个字(256字节)的数据，size参数应传入128而非256。
 */

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief 返回值定义
 */
#define BL_FLASH_SUCCESS           0   /**< 操作成功 */
#define BL_FLASH_ERROR             -1  /**< 通用错误 */
#define BL_FLASH_INVALID_PARAM     -2  /**< 无效参数 */
#define BL_FLASH_WRITE_PROTECTED   -3  /**< 写保护错误 */
#define BL_FLASH_ERASE_FAILED      -4  /**< 擦除失败 */
#define BL_FLASH_PROGRAM_FAILED    -5  /**< 编程失败 */
#define BL_FLASH_VERIFY_FAILED     -6  /**< 校验失败 */
#define BL_FLASH_CACHE_ERROR       -7  /**< 缓存错误 */
#define BL_FLASH_TIMEOUT           -8  /**< 超时错误 */

/**
 * @brief 缓存页大小(以16位字为单位)
 *
 * 128字 = 256字节
 */
#define BL_FLASH_CACHE_PAGE_SIZE       128

/**
 * @brief 缓存块大小(以16位字为单位)
 *
 * 块是Flash编程的最小单位，每个块必须作为一个整体写入Flash。
 * 块大小必须是芯片允许的最小编程单位(16字)的整数倍。
 */
#define BL_FLASH_CACHE_BLOCK_SIZE      16

/**
 * @brief 缓存块数量
 */
#define BL_FLASH_CACHE_BLOCK_COUNT     (BL_FLASH_CACHE_PAGE_SIZE / BL_FLASH_CACHE_BLOCK_SIZE)

/**
 * @brief 脏位图大小(以字节为单位)
 *
 * 用于标记哪些块被修改过，需要写回Flash
 */
#define BL_FLASH_CACHE_DIRTY_BITMAP_SIZE ((BL_FLASH_CACHE_BLOCK_COUNT + 7) / 8)

/**
 * @brief Flash扇区数量定义
 */
extern const uint8_t BL_FLASH_SECTOR_COUNT;    /**< 可操作的扇区数量(自动计算) */

/**
 * @brief 缓存状态枚举
 */
typedef enum {
    BL_FLASH_CACHE_STATE_IDLE = 0,    /**< 空闲状态，无有效缓存数据 */
    BL_FLASH_CACHE_STATE_ACTIVE,      /**< 已加载数据，但未修改 */
    BL_FLASH_CACHE_STATE_DIRTY,       /**< 数据已修改，需要写回 */
    BL_FLASH_CACHE_STATE_FLUSHING     /**< 正在写回Flash中 */
} bl_flash_cache_state_t;

/**
 * @brief 扇区信息结构体
 *
 * 记录每个扇区的起始地址和大小(以16位字为单位)
 */
typedef struct {
    uint32_t start_address;   /**< 扇区起始地址(16位字地址) */
    uint32_t size;            /**< 扇区大小(以16位字为单位) */
    uint8_t  sector_num;      /**< 扇区编号 */
} bl_flash_sector_info_t;

/**
 * @brief Flash缓存结构体
 *
 * 采用写回缓存策略：
 * - 写入数据先缓存在RAM中
 * - 缓存页按块组织，每个块有独立的脏位标记
 * - 只有被标记为脏的块才需要写回Flash
 * - 脏块可以单独或批量写回
 */
typedef struct {
    uint32_t                base_addr;          /**< 缓存基地址(16位字地址) */
    uint16_t                data[BL_FLASH_CACHE_PAGE_SIZE];  /**< 缓存数据区(以16位字为单位) */
    uint8_t                 dirty_bitmap[BL_FLASH_CACHE_DIRTY_BITMAP_SIZE]; /**< 脏位图 */
    bl_flash_cache_state_t  state;              /**< 缓存状态 */
} bl_flash_cache_t;

/**
 * @brief Flash设备结构体
 */
typedef struct {
    bl_flash_sector_info_t  sectors[BL_FLASH_SECTOR_COUNT];  /**< 扇区信息数组 */
    bl_flash_cache_t        cache;                          /**< 写缓存 */
    bool                    initialized;                    /**< 初始化标志 */
} bl_flash_t;

/**
 * @brief 初始化Flash驱动
 * @param flash Flash设备指针
 * @return 操作结果
 */
int bl_flash_init(bl_flash_t *flash);

/**
 * @brief 反初始化Flash驱动
 * @param flash Flash设备指针
 * @return 操作结果
 */
int bl_flash_deinit(bl_flash_t *flash);

/**
 * @brief 擦除指定扇区
 * @param flash Flash设备指针
 * @param sector_num 物理扇区号(1-13)
 * @return 操作结果
 */
int bl_flash_erase_sector(bl_flash_t *flash, uint16_t sector_num);

/**
 * @brief 擦除指定地址范围
 * @param flash Flash设备指针
 * @param addr 起始地址(16位字地址)
 * @param size 擦除大小(以16位字为单位)
 * @return 操作结果
 */
int bl_flash_erase_range(bl_flash_t *flash, uint32_t addr, uint32_t size);

/**
 * @brief 从Flash读取数据
 *
 * 读取操作直接访问Flash，不经过缓存。
 *
 * @param flash Flash设备指针
 * @param addr 读取起始地址(16位字地址)
 * @param data 读取数据缓冲区指针
 * @param size 读取数据大小(以16位字为单位)
 * @return 操作结果
 */
int bl_flash_read(bl_flash_t *flash, uint32_t addr, uint16_t *data, uint32_t size);

/**
 * @brief 向Flash写入数据
 *
 * 写入流程：
 * 1. 检查地址是否在当前缓存页范围内
 * 2. 如果不在当前页，先将脏数据写回Flash，然后加载新页数据
 * 3. 将新数据写入缓存
 * 4. 标记受影响的块为脏
 * 5. 处理跨页写入
 *
 * @param flash Flash设备指针
 * @param addr 写入起始地址(16位字地址)
 * @param data 写入数据缓冲区指针
 * @param size 写入数据大小(以16位字为单位)
 * @return 操作结果
 */
int bl_flash_write(bl_flash_t *flash, uint32_t addr, const uint16_t *data, uint32_t size);

/**
 * @brief 初始化Flash缓存
 * @param flash Flash设备指针
 * @return 操作结果
 */
int bl_flash_cache_init(bl_flash_t *flash);

/**
 * @brief 将缓存中所有脏块写回Flash
 *
 * 遍历脏位图，将所有标记为脏的块逐一写回Flash。
 *
 * @param flash Flash设备指针
 * @return 操作结果
 */
int bl_flash_cache_flush(bl_flash_t *flash);

/**
 * @brief 使缓存失效
 *
 * 刷新缓存并将状态复位到空闲。
 *
 * @param flash Flash设备指针
 * @return 操作结果
 */
int bl_flash_cache_invalidate(bl_flash_t *flash);

/**
 * @brief 验证Flash数据
 * @param flash Flash设备指针
 * @param addr 验证起始地址(16位字地址)
 * @param data 验证数据缓冲区指针
 * @param size 验证数据大小(以16位字为单位)
 * @return 操作结果
 */
int bl_flash_verify(bl_flash_t *flash, uint32_t addr, const uint16_t *data, uint32_t size);

/**
 * @brief 获取扇区信息
 * @param flash Flash设备指针
 * @param sector_idx 扇区索引(0-12，对应物理扇区1-13)
 * @return 扇区信息指针，失败返回NULL
 */
bl_flash_sector_info_t *bl_flash_get_sector_info(bl_flash_t *flash, uint8_t sector_idx);

/**
 * @brief 根据地址查找所在扇区
 * @param flash Flash设备指针
 * @param addr 16位字地址
 * @return 扇区索引(0-12)，未找到返回0xFF
 */
uint8_t bl_flash_addr_to_sector(bl_flash_t *flash, uint32_t addr);

#ifdef __cplusplus
}
#endif

#endif
