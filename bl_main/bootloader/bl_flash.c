/**
 * @file bl_flash.c
 * @brief Flash驱动层实现
 *
 * 注意：在C2000架构中，Flash存储器是16位宽度的，每个地址对应一个16位数据单元。
 * 本驱动中所有长度参数均以16位字(word)为单位，地址参数以字节为单位。
 */

#include "bl_flash.h"
#include "FlashAPI/F021.h"
#include "device/driverlib/flash.h"
#include <string.h>

/**
 * @brief 默认扇区配置表
 *
 * 从2838x_flash_lnk_cpu1.cmd照抄的Flash扇区信息：
 * FLASH0: origin = 0x080002, length = 0x001FFE (16位字) - 不包含
 * FLASH1: origin = 0x082000, length = 0x002000 (16位字)
 * FLASH2: origin = 0x084000, length = 0x002000 (16位字)
 * FLASH3: origin = 0x086000, length = 0x002000 (16位字)
 * FLASH4: origin = 0x088000, length = 0x008000 (16位字)
 * FLASH5: origin = 0x090000, length = 0x008000 (16位字)
 * FLASH6: origin = 0x098000, length = 0x008000 (16位字)
 * FLASH7: origin = 0x0A0000, length = 0x008000 (16位字)
 * FLASH8: origin = 0x0A8000, length = 0x008000 (16位字)
 * FLASH9: origin = 0x0B0000, length = 0x008000 (16位字)
 * FLASH10: origin = 0x0B8000, length = 0x002000 (16位字)
 * FLASH11: origin = 0x0BA000, length = 0x002000 (16位字)
 * FLASH12: origin = 0x0BC000, length = 0x002000 (16位字)
 * FLASH13: origin = 0x0BE000, length = 0x001FF0 (16位字)
 *
 * 注意：size字段以16位字为单位
 */
static bl_flash_sector_info_t default_sectors[] = {
    {0x082000, 0x2000, 1},  /* FLASH1 */
    {0x084000, 0x2000, 2},  /* FLASH2 */
    {0x086000, 0x2000, 3},  /* FLASH3 */
    {0x088000, 0x8000, 4},  /* FLASH4 */
    {0x090000, 0x8000, 5},  /* FLASH5 */
    {0x098000, 0x8000, 6},  /* FLASH6 */
    {0x0A0000, 0x8000, 7},  /* FLASH7 */
    {0x0A8000, 0x8000, 8},  /* FLASH8 */
    {0x0B0000, 0x8000, 9},  /* FLASH9 */
    {0x0B8000, 0x2000, 10}, /* FLASH10 */
    {0x0BA000, 0x2000, 11}, /* FLASH11 */
    {0x0BC000, 0x2000, 12}, /* FLASH12 */
    {0x0BE000, 0x1FF0, 13}, /* FLASH13 */
};

extern const uint8_t BL_FLASH_SECTOR_COUNT = sizeof(default_sectors) / sizeof(default_sectors[0]);

/**
 * @brief 初始化Flash驱动
 * @param flash Flash设备指针
 * @return 成功返回BL_FLASH_SUCCESS，失败返回错误码
 *
 * 初始化流程：
 * 1. 参数校验
 * 2. 初始化Flash设备结构体
 * 3. 配置默认扇区信息
 * 4. 设置Flash Bank
 * 5. 初始化写缓存
 */
int bl_flash_init(bl_flash_t *flash)
{
    if (flash == NULL) {
        return BL_FLASH_INVALID_PARAM;
    }

    memset(flash, 0, sizeof(bl_flash_t));

    memcpy(flash->sectors, default_sectors, sizeof(default_sectors));

    Fapi_StatusType status;
    Fapi_FlashBankType bank = Fapi_FlashBank0;

    status = Fapi_setActiveFlashBank(bank);
    if (status != Fapi_Status_Success) {
        return BL_FLASH_ERROR;
    }

    flash->initialized = true;

    return bl_flash_cache_init(flash);
}

