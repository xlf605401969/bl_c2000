#include "bl_protocol.h"
#include <string.h>

uint16_t word_data[(BL_PROTO_MAX_RX_DATA_LEN + 1) / 2];

static bl_flash_mgr_t g_flash_mgrs[BL_FLASH_MGR_COUNT];
static uint8_t g_active_flash_mgr_idx = 0xFF;

static int bl_proto_read_app_info(bl_proto_t *proto, bl_app_info_t *app_info);

static int bl_flash_mgr_erase_local(void *flash_ptr, uint32_t addr, uint32_t size, uint32_t* actual_addr, uint32_t* actual_size)
{
    (void)flash_ptr;
    return bl_flash_erase_range(addr, size, actual_addr, actual_size);
}

static int bl_flash_mgr_write_local(void *flash_ptr, uint32_t addr, const uint16_t* data, uint32_t size)
{
    (void)flash_ptr;
    return bl_flash_write(addr, data, size);
}

static int bl_flash_mgr_read_local(void *flash_ptr, uint32_t addr, uint8_t *data, uint32_t size)
{
    (void)flash_ptr;
    return bl_flash_read(addr, (uint16_t*)data, size);
}

static int bl_flash_mgr_flush_local(void *flash_ptr)
{
    (void)flash_ptr;
    return bl_flash_cache_flush();
}

static uint32_t bl_flash_mgr_get_size_local(void *flash_ptr)
{
    (void)flash_ptr;
    return bl_flash_get_size();
}

static uint8_t bl_flash_mgr_addr_to_sector_local(void *flash_ptr, uint32_t addr)
{
    (void)flash_ptr;
    return bl_flash_addr_to_sector(addr);
}

static uint32_t bl_flash_mgr_get_sector_start_addr_local(void *flash_ptr, uint8_t sector_num)
{
    (void)flash_ptr;
    return bl_flash_get_sector_start_addr(sector_num);
}

static int bl_flash_mgr_erase_cm(void *flash_ptr, uint32_t addr, uint32_t size, uint32_t* actual_addr, uint32_t* actual_size)
{
    (void)flash_ptr;
    return bl_flash_cm_erase(addr, size, actual_addr, actual_size);
}

static int bl_flash_mgr_write_cm(void *flash_ptr, uint32_t addr, const uint16_t* data, uint32_t size)
{
    (void)flash_ptr;
    return bl_flash_cm_write(addr, data, size);
}

static int bl_flash_mgr_read_cm(void *flash_ptr, uint32_t addr, uint8_t *data, uint32_t size)
{
    (void)flash_ptr;
    (void)addr;
    (void)data;
    (void)size;
    return BL_NOT_SUPPORTED;
}

static int bl_flash_mgr_flush_cm(void *flash_ptr)
{
    (void)flash_ptr;
    return bl_flash_cm_flush();
}

static uint32_t bl_flash_mgr_get_size_cm(void *flash_ptr)
{
    (void)flash_ptr;
    return 0;
}

static uint8_t bl_flash_mgr_addr_to_sector_cm(void *flash_ptr, uint32_t addr)
{
    (void)flash_ptr;
    (void)addr;
    return 0xFF;
}

static uint32_t bl_flash_mgr_get_sector_start_addr_cm(void *flash_ptr, uint8_t sector_num)
{
    (void)flash_ptr;
    (void)sector_num;
    return 0xFFFFFFFF;
}

int bl_flash_mgr_init_local(uint8_t mgr_idx)
{
    if (mgr_idx >= BL_FLASH_MGR_COUNT) {
        return BL_INVALID_PARAM;
    }

    g_flash_mgrs[mgr_idx].type = BL_FLASH_TYPE_LOCAL;
    g_flash_mgrs[mgr_idx].flash_ptr = NULL;
    g_flash_mgrs[mgr_idx].ops.erase = bl_flash_mgr_erase_local;
    g_flash_mgrs[mgr_idx].ops.write = bl_flash_mgr_write_local;
    g_flash_mgrs[mgr_idx].ops.read = bl_flash_mgr_read_local;
    g_flash_mgrs[mgr_idx].ops.flush = bl_flash_mgr_flush_local;
    g_flash_mgrs[mgr_idx].ops.get_size = bl_flash_mgr_get_size_local;
    g_flash_mgrs[mgr_idx].ops.addr_to_sector = bl_flash_mgr_addr_to_sector_local;
    g_flash_mgrs[mgr_idx].ops.get_sector_start_addr = bl_flash_mgr_get_sector_start_addr_local;
    g_flash_mgrs[mgr_idx].initialized = true;

    return BL_SUCCESS;
}

