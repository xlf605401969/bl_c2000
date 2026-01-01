# Flash驱动模型设计说明 (C2000架构)

## 概述
本Flash驱动模型是一个专为C2000系列MCU Bootloader设计的Flash存储器操作框架，具有以下特点：

1. **C2000架构优化**：针对C2000的16位内存宽度进行优化，每个地址对应16位数据
2. **静态结构设计**：使用静态内存分配，避免动态内存分配
3. **块式缓存管理**：缓存页按块组织，支持按块刷新
4. **物理扇区管理**：使用物理扇区号进行擦除操作
5. **完整的错误处理**：定义详细的错误码，便于调试和问题定位
6. **FAPI集成**：集成TI Flash API (FAPI)进行底层Flash操作

## 设计架构

### 核心组件

#### 1. Flash设备结构 (bl_flash_t)
- 管理扇区信息和缓存状态
- 维护初始化状态
- 集成块式缓存管理

#### 2. 缓存管理机制
- 采用写回缓存策略
- 按块管理脏数据
- 支持跨页写入操作

## 数据结构

### Flash扇区信息 (bl_flash_sector_info_t)
```c
typedef struct {
    uint32_t start_address;   // 扇区起始地址(16位字地址)
    uint32_t size;            // 扇区大小(以16位字为单位)
    uint8_t  sector_num;      // 扇区编号(物理扇区号1-13)
} bl_flash_sector_info_t;
```

### Flash缓存结构 (bl_flash_cache_t)
```c
typedef struct {
    uint32_t                base_addr;          // 缓存基地址(16位字地址)
    uint16_t                data[BL_FLASH_CACHE_PAGE_SIZE];  // 缓存数据区
    uint8_t                 dirty_bitmap[BL_FLASH_CACHE_DIRTY_BITMAP_SIZE]; // 脏位图
    bl_flash_cache_state_t  state;              // 缓存状态
} bl_flash_cache_t;
```

### Flash设备结构 (bl_flash_t)
```c
typedef struct {
    bl_flash_sector_info_t  sectors[BL_FLASH_SECTOR_COUNT];  // 扇区信息数组
    bl_flash_cache_t        cache;                          // 写缓存
    bool                    initialized;                    // 初始化标志
} bl_flash_t;
```

## 配置选项

### 缓存页大小配置
```c
#define BL_FLASH_CACHE_PAGE_SIZE       128  // 缓存页大小(以16位字为单位)
```

### 缓存块大小配置
```c
#define BL_FLASH_CACHE_BLOCK_SIZE      16   // 缓存块大小(以16位字为单位)
```

### 自动计算的常量
```c
extern const uint8_t BL_FLASH_SECTOR_COUNT;  // 可操作的扇区数量(自动计算)
#define BL_FLASH_CACHE_BLOCK_COUNT     (BL_FLASH_CACHE_PAGE_SIZE / BL_FLASH_CACHE_BLOCK_SIZE)
#define BL_FLASH_CACHE_DIRTY_BITMAP_SIZE ((BL_FLASH_CACHE_BLOCK_COUNT + 7) / 8)
```

## C2000架构特性

### 内存模型
- **16位数据宽度**：每个地址对应一个16位数据单元
- **无字节地址**：所有地址操作基于16位字地址
- **统一单位**：所有长度参数以16位字为单位

### 扇区配置
基于2838x_flash_lnk_cpu1.cmd的Flash扇区信息：
```c
static bl_flash_sector_info_t default_sectors[] = {
    {0x082000, 0x2000, 1},  // FLASH1: 0x082000-0x084000 (8KB)
    {0x084000, 0x2000, 2},  // FLASH2: 0x084000-0x086000 (8KB)
    {0x086000, 0x2000, 3},  // FLASH3: 0x086000-0x088000 (8KB)
    {0x088000, 0x8000, 4},  // FLASH4: 0x088000-0x090000 (32KB)
    {0x090000, 0x8000, 5},  // FLASH5: 0x090000-0x098000 (32KB)
    {0x098000, 0x8000, 6},  // FLASH6: 0x098000-0x0A0000 (32KB)
    {0x0A0000, 0x8000, 7},  // FLASH7: 0x0A0000-0x0A8000 (32KB)
    {0x0A8000, 0x8000, 8},  // FLASH8: 0x0A8000-0x0B0000 (32KB)
    {0x0B0000, 0x8000, 9},  // FLASH9: 0x0B0000-0x0B8000 (32KB)
    {0x0B8000, 0x2000, 10}, // FLASH10: 0x0B8000-0x0BA000 (8KB)
    {0x0BA000, 0x2000, 11}, // FLASH11: 0x0BA000-0x0BC000 (8KB)
    {0x0BC000, 0x2000, 12}, // FLASH12: 0x0BC000-0x0BE000 (8KB)
    {0x0BE000, 0x1FF0, 13}, // FLASH13: 0x0BE000-0x0BFFF0 (约8KB)
};
```

**注意**：FLASH0 (0x080002-0x082000) 不允许操作

## API接口

### 初始化与反初始化
```c
int bl_flash_init(bl_flash_t *flash);
int bl_flash_deinit(bl_flash_t *flash);
```

### 基本操作
```c
int bl_flash_read(bl_flash_t *flash, uint32_t addr, uint16_t *data, uint32_t size);
int bl_flash_write(bl_flash_t *flash, uint32_t addr, const uint16_t *data, uint32_t size);
int bl_flash_verify(bl_flash_t *flash, uint32_t addr, const uint16_t *data, uint32_t size);
```

### 擦除操作
```c
int bl_flash_erase_sector(bl_flash_t *flash, uint16_t sector_num);
int bl_flash_erase_range(bl_flash_t *flash, uint32_t addr, uint32_t size);
```