/**
 * @brief 反初始化Flash驱动
 * @param flash Flash设备指针
 * @return 成功返回BL_FLASH_SUCCESS，失败返回错误码
 *
 * 确保在关闭前将所有缓存数据写回Flash
 */
int bl_flash_deinit(bl_flash_t *flash)
{
    if (flash == NULL || !flash->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    bl_flash_cache_flush(flash);

    flash->initialized = false;

    return BL_FLASH_SUCCESS;
}

/**
 * @brief 擦除指定扇区
 * @param flash Flash设备指针
 * @param sector_num 物理扇区号(1-13)
 * @return 成功返回BL_FLASH_SUCCESS，失败返回错误码
 */
int bl_flash_erase_sector(bl_flash_t *flash, uint16_t sector_num)
{
    if (flash == NULL || !flash->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    // 查找对应的扇区信息
    bl_flash_sector_info_t *info = NULL;
    for (int i = 0; i < BL_FLASH_SECTOR_COUNT; i++) {
        if (flash->sectors[i].sector_num == sector_num) {
            info = &flash->sectors[i];
            break;
        }
    }

    if (info == NULL) {
        return BL_FLASH_INVALID_PARAM;
    }

    return bl_flash_erase_range(flash, info->start_address, info->size);
}

/**
 * @brief 擦除指定地址范围
 * @param flash Flash设备指针
 * @param addr 起始地址(字节地址)
 * @param size 擦除大小(以16位字为单位)
 * @return 成功返回BL_FLASH_SUCCESS，失败返回错误码
 *
 * 擦除以扇区为单位进行，按4KB(2048字)步进循环调用擦除命令。
 * 擦除前会使缓存失效。
 */
/**
 * @brief 擦除指定地址范围内的Flash
 * @param flash Flash设备指针
 * @param addr 起始地址(16位字地址)
 * @param size 擦除大小(以16位字为单位)
 * @return 成功返回BL_FLASH_SUCCESS，失败返回错误码
 */
int bl_flash_erase_range(bl_flash_t *flash, uint32_t addr, uint32_t size)
{
    if (flash == NULL || !flash->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    // 计算结束地址(16位字地址)
    uint32_t end_addr = addr + size;
    
    // 遍历所有扇区，擦除覆盖的扇区
    for (int i = 0; i < BL_FLASH_SECTOR_COUNT; i++) {
        bl_flash_sector_info_t *sector_info = &flash->sectors[i];
        uint32_t sector_start = sector_info->start_address;
        uint32_t sector_end = sector_start + sector_info->size; // size是16位字数量
        
        // 检查当前扇区是否与擦除范围有交集
        if (sector_start < end_addr && sector_end > addr) {
            // 使用底层API擦除扇区
            Fapi_StatusType status = Fapi_issueAsyncCommandWithAddress(Fapi_EraseSector,
                                                                       (uint32_t *)sector_start);
            if (status != Fapi_Status_Success) {
                return BL_FLASH_ERASE_FAILED;
            }

            // 等待擦除完成
            do {
                status = Fapi_checkFsmForReady();
            } while (status == Fapi_Status_FsmBusy);
            
            if (status != Fapi_Status_FsmReady) {
                return BL_FLASH_ERASE_FAILED;
            }
        }
    }

    return BL_FLASH_SUCCESS;
}

/**
 * @brief 从Flash读取数据
 * @param flash Flash设备指针
 * @param addr 读取起始地址(16位字地址)
 * @param data 读取数据缓冲区指针
 * @param size 读取数据大小(以16位字为单位)
 * @return 成功返回BL_FLASH_SUCCESS，失败返回错误码
 *
 * 读取操作直接访问Flash，不经过缓存。
 * 直接使用memcpy进行数据复制。
 */
int bl_flash_read(bl_flash_t *flash, uint32_t addr, uint16_t *data, uint32_t size)
{
    if (flash == NULL || !flash->initialized || data == NULL) {
        return BL_FLASH_INVALID_PARAM;
    }

    memcpy(data, (uint16_t *)addr, size * sizeof(uint16_t));

    return BL_FLASH_SUCCESS;
}

/**
 * @brief 向Flash写入数据
 * @param flash Flash设备指针
 * @param addr 写入起始地址(16位字地址)
 * @param data 写入数据缓冲区指针
 * @param size 写入数据大小(以16位字为单位)
 * @return 成功返回BL_FLASH_SUCCESS，失败返回错误码
 *
 * 写入流程：
 * 1. 计算当前地址所在的缓存页地址(page_addr)
 *    - 页对齐：page_addr = addr & ~(BL_FLASH_CACHE_PAGE_SIZE - 1)
 *    - 页内偏移：offset_in_page = addr - page_addr
 *    - 页内剩余空间：space_in_page = BL_FLASH_CACHE_PAGE_SIZE - offset_in_page
 * 
 * 2. 检查是否需要切换缓存页
 *    - 如果缓存空闲或base_addr不匹配当前页，需要：
 *      a. 先刷新脏缓存(bl_flash_cache_flush)
 *      b. 加载新页的原始数据到缓存
 * 
 * 3. 将新数据复制到缓存对应位置
 * 
 * 4. 计算受影响的块范围(start_block ~ end_block)
 *    - 标记这些块为脏
 * 
 * 5. 更新地址和剩余计数，处理跨页情况
 */
int bl_flash_write(bl_flash_t *flash, uint32_t addr, const uint16_t *data, uint32_t size)
{
    if (flash == NULL || !flash->initialized || data == NULL) {
        return BL_FLASH_INVALID_PARAM;
    }

    uint32_t write_offset = 0;
    uint32_t remaining = size;

    while (remaining > 0) {
        uint32_t page_addr = addr & ~((BL_FLASH_CACHE_PAGE_SIZE) - 1);
        uint32_t offset_in_page = addr - page_addr;
        uint32_t space_in_page = BL_FLASH_CACHE_PAGE_SIZE - offset_in_page;
        uint32_t write_size = (remaining < space_in_page) ? remaining : space_in_page;

        if (flash->cache.state == BL_FLASH_CACHE_STATE_IDLE ||
            flash->cache.base_addr != page_addr) {
            
            bl_flash_cache_flush(flash);
            
            flash->cache.base_addr = page_addr;
            flash->cache.state = BL_FLASH_CACHE_STATE_ACTIVE;
            memcpy(flash->cache.data, (uint16_t *)page_addr, BL_FLASH_CACHE_PAGE_SIZE * sizeof(uint16_t));
        }

        memcpy(&flash->cache.data[offset_in_page], &data[write_offset], write_size * sizeof(uint16_t));

        uint32_t start_block = offset_in_page / BL_FLASH_CACHE_BLOCK_SIZE;
        uint32_t end_block = (offset_in_page + write_size - 1) / BL_FLASH_CACHE_BLOCK_SIZE;
        uint32_t block_idx;

        for (block_idx = start_block; block_idx <= end_block; block_idx++) {
            bl_flash_cache_set_block_dirty(&flash->cache, block_idx);
        }

        flash->cache.state = BL_FLASH_CACHE_STATE_DIRTY;

        addr += write_size;
        write_offset += write_size;
        remaining -= write_size;
    }

    return BL_FLASH_SUCCESS;
}

/**
 * @brief 初始化Flash缓存
 * @param flash Flash设备指针
 * @return 成功返回BL_FLASH_SUCCESS，失败返回错误码
 */
int bl_flash_cache_init(bl_flash_t *flash)
{
    if (flash == NULL) {
        return BL_FLASH_INVALID_PARAM;
    }

    memset(&flash->cache, 0, sizeof(bl_flash_cache_t));
    flash->cache.state = BL_FLASH_CACHE_STATE_IDLE;

    return BL_FLASH_SUCCESS;
}

/**
 * @brief 设置指定块为脏
 * @param cache 缓存指针
 * @param block_idx 块索引(0 ~ BL_FLASH_CACHE_BLOCK_COUNT-1)
 *
 * 脏位图使用位操作，每一位代表一个块的状态：
 * - 第0位：块0
 * - 第1位：块1
 * - ...
 * - 第N位：块N
 */
static void bl_flash_cache_set_block_dirty(bl_flash_cache_t *cache, uint32_t block_idx)
{
    if (block_idx >= BL_FLASH_CACHE_BLOCK_COUNT) {
        return;
    }
    
    uint32_t byte_idx = block_idx / 8;
    uint32_t bit_idx = block_idx % 8;
    
    cache->dirty_bitmap[byte_idx] |= (1 << bit_idx);
}

/**
 * @brief 清除指定块的脏标记
 * @param cache 缓存指针
 * @param block_idx 块索引
 */
static void bl_flash_cache_clear_block_dirty(bl_flash_cache_t *cache, uint32_t block_idx)
{
    if (block_idx >= BL_FLASH_CACHE_BLOCK_COUNT) {
        return;
    }
    
    uint32_t byte_idx = block_idx / 8;
    uint32_t bit_idx = block_idx % 8;
    
    cache->dirty_bitmap[byte_idx] &= ~(1 << bit_idx);
}

/**
 * @brief 检查指定块是否为脏
 * @param cache 缓存指针
 * @param block_idx 块索引
 * @return 脏返回true，否则返回false
 */
static bool bl_flash_cache_is_block_dirty(bl_flash_cache_t *cache, uint32_t block_idx)
{
    if (block_idx >= BL_FLASH_CACHE_BLOCK_COUNT) {
        return false;
    }
    
    uint32_t byte_idx = block_idx / 8;
    uint32_t bit_idx = block_idx % 8;
    
    return (cache->dirty_bitmap[byte_idx] & (1 << bit_idx)) != 0;
}

/**
 * @brief 清除所有脏标记
 * @param cache 缓存指针
 */
static void bl_flash_cache_clear_all_dirty(bl_flash_cache_t *cache)
{
    memset(cache->dirty_bitmap, 0, BL_FLASH_CACHE_DIRTY_BITMAP_SIZE);
}

/**
 * @brief 将缓存中所有脏块写回Flash
 * @param flash Flash设备指针
 * @return 成功返回BL_FLASH_SUCCESS，失败返回错误码
 *
 * 写回流程：
 * 1. 遍历所有块，检查脏位图
 * 2. 对于每个脏块：
 *    a. 计算块在缓存中的偏移：block_offset = block_idx * BL_FLASH_CACHE_BLOCK_SIZE
 *    b. 计算块的Flash地址：write_addr = base_addr + block_offset
 *       注意：base_addr是字节地址，block_offset是字偏移
 *    c. 调用Fapi_issueProgrammingCommand写入块数据
 *    d. 等待Flash FSM就绪
 *    e. 清除该块的脏标记
 * 3. 完成后清除所有脏标记并重置缓存状态
 */
int bl_flash_cache_flush(bl_flash_t *flash)
{
    if (flash == NULL || !flash->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    if (flash->cache.state != BL_FLASH_CACHE_STATE_DIRTY) {
        return BL_FLASH_SUCCESS;
    }

    flash->cache.state = BL_FLASH_CACHE_STATE_FLUSHING;

    Fapi_StatusType status;
    uint32_t block_idx;

    for (block_idx = 0; block_idx < BL_FLASH_CACHE_BLOCK_COUNT; block_idx++) {
        if (!bl_flash_cache_is_block_dirty(&flash->cache, block_idx)) {
            continue;
        }

        uint32_t block_offset = block_idx * BL_FLASH_CACHE_BLOCK_SIZE;
        uint32_t write_addr = flash->cache.base_addr + block_offset;
        uint16_t words_16 = (uint16_t)BL_FLASH_CACHE_BLOCK_SIZE;

        status = Fapi_issueProgrammingCommand((uint32_t *)write_addr, 
                                               &flash->cache.data[block_offset], 
                                               words_16, 
                                               NULL, 
                                               0, 
                                               Fapi_AutoEccGeneration);
        if (status != Fapi_Status_Success) {
            flash->cache.state = BL_FLASH_CACHE_STATE_DIRTY;
            return BL_FLASH_CACHE_ERROR;
        }

        do {
            status = Fapi_checkFsmForReady();
        } while (status == Fapi_Status_FsmBusy);

        if (status != Fapi_Status_FsmReady) {
            flash->cache.state = BL_FLASH_CACHE_STATE_DIRTY;
            return BL_FLASH_CACHE_ERROR;
        }

        bl_flash_cache_clear_block_dirty(&flash->cache, block_idx);
    }

    flash->cache.state = BL_FLASH_CACHE_STATE_IDLE;
    bl_flash_cache_clear_all_dirty(&flash->cache);

    return BL_FLASH_SUCCESS;
}

/**
 * @brief 使缓存失效
 * @param flash Flash设备指针
 * @return 成功返回BL_FLASH_SUCCESS，失败返回错误码
 *
 * 在擦除操作前调用，确保不会有脏数据残留。
 */
int bl_flash_cache_invalidate(bl_flash_t *flash)
{
    if (flash == NULL || !flash->initialized) {
        return BL_FLASH_INVALID_PARAM;
    }

    bl_flash_cache_flush(flash);

    flash->cache.state = BL_FLASH_CACHE_STATE_IDLE;
    flash->cache.base_addr = 0;
    bl_flash_cache_clear_all_dirty(&flash->cache);

    return BL_FLASH_SUCCESS;
}

/**
 * @brief 验证Flash数据
 * @param flash Flash设备指针
 * @param addr 验证起始地址(16位字地址)
 * @param data 验证数据缓冲区指针
 * @param size 验证数据大小(以16位字为单位)
 * @return 成功返回BL_FLASH_SUCCESS，失败返回错误码
 */
int bl_flash_verify(bl_flash_t *flash, uint32_t addr, const uint16_t *data, uint32_t size)
{
    if (flash == NULL || !flash->initialized || data == NULL) {
        return BL_FLASH_INVALID_PARAM;
    }

    // 从Flash中读取数据进行比较
    const uint16_t *flash_data = (const uint16_t *)addr;
    for (uint32_t i = 0; i < size; i++) {
        if (flash_data[i] != data[i]) {
            return BL_FLASH_VERIFY_FAILED;
        }
    }

    return BL_FLASH_SUCCESS;
}

/**
 * @brief 获取扇区信息
 * @param flash Flash设备指针
 * @param sector_idx 扇区索引(0-12，对应物理扇区1-13)
 * @return 扇区信息指针，失败返回NULL
 */
bl_flash_sector_info_t *bl_flash_get_sector_info(bl_flash_t *flash, uint8_t sector_idx)
{
    if (flash == NULL || sector_idx >= BL_FLASH_SECTOR_COUNT) {
        return NULL;
    }

    return &flash->sectors[sector_idx];
}

/**
 * @brief 根据地址查找所在扇区
 * @param flash Flash设备指针
 * @param addr 16位字地址
 * @return 扇区索引(0-12)，未找到返回0xFF
 */
uint8_t bl_flash_addr_to_sector(bl_flash_t *flash, uint32_t addr)
{
    if (flash == NULL) {
        return 0xFF;
    }

    for (int i = 0; i < BL_FLASH_SECTOR_COUNT; i++) {
        uint32_t sector_end = flash->sectors[i].start_address + flash->sectors[i].size;
        if (addr >= flash->sectors[i].start_address && 
            addr < sector_end) {
            return (uint8_t)i;
        }
    }

    return 0xFF;
}