int bl_flash_mgr_init_cm(uint8_t mgr_idx)
{
    if (mgr_idx >= BL_FLASH_MGR_COUNT) {
        return BL_INVALID_PARAM;
    }

    int ret = bl_flash_cm_init();
    if (ret != BL_SUCCESS) {
        return ret;
    }

    g_flash_mgrs[mgr_idx].type = BL_FLASH_TYPE_CM;
    g_flash_mgrs[mgr_idx].flash_ptr = NULL;
    g_flash_mgrs[mgr_idx].ops.erase = bl_flash_mgr_erase_cm;
    g_flash_mgrs[mgr_idx].ops.write = bl_flash_mgr_write_cm;
    g_flash_mgrs[mgr_idx].ops.read = bl_flash_mgr_read_cm;
    g_flash_mgrs[mgr_idx].ops.flush = bl_flash_mgr_flush_cm;
    g_flash_mgrs[mgr_idx].ops.get_size = bl_flash_mgr_get_size_cm;
    g_flash_mgrs[mgr_idx].ops.addr_to_sector = bl_flash_mgr_addr_to_sector_cm;
    g_flash_mgrs[mgr_idx].ops.get_sector_start_addr = bl_flash_mgr_get_sector_start_addr_cm;
    g_flash_mgrs[mgr_idx].initialized = true;

    return BL_SUCCESS;
}

int bl_flash_mgr_deinit(uint8_t mgr_idx)
{
    if (mgr_idx >= BL_FLASH_MGR_COUNT) {
        return BL_INVALID_PARAM;
    }

    if (!g_flash_mgrs[mgr_idx].initialized) {
        return BL_INVALID_PARAM;
    }

    if (g_flash_mgrs[mgr_idx].type == BL_FLASH_TYPE_CM) {
        bl_flash_cm_deinit();
    }

    memset(&g_flash_mgrs[mgr_idx], 0, sizeof(bl_flash_mgr_t));

    if (g_active_flash_mgr_idx == mgr_idx) {
        g_active_flash_mgr_idx = 0xFF;
    }

    return BL_SUCCESS;
}

int bl_flash_mgr_activate(uint8_t mgr_idx)
{
    if (mgr_idx >= BL_FLASH_MGR_COUNT) {
        return BL_INVALID_PARAM;
    }

    if (!g_flash_mgrs[mgr_idx].initialized) {
        return BL_INVALID_PARAM;
    }

    g_active_flash_mgr_idx = mgr_idx;

    return BL_SUCCESS;
}

bl_flash_mgr_t* bl_flash_mgr_get_active(void)
{
    if (g_active_flash_mgr_idx >= BL_FLASH_MGR_COUNT) {
        return NULL;
    }

    if (!g_flash_mgrs[g_active_flash_mgr_idx].initialized) {
        return NULL;
    }

    return &g_flash_mgrs[g_active_flash_mgr_idx];
}

/**
 * @brief 初始化bootloader协议处理器
 * @param proto 协议处理器指针
 * @return 成功返回BL_SUCCESS
 */
int bl_proto_init(bl_proto_t *proto)
{
    bl_flash_mgr_t *active_mgr = bl_flash_mgr_get_active();
    if (active_mgr == NULL) {
        return BL_INVALID_PARAM;
    }

    memset(proto, 0, sizeof(bl_proto_t));

    proto->state = BL_PROTO_STATE_IDLE;
    proto->in_bootloader = false;
    proto->last_error = BL_SUCCESS;

    proto->app_start_addr = BL_APP_START_ADDR;
    proto->app_max_size = BL_APP_MAX_SIZE;

    bl_proto_read_app_info(proto, &proto->app_info);

    return BL_SUCCESS;
}

/**
 * @brief 反初始化bootloader协议处理器
 * @param proto 协议处理器指针
 * @return 成功返回BL_SUCCESS
 */
int bl_proto_deinit(bl_proto_t *proto)
{
    return BL_SUCCESS;
}

