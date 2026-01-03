import struct


def create_hex_file(output_path: str, start_addr: int, length: int):
    """
    创建示例HEX文件

    Args:
        output_path: 输出文件路径
        start_addr: 起始地址
        length: 数据长度（字节）
    """
    with open(output_path, 'w') as f:
        current_addr = start_addr
        remaining = length
        last_upper_addr = -1

        # 写入数据记录
        word_value = 0x0001
        while remaining > 0:
            # 每个记录最多32字节数据（16个16bit字）
            chunk_size = min(32, remaining)

            # 生成数据：按照16bit内存宽度，周期性填充 0x0001, 0x0002, 0x0003, ... 0x00FF, 0x0100, ...
            data = bytearray()
            for i in range(chunk_size // 2):
                word_bytes = struct.pack('<H', word_value)
                data.extend(word_bytes)
                word_value = (word_value + 1) & 0xFFFF

            # 如果有奇数个字节（最后一个字节）
            if chunk_size % 2 == 1:
                data.append(word_value & 0xFF)

            # 如果跨越64K边界，需要写入新的扩展线性地址记录
            upper_addr = current_addr >> 16
            if upper_addr != last_upper_addr:
                record = create_extended_linear_address_record(upper_addr)
                f.write(record + '\n')
                last_upper_addr = upper_addr

            # 计算当前记录的地址（低16位）
            low_addr = current_addr & 0xFFFF

            # 创建数据记录
            record = create_data_record(low_addr, data)
            f.write(record + '\n')

            # 地址按字节递增
            current_addr += chunk_size
            remaining -= chunk_size

        # 写入EOF记录
        eof_record = ':00000001FF'
        f.write(eof_record + '\n')


def create_data_record(address: int, data: bytes) -> str:
    """
    创建数据记录

    Args:
        address: 地址（低16位）
        data: 数据

    Returns:
        HEX记录字符串
    """
    byte_count = len(data)
    record_type = 0x00

    # 构建记录内容
    content = bytes([byte_count,
                     (address >> 8) & 0xFF,
                     address & 0xFF,
                     record_type]) + data

    # 计算校验和
    checksum = (~sum(content) + 1) & 0xFF

    # 转换为HEX字符串
    hex_str = ':' + content.hex().upper() + f'{checksum:02X}'
    return hex_str


def create_extended_linear_address_record(upper_addr: int) -> str:
    """
    创建扩展线性地址记录

    Args:
        upper_addr: 高16位地址

    Returns:
        HEX记录字符串
    """
    byte_count = 2
    address = 0x0000
    record_type = 0x04

    # 构建记录内容
    content = bytes([byte_count,
                     (address >> 8) & 0xFF,
                     address & 0xFF,
                     record_type,
                     (upper_addr >> 8) & 0xFF,
                     upper_addr & 0xFF])

    # 计算校验和
    checksum = (~sum(content) + 1) & 0xFF

    # 转换为HEX字符串
    hex_str = ':' + content.hex().upper() + f'{checksum:02X}'
    return hex_str


if __name__ == '__main__':
    # 参数设置
    output_file = 'sample_firmware.hex'
    start_address = 0x00088040
    data_length = 0x2000  # 131072字节

    print(f"创建示例HEX文件...")
    print(f"输出文件: {output_file}")
    print(f"起始地址: {start_address:#x}")
    print(f"数据长度: {data_length:#x} ({data_length} 字节)")

    create_hex_file(output_file, start_address, data_length)

    print(f"\nHEX文件创建完成!")
    print(f"文件大小: {data_length} 字节")
