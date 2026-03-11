# Bootloader 上位机 (Electron GUI)

基于 Electron 的 C2000 MCU Bootloader 上位机程序，提供图形化界面用于固件烧录。

![界面预览](screenshot.png)

## 功能特性

- 🎨 **现代化GUI界面** - 基于Electron构建的跨平台桌面应用
- 📡 **串口通信** - 支持Modbus RTU协议
- 🎯 **双MCU支持** - 支持主MCU（C2000，16位内存）和CM核（8位内存）
- 📊 **实时进度** - 实时显示烧录进度和状态
- 📝 **日志输出** - 详细的操作日志记录
- ⚡ **快捷操作** - 一键进入Bootloader模式、跳转到应用程序、查看系统信息
- 🎯 **会话管理** - 支持切换烧录目标（本地MCU/从MCU）
- 📋 **完整系统信息** - 读取并显示Bootloader、Flash、应用程序的完整信息

## 系统需求

- Windows 10/11、macOS 10.13+、Linux
- Node.js 16.x 或更高版本
- 可用的串口设备

## 安装

1. 克隆或下载项目到本地
2. 安装依赖：

```bash
cd bl_electron_gui
npm install
```

## 开发运行

```bash
npm start
```

或使用开发模式（自动打开开发工具）：

```bash
npm run dev
```

## 打包发布

打包为可执行文件：

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux

# 所有平台
npm run build
```

打包后的文件位于 `dist` 目录。

## 使用说明

### 主MCU固件烧录（16位内存）

1. **串口配置**
   - 选择串口设备
   - 设置波特率（默认250000）
   - 设置从站ID（默认1）

2. **选择目标**
   - 选择"主MCU (C2000, 16位内存)"

3. **选择固件文件**
   - 选择低字节HEX文件
   - 选择高字节HEX文件

4. **配置版本信息**（可选）
   - 主版本号
   - 次版本号
   - 构建号

5. **开始烧录**
   - 点击"开始烧录"按钮
   - 等待烧录完成

### CM核固件烧录（8位内存）

1. **串口配置**（同上）

2. **选择目标**
   - 选择"CM核 (8位内存)"

3. **选择固件文件**
   - 选择HEX文件

4. **配置版本信息**（同上）

5. **开始烧录**（同上）

### 快捷操作

- **进入Bootloader** - 快速让设备进入Bootloader模式
- **跳转到应用** - 让设备跳转到应用程序运行
- **查看系统信息** - 读取并显示完整的系统信息：
  - **Bootloader信息**：魔数、版本、状态、能力、错误码
  - **Flash信息**：总容量、APP起始地址、APP最大容量
  - **应用程序信息**：版本号、CRC32、Git标签等

## 烧录流程

程序会自动执行以下步骤：

1. 📖 解析HEX文件
2. 🔌 连接串口
3. 🚀 进入Bootloader模式
4. 🎯 设置会话目标（仅CM核）
5. 🗑️ 擦除闪存
6. ✍️ 写入固件数据
7. 💾 刷新FLASH缓存
8. ✅ 完成APP写入
9. 🏃 跳转到应用程序

## 协议说明

本程序实现了基于Modbus RTU的Bootloader协议，支持以下功能码：

| 功能码 | 名称 | 描述 |
|-------|------|------|
| 0x04 | 读输入寄存器 | 读取引导加载程序信息寄存器 |
| 0x65 | 进入引导加载程序模式 | 切换到引导加载程序模式 |
| 0x66 | 擦除闪存 | 按地址范围擦除闪存内存 |
| 0x67 | 写入闪存 | 将数据写入闪存内存 |
| 0x68 | 刷新FLASH缓存 | 将FLASH缓冲区全部写入FLASH |
| 0x69 | 跳转到应用程序 | 跳转到应用程序代码 |
| 0x6A | 完成APP写入 | 完成APP写入操作并更新app_info信息 |
| 0x70 | 设置会话目标 | 设置当前会话操作目标 |

详细协议规范请参考：`../bl_main/PROTOCOL.md`

多镜像组合文件格式说明请参考：`./HEX2_FORMAT.md`

## 项目结构

```
bl_electron_gui/
├── main.js                 # Electron主进程
├── preload.js              # 预加载脚本
├── package.json            # 项目配置
├── src/                    # 源代码
│   ├── hex-parser.js       # HEX文件解析器
│   ├── modbus-client.js    # Modbus通信客户端
│   └── flasher.js          # 烧录流程控制
├── renderer/               # 渲染进程（前端）
│   ├── index.html          # 主界面
│   ├── styles.css          # 样式表
│   └── app.js              # 前端逻辑
└── assets/                 # 资源文件
    └── icon.png            # 应用图标
```

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **Node.js** - 后端运行环境
- **SerialPort** - 串口通信库
- **HTML/CSS/JavaScript** - 前端界面

## 常见问题

### 1. 找不到串口设备

- 确认设备已连接并安装驱动
- 在设备管理器中检查COM口
- 尝试点击刷新按钮

### 2. 烧录失败

- 检查串口配置是否正确
- 确认固件文件路径正确
- 查看日志了解详细错误信息
- 确认设备已进入Bootloader模式

### 3. 应用无法启动

- 确认已安装Node.js
- 重新运行 `npm install`
- 检查是否有依赖安装失败

## 参考

- Python命令行版本：`../bl_upper_control/`
- 协议文档：`../bl_main/PROTOCOL.md`
- Bootloader源码：`../bl_main/` 和 `../bl_cm_proxy/`

## 许可证

MIT License

## 更新日志

### v1.0.0 (2026-02-07)

- ✨ 初始版本发布
- 🎨 实现现代化GUI界面
- 📡 支持Modbus RTU通信
- 🔧 支持主MCU和CM核烧录
- 📊 实时进度显示
- 📝 详细日志记录