/**
 * @brief 处理Modbus寄存器读取请求(功能码0x04)
 * @param proto 协议处理器指针
 * @param req 请求数据
 * @param resp 响应数据
 * @return 帧数据错误返回LWMB_ERR_FRAME，协议层正确但执行操作有问题返回LWMB_OK
 *
 * 支持读取引导加载程序信息寄存器(0xF000-0xF20F)
 * 帧数据错误：数据长度不足
 * 协议错误：寄存器数量超过限制
 */
static lwmb_err_t bl_proto_handle_read_registers(bl_proto_t *proto, const bl_proto_request_t *req,
                                   bl_proto_response_t *resp)
{
    bl_flash_mgr_t *flash_mgr = bl_flash_mgr_get_active();
    if (flash_mgr == NULL) {
        return LWMB_ERR_FRAME;
    }

    if (req->data_len < 4)
    {
        return LWMB_ERR_FRAME;
    }

    // 解析起始地址和寄存器数量
    uint16_t start_addr = ((uint16_t)req->data[0] << 8) | req->data[1];
    uint16_t reg_count = ((uint16_t)req->data[2] << 8) | req->data[3];

    if (reg_count > 64)
    {
        return LWMB_ERR_FRAME;
    }

    for (uint16_t i = 0; i < reg_count; i++)
    {
        uint16_t reg_addr = start_addr + i;
        uint16_t reg_value = 0;

        // 根据寄存器地址返回相应的值
        switch (reg_addr)
        {
        case 0xF000: // BL_MAGIC
            reg_value = 0xBEEF;
            break;
        case 0xF001: // BL_VERSION
            reg_value = ((uint16_t)BL_PROTO_MAJOR_VERSION << 8) | BL_PROTO_MINOR_VERSION;
            break;
        case 0xF002: // BL_STATE
            reg_value = (uint16_t)proto->state;
            break;
        case 0xF003:            // BL_CAPABILITY
            reg_value = 0x0001; // 支持本地MCU编程
            break;
        case 0xF004:            // BL_ERROR_CODE
            reg_value = 0x0000; // 无错误
            break;
        case 0xF100: // FLASH_SIZE (高位)
            reg_value = (flash_mgr->ops.get_size(flash_mgr->flash_ptr) >> 16) & 0xFFFF;
            break;
        case 0xF101: // FLASH_SIZE (低位)
            reg_value = flash_mgr->ops.get_size(flash_mgr->flash_ptr) & 0xFFFF;
            break;
        case 0xF102: // FLASH_APP_START (高位)
            reg_value = (proto->app_start_addr >> 16) & 0xFFFF;
            break;
        case 0xF103: // FLASH_APP_START (低位)
            reg_value = proto->app_start_addr & 0xFFFF;
            break;
        case 0xF104: // FLASH_APP_MAX_SIZE (高位)
            reg_value = (proto->app_max_size >> 16) & 0xFFFF;
            break;
        case 0xF105: // FLASH_APP_MAX_SIZE (低位)
            reg_value = proto->app_max_size & 0xFFFF;
            break;
        case 0xF300: // APP_INFO_VALID_FLAG
            reg_value = proto->app_info.valid_flag;
            break;
        case 0xF303: // APP_INFO_VERSION_MAJOR
            reg_value = proto->app_info.major_version;
            break;
        case 0xF304: // APP_INFO_VERSION_MINOR
            reg_value = (proto->app_info.minor_version) & 0xFFFF;
            break;
        case 0xF305: // APP_INFO_BUILD_VERSION (高位)
            reg_value = (proto->app_info.build_version >> 16) & 0xFFFF;
            break;
        case 0xF306: // APP_INFO_BUILD_VERSION (低位)
            reg_value = (proto->app_info.build_version) & 0xFFFF;
            break;
        case 0xF307: // 应用程序实际长度（字节）高位
            reg_value = (proto->app_info.app_length >> 16) & 0xFFFF;
            break;
        case 0xF308: // 应用程序实际长度（字节）低位
            reg_value = (proto->app_info.app_length) & 0xFFFF;
            break;
        case 0xF309: // APP_INFO_CRC32 (高位)
            reg_value = (proto->app_info.crc32 >> 16) & 0xFFFF;
            break;
        case 0xF30A: // APP_INFO_CRC32 (低位)
            reg_value = (proto->app_info.crc32) & 0xFFFF;
            break;
        case 0xF30B: // 应用程序构建时间戳高位
            reg_value = (proto->app_info.timestamp >> 16) & 0xFFFF;
            break;
        case 0xF30C: // 应用程序构建时间戳低位
            reg_value = (proto->app_info.timestamp) & 0xFFFF;
            break;
        default:
            reg_value = 0x0000; 
            break;
        }

        resp->data[i * 2 + 1] = (reg_value >> 8) & 0xFF;
        resp->data[i * 2 + 2] = reg_value & 0xFF;
    }

    resp->data[0] = reg_count * 2;
    resp->data_len = reg_count * 2 + 1; // 字节计数 + 寄存器数据

    return LWMB_OK;
}

