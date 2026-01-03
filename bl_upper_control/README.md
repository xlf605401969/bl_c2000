# Bootloader上位机程序

基于Modbus协议的C2000芯片Bootloader上位机程序，用于烧录HEX固件文件。

## 功能特性

- 支持Intel HEX格式固件文件解析
- 基于Modbus RTU协议的串口通信
- 完整的烧录流程：进入BL模式、擦除、写入、刷新、完成、跳转
- 自动CRC32校验
- 进度显示

## 安装依赖

在bl_upper目录下运行：

```bash
pip install -r requirements.txt
```

## 使用方法

基本用法：

```bash
python main.py -p COM3 -f firmware.hex
```

完整参数：

```bash
python main.py --port COM3 --file firmware.hex --baudrate 115200 --slave-id 1 --major 1 --minor 0 --build 0 --chunk-size 256 --verbose
```

### 参数说明

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| --port | -p | 串口设备名称 (必需) | - |
| --file | -f | HEX固件文件路径 (必需) | - |
| --baudrate | -b | 串口波特率 | 115200 |
| --slave-id | -s | Modbus从站ID | 1 |
| --major | - | 主版本号 | 1 |
| --minor | - | 次版本号 | 0 |
| --build | - | 构建版本号 | 0 |
| --chunk-size | - | 每次写入的数据块大小 | 256 |
| --verbose | -v | 显示详细的Modbus通讯信息 | False |

### 使用示例

1. 烧录固件到COM3端口：
```bash
python main.py -p COM3 -f firmware.hex
```

2. 使用自定义波特率和版本号：
```bash
python main.py -p COM4 -f app.hex -b 9600 --major 2 --minor 1 --build 100
```

3. 使用详细模式显示Modbus通讯信息：
```bash
python main.py -p COM3 -f firmware.hex -v
```

4. 查看帮助信息：
```bash
python main.py --help
```

## 烧录流程

程序会自动执行以下步骤：

1. 连接串口
2. 进入引导加载程序模式 (功能码 0x65)
3. 擦除闪存 (功能码 0x66)
4. 写入固件数据 (功能码 0x67)
5. 刷新FLASH缓存 (功能码 0x68)
6. 完成APP写入 (功能码 0x6A)
7. 跳转到应用程序 (功能码 0x69)

## 文件结构

```
bl_upper_control/
├── main.py              # 主程序入口
├── modbus_client.py     # Modbus通讯模块
├── hex_parser.py        # HEX文件解析模块
├── flasher.py           # 烧录流程控制
└── requirements.txt     # Python依赖
```

## 协议说明

本程序基于Bootloader协议文档实现，支持以下功能码：

- 0x65: 进入引导加载程序模式
- 0x66: 擦除闪存
- 0x67: 写入闪存
- 0x68: 刷新FLASH缓存
- 0x69: 跳转到应用程序
- 0x6A: 完成APP写入

详细协议说明请参考 [bl_main/PROTOCOL.md](../bl_main/PROTOCOL.md)

## 注意事项

1. 确保串口连接正确
2. 烧录过程中不要断开连接
3. 确保HEX文件格式正确
4. C2000芯片每个地址对应16bit内存宽度