### 缓存管理
```c
int bl_flash_cache_flush(bl_flash_t *flash);
int bl_flash_cache_invalidate(bl_flash_t *flash);
```

### 扇区信息查询
```c
bl_flash_sector_info_t *bl_flash_get_sector_info(bl_flash_t *flash, uint8_t sector_idx);
uint8_t bl_flash_addr_to_sector(bl_flash_t *flash, uint32_t addr);
```

## 使用方法

### 1. 初始化Flash驱动
```c
bl_flash_t flash;
int result = bl_flash_init(&flash);
if (result != BL_FLASH_SUCCESS) {
    // 处理初始化失败
}
```

### 2. 写入数据到Flash
```c
uint16_t test_data[128]; // 128个16位字 = 256字节
// ... 填充测试数据

result = bl_flash_write(&flash, 0x082000, test_data, 128);
if (result != BL_FLASH_SUCCESS) {
    // 处理写入失败
}

// 确保缓存数据写回Flash
bl_flash_cache_flush(&flash);
```

### 3. 从Flash读取数据
```c
uint16_t read_data[64]; // 64个16位字 = 128字节
result = bl_flash_read(&flash, 0x082100, read_data, 64);
if (result != BL_FLASH_SUCCESS) {
    // 处理读取失败
}
```

### 4. 擦除扇区
```c
// 使用物理扇区号擦除
result = bl_flash_erase_sector(&flash, 1); // 擦除FLASH1扇区
if (result != BL_FLASH_SUCCESS) {
    // 处理擦除失败
}

// 或者使用地址范围擦除
result = bl_flash_erase_range(&flash, 0x082000, 0x2000);
```

### 5. 验证数据
```c
result = bl_flash_verify(&flash, 0x082000, test_data, 128);
if (result != BL_FLASH_SUCCESS) {
    // 处理验证失败
}
```

### 6. 去初始化
```c
bl_flash_deinit(&flash);
```

## 缓存机制

### 缓存工作原理
1. **写入缓存**：写入操作首先写入缓存页，标记相应的块为脏
2. **读取直接**：读取操作直接访问Flash，不经过缓存
3. **块式刷新**：脏块在需要时按块刷新到Flash
4. **跨页处理**：自动处理跨页写入操作

### 缓存状态管理
```c
typedef enum {
    BL_FLASH_CACHE_STATE_IDLE = 0,    // 空闲状态，无有效缓存数据
    BL_FLASH_CACHE_STATE_ACTIVE,      // 已加载数据，但未修改
    BL_FLASH_CACHE_STATE_DIRTY,       // 数据已修改，需要写回
    BL_FLASH_CACHE_STATE_FLUSHING     // 正在写回Flash中
} bl_flash_cache_state_t;
```

### 脏位图管理
- 每个位对应一个缓存块的状态
- 脏块在刷新时单独写入Flash
- 支持部分块刷新，减少Flash写入次数

## 错误码定义

```c
#define BL_FLASH_SUCCESS           0   // 操作成功
#define BL_FLASH_ERROR             -1  // 通用错误
#define BL_FLASH_INVALID_PARAM     -2  // 无效参数
#define BL_FLASH_WRITE_PROTECTED   -3  // 写保护错误
#define BL_FLASH_ERASE_FAILED      -4  // 擦除失败
#define BL_FLASH_PROGRAM_FAILED    -5  // 编程失败
#define BL_FLASH_VERIFY_FAILED     -6  // 校验失败
#define BL_FLASH_CACHE_ERROR       -7  // 缓存错误
#define BL_FLASH_TIMEOUT           -8  // 超时错误
```

## FAPI集成

### 底层Flash操作
本驱动使用TI Flash API (FAPI)进行底层Flash操作：
- `Fapi_issueAsyncCommandWithAddress()` - 异步命令执行
- `Fapi_issueProgrammingCommand()` - 编程命令
- `Fapi_checkFsmForReady()` - 状态机状态检查
- `Fapi_setActiveFlashBank()` - 设置活动Flash Bank

### 状态管理
- 使用FAPI状态机进行异步操作管理
- 正确处理FsmBusy和FsmReady状态
- 支持ECC自动生成

## 注意事项

### 地址和长度单位
- **所有地址**：16位字地址，不是字节地址
- **所有长度**：以16位字为单位，不是字节数
- **示例**：写入128个字的数据，size参数应传入128，而不是256

### 扇区操作约束
- FLASH0扇区不允许操作
- 擦除操作以扇区为单位
- 跨扇区擦除自动处理

### 缓存使用建议
- 写入操作后调用`bl_flash_cache_flush()`确保数据持久化
- 擦除操作前调用`bl_flash_cache_invalidate()`避免脏数据残留
- 批量写入时注意缓存页大小限制

### 性能优化
- 按块刷新减少Flash写入次数
- 支持跨页写入，减少缓存切换
- 直接读取Flash，避免缓存开销

## 移植指南

### 移植到其他C2000器件
1. **更新扇区配置**：根据目标器件的Flash布局修改`default_sectors`数组
2. **验证FAPI兼容性**：确保FAPI函数与目标器件兼容
3. **调整缓存大小**：根据可用RAM调整缓存页和块大小
4. **测试功能**：验证所有API功能在目标平台上正常工作

### 支持的特性
- C2000全系列MCU
- 16位字地址操作
- 物理扇区管理
- 块式缓存刷新
- FAPI底层驱动

## 示例代码

完整的示例代码请参考`bl_main/bootloader/bl_flash.c`和`bl_main/bootloader/bl_flash.h`文件。