/**
 * @brief 处理进入引导加载程序模式请求(功能码0x65)
 * @param proto 协议处理器指针
 * @param resp 响应数据
 * @return 协议层正确返回LWMB_OK
 *
 * 请求格式：无参数
 * 响应格式：无数据
 */
static lwmb_err_t bl_proto_handle_enter_bl(bl_proto_t *proto, bl_proto_response_t *resp)
{
    proto->state = BL_PROTO_STATE_BOOTLOADER;
    proto->in_bootloader = true;

    resp->data[0] = BL_PROTO_STATUS_SUCCESS;
    resp->data_len = 1;

    return LWMB_OK;
}

/**
 * @brief 处理Flash擦除请求(功能码0x66)
 * @param proto 协议处理器指针
 * @param req 请求数据
 * @param resp 响应数据
 * @return 帧数据错误返回LWMB_ERR_FRAME，协议层正确但执行操作有问题返回LWMB_OK
 *
 * 请求格式：[起始地址(4字节)][擦除长度(4字节)]
 * 响应格式：[起始地址(4字节)][擦除长度(4字节)]
 * 帧数据错误：数据长度不足
 * 协议错误：地址无效、擦除失败
 */
static lwmb_err_t bl_proto_handle_erase(bl_proto_t *proto, const bl_proto_request_t *req,   
                          bl_proto_response_t *resp)
{
    bl_flash_mgr_t *flash_mgr = bl_flash_mgr_get_active();
    if (flash_mgr == NULL) {
        return LWMB_ERR_FRAME;
    }

    if (req->data_len < 8)
    {
        return LWMB_ERR_FRAME;
    }

    uint32_t proto_start_addr = ((uint32_t)req->data[0] << 24) | ((uint32_t)req->data[1] << 16) |
                          ((uint32_t)req->data[2] << 8) | req->data[3];
    uint32_t proto_length = ((uint32_t)req->data[4] << 24) | ((uint32_t)req->data[5] << 16) |
                      ((uint32_t)req->data[6] << 8) | req->data[7];

    uint32_t start_addr, length;
    if (proto_start_addr == 0xFFFFFFFF && proto_length == 0xFFFFFFFF)
    {
        start_addr = proto->app_start_addr;
        length = proto->app_max_size;
    }
    else
    {
        start_addr = proto_start_addr;
        length = proto_length;
    }

    uint8_t sector = flash_mgr->ops.addr_to_sector(flash_mgr->flash_ptr, start_addr);
    if (sector == 0xFF)
    {
        resp->data[0] = BL_PROTO_STATUS_INVALID_RANGE;
        resp->data_len = 9;
        return LWMB_OK;
    }

    uint32_t actual_start_addr = flash_mgr->ops.get_sector_start_addr(flash_mgr->flash_ptr, sector);
    uint32_t actual_length = 0;
    
    int result = flash_mgr->ops.erase(flash_mgr->flash_ptr, start_addr, length, &actual_start_addr, &actual_length);
    if (result != BL_SUCCESS)
    {
        resp->data[0] = BL_PROTO_STATUS_ERASE_FAIL;
        resp->data_len = 9; 
        return LWMB_OK;
    }


    resp->data[1] = (actual_start_addr >> 24) & 0xFF;
    resp->data[2] = (actual_start_addr >> 16) & 0xFF;
    resp->data[3] = (actual_start_addr >> 8) & 0xFF;
    resp->data[4] = actual_start_addr & 0xFF;
    resp->data[5] = (actual_length >> 24) & 0xFF;
    resp->data[6] = (actual_length >> 16) & 0xFF;
    resp->data[7] = (actual_length >> 8) & 0xFF;
    resp->data[8] = actual_length & 0xFF;
    resp->data[9] = BL_PROTO_STATUS_SUCCESS;
    resp->data_len = 9;

    return LWMB_OK;
}

/**
 * @brief 处理Flash写入请求(功能码0x67)
 * @param proto 协议处理器指针
 * @param req 请求数据
 * @param resp 响应数据
 * @return 帧数据错误返回LWMB_ERR_FRAME，协议层正确但执行操作有问题返回LWMB_OK
 *
 * 请求格式：[地址(4字节)][长度(2字节)][数据...]
 * 响应格式：[已写入长度(2字节)]
 * 帧数据错误：数据长度不足
 * 协议错误：地址无效、写入失败
 *
 * 注意：数据长度以字节为单位，但Flash操作以16位字为单位
 */
static lwmb_err_t bl_proto_handle_write(bl_proto_t *proto, const bl_proto_request_t *req,
                          bl_proto_response_t *resp)
{
    bl_flash_mgr_t *flash_mgr = bl_flash_mgr_get_active();
    if (flash_mgr == NULL) {
        return LWMB_ERR_FRAME;
    }

    if (req->data_len < 6)
    {
        return LWMB_ERR_FRAME;
    }

    // 解析地址和长度参数
    uint32_t addr = ((uint32_t)req->data[0] << 24) | ((uint32_t)req->data[1] << 16) |
                    ((uint32_t)req->data[2] << 8) | req->data[3];
    uint16_t byte_length = ((uint16_t)req->data[4] << 8) | req->data[5];
    const uint8_t *byte_data = &req->data[6];

    // 检查地址范围是否有效
    uint8_t sector = flash_mgr->ops.addr_to_sector(flash_mgr->flash_ptr, addr);
    if (sector == 0xFF)
    {
        resp->data[0] = BL_PROTO_STATUS_INVALID_RANGE;
        resp->data[1] = 0;
        resp->data[2] = 0;
        resp->data_len = 3;
        return LWMB_OK;
    }

    if (byte_length > BL_PROTO_MAX_RX_DATA_LEN)
    {
        resp->data[0] = BL_PROTO_STATUS_INVALID_RANGE;
        resp->data[1] = 0;
        resp->data[2] = 0;
        resp->data_len = 3;
        return LWMB_OK;
    }

    // 将字节数据转换为16位字数据
    uint16_t word_length = (byte_length + 1) / 2; // 字节数转换为字数（向上取整）

    // 复制数据并处理字节序
    for (uint16_t i = 0; i < word_length; i++)
    {
        uint16_t word = (uint16_t)byte_data[i * 2];
        if (i * 2 + 1 < byte_length)
        {
            word |= byte_data[i * 2 + 1] << 8;
        }
        word_data[i] = word;
    }

    // 调用Flash写入函数（以字为单位）
    int result = flash_mgr->ops.write(flash_mgr->flash_ptr, addr, word_data, word_length);
    if (result != BL_SUCCESS)
    {
        resp->data[0] = BL_PROTO_STATUS_WRITE_FAIL;
        resp->data[1] = 0;
        resp->data[2] = 0;
        resp->data_len = 3;
        return LWMB_OK;
    }

    // 返回实际写入的字节数
    resp->data[0] = BL_PROTO_STATUS_SUCCESS;
    resp->data[1] = (byte_length >> 8) & 0xFF;
    resp->data[2] = byte_length & 0xFF;
    resp->data_len = 3;

    return LWMB_OK;
}

/**
 * @brief 处理跳转到应用程序请求(功能码0x69)
 * @param proto 协议处理器指针
 * @param req 请求数据
 * @param resp 响应数据
 * @return 帧数据错误返回LWMB_ERR_FRAME，协议层正确但执行操作有问题返回LWMB_OK
 *
 * 请求格式：[跳转地址(4字节)]
 * 响应格式：无数据
 * 帧数据错误：数据长度不足
 * 协议错误：应用程序无效
 */
static lwmb_err_t bl_proto_handle_jump(bl_proto_t *proto, const bl_proto_request_t *req,
                         bl_proto_response_t *resp)
{
    if (req->data_len < 4)
    {
        return LWMB_ERR_FRAME;
    }

    uint32_t jump_addr = ((uint32_t)req->data[0] << 24) | ((uint32_t)req->data[1] << 16) |
                         ((uint32_t)req->data[2] << 8) | req->data[3];

    if (jump_addr == 0xFFFFFFFF)
    {
        if (proto->app_info.valid_flag)
        {
            jump_addr = proto->app_start_addr;
            //TODO: 跳转至应用程序

        }
        else
        {
            resp->data[0] = BL_PROTO_STATUS_INVALID_APP;
            resp->data_len = 1;
            return LWMB_OK;
        }
    }
    else
    {
        jump_addr = proto->app_start_addr;
        //TODO: 跳转至应用程序
    }

    resp->data[0] = BL_PROTO_STATUS_SUCCESS;
    resp->data_len = 1;

    return LWMB_OK;
}

/**
 * @brief 读取app_info结构体
 * @param proto 协议处理器指针
 * @param app_info app_info结构体指针
 * @return 成功返回BL_SUCCESS，失败返回错误码
 */
static int bl_proto_read_app_info(bl_proto_t *proto, bl_app_info_t *app_info)
{
    bl_flash_mgr_t *flash_mgr = bl_flash_mgr_get_active();
    if (flash_mgr == NULL) {
        return BL_INVALID_PARAM;
    }

    uint8_t* info_ptr = (uint8_t*)app_info;
    int result = flash_mgr->ops.read(flash_mgr->flash_ptr, BL_APP_INFO_ADDR, info_ptr, sizeof(bl_app_info_t));
    if (result != BL_SUCCESS) {
        return result;
    }

    if (app_info->magic != 0xDEADBEEF)
    {
        memset(app_info, 0, sizeof(bl_app_info_t));
        return BL_FLASH_ERROR;
    }

    return BL_SUCCESS;
}

/**
 * @brief 写入app_info结构体到Flash
 * @param proto 协议处理器指针
 * @param app_info app_info结构体指针
 * @return 成功返回BL_SUCCESS，失败返回错误码
 */
static int bl_proto_write_app_info(bl_proto_t *proto, const bl_app_info_t *app_info)
{
    bl_flash_mgr_t *flash_mgr = bl_flash_mgr_get_active();
    if (flash_mgr == NULL) {
        return BL_INVALID_PARAM;
    }

    uint8_t sector = flash_mgr->ops.addr_to_sector(flash_mgr->flash_ptr, BL_APP_INFO_ADDR);
    if (sector == 0xFF)
    {
        return BL_INVALID_PARAM;
    }

    const uint16_t *info_ptr = (const uint16_t *)app_info;
    int result = flash_mgr->ops.write(flash_mgr->flash_ptr, BL_APP_INFO_ADDR, info_ptr, sizeof(bl_app_info_t));
    flash_mgr->ops.flush(flash_mgr->flash_ptr);

    return result;
}

/**
 * @brief 处理刷新FLASH缓存请求(功能码0x68)
 * @param proto 协议处理器指针
 * @param req 请求数据
 * @param resp 响应数据
 * @return 成功返回BL_SUCCESS，失败返回错误码
 *
 * 请求格式：无参数
 * 响应格式：[状态(1字节)]
 */
static lwmb_err_t bl_proto_handle_flush_cache(bl_proto_t *proto, const bl_proto_request_t *req,
                                bl_proto_response_t *resp)
{
    bl_flash_mgr_t *flash_mgr = bl_flash_mgr_get_active();
    if (flash_mgr == NULL) {
        return LWMB_ERR_FRAME;
    }

    int result = flash_mgr->ops.flush(flash_mgr->flash_ptr);
    if (result != BL_SUCCESS)
    {
        resp->data[0] = BL_PROTO_STATUS_ERROR;
        resp->data_len = 1;
        return LWMB_OK;
    }

    resp->data[0] = BL_PROTO_STATUS_SUCCESS;
    resp->data_len = 1; 

    return LWMB_OK;
}

/**
 * @brief 处理完成APP写入请求(功能码0x6A)
 * @param proto 协议处理器指针
 * @param req 请求数据
 * @param resp 响应数据
 * @return 成功返回BL_SUCCESS，失败返回错误码
 *
 * 请求格式：[主版本号(1字节)][次版本号(1字节)][构建版本(2字节)][应用长度(4字节)][CRC32值(4字节)][时间戳(4字节)]
 * 响应格式：[状态(1字节)]
 */
static lwmb_err_t bl_proto_handle_finish_app_write(bl_proto_t *proto, const bl_proto_request_t *req,
                                     bl_proto_response_t *resp)
{
    if (req->data_len < 16)
    {
        return LWMB_ERR_FRAME;
    }

    // 解析请求参数
    uint16_t major_version = req->data[0];
    uint16_t minor_version = req->data[1];
    uint32_t build_version = ((uint32_t)req->data[2] << 8) | req->data[3];
    uint32_t app_length = ((uint32_t)req->data[4] << 24) | ((uint32_t)req->data[5] << 16) |
                          ((uint32_t)req->data[6] << 8) | req->data[7];
    uint32_t crc32 = ((uint32_t)req->data[8] << 24) | ((uint32_t)req->data[9] << 16) |
                     ((uint32_t)req->data[10] << 8) | req->data[11];
    uint32_t timestamp = ((uint32_t)req->data[12] << 24) | ((uint32_t)req->data[13] << 16) |
                         ((uint32_t)req->data[14] << 8) | req->data[15];

    // 创建app_info结构体
    bl_app_info_t app_info;
    app_info.magic = 0xDEADBEEF;
    app_info.major_version = major_version;
    app_info.minor_version = minor_version;
    app_info.build_version = build_version;
    app_info.app_length = app_length;
    app_info.crc32 = crc32;
    app_info.timestamp = timestamp;
    app_info.valid_flag = 0xAA;
    memset(app_info.reserved, 0, sizeof(app_info.reserved));

    // 写入app_info到Flash
    int result = bl_proto_write_app_info(proto, &app_info);
    if (result != BL_SUCCESS)
    {
        resp->data[0] = BL_PROTO_STATUS_WRITE_FAIL;
        resp->data_len = 1;
        return LWMB_OK;
    }
    proto->app_info = app_info;

    resp->data[0] = BL_PROTO_STATUS_SUCCESS;
    resp->data_len = 1; 

    return LWMB_OK;
}

static lwmb_err_t bl_proto_handle_reset(bl_proto_t *proto, bl_proto_response_t *resp)
{
    //:TODO 复位芯片
    resp->data[0] = BL_PROTO_STATUS_SUCCESS;
    resp->data_len = 1; 

    return LWMB_OK;
}

/**
 * @brief 处理所有协议请求的主函数
 * @param proto 协议处理器指针
 * @param req 请求数据
 * @param resp 响应数据
 * @return 帧数据错误返回LWMB_ERR_FRAME，协议层正确但执行操作有问题返回LWMB_OK
 *
 * 根据功能码分发到相应的处理函数
 * 帧数据错误：参数检查失败
 * 协议错误：不支持的功能码
 */
lwmb_err_t bl_proto_process_request(bl_proto_t *proto, const bl_proto_request_t *req, bl_proto_response_t *resp)
{
    resp->slave_addr = req->slave_addr;
    resp->func_code = req->func_code;

    switch (req->func_code)
    {
    case BL_PROTO_FUNC_READ_INPUT:
        return bl_proto_handle_read_registers(proto, req, resp);

    case BL_PROTO_FUNC_ENTER_BL:
        return bl_proto_handle_enter_bl(proto, resp);

    case BL_PROTO_FUNC_ERASE:
        return bl_proto_handle_erase(proto, req, resp);

    case BL_PROTO_FUNC_WRITE:
        return bl_proto_handle_write(proto, req, resp);

    case BL_PROTO_FUNC_FLUSH_CACHE:
        return bl_proto_handle_flush_cache(proto, req, resp);

    case BL_PROTO_FUNC_JUMP:
        return bl_proto_handle_jump(proto, req, resp);

    case BL_PROTO_FUNC_RESET:
        return bl_proto_handle_reset(proto, resp);

    case BL_PROTO_FUNC_FINISH_APP_WRITE:
        return bl_proto_handle_finish_app_write(proto, req, resp);

    default:
        return LWMB_ERR_FUNC; // 协议层正确，但功能码不支持
    }
}
