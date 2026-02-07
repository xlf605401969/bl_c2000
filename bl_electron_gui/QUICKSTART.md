# 快速开始指南

## 5分钟快速上手

### 第一步：安装 Node.js

如果还没有安装 Node.js，请访问 https://nodejs.org/ 下载并安装 LTS 版本。

验证安装：
```bash
node --version
npm --version
```

### 第二步：安装依赖

在项目目录下运行：

**Windows:**
```bash
cd bl_electron_gui
npm install
```

**macOS/Linux:**
```bash
cd bl_electron_gui
npm install
```

或者直接运行启动脚本（会自动安装依赖）：

**Windows:**
```bash
start.bat
```

**macOS/Linux:**
```bash
chmod +x start.sh
./start.sh
```

### 第三步：启动应用

```bash
npm start
```

### 第四步：配置和烧录

1. 选择串口
2. 选择目标类型（主MCU或CM核）
3. 选择固件文件
4. 点击"开始烧录"

就这么简单！

## 完整安装步骤

### Windows 系统

1. **安装 Node.js**
   - 下载：https://nodejs.org/
   - 选择 LTS 版本
   - 默认安装即可

2. **安装串口驱动**（如果需要）
   - CP2102: https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers
   - FTDI: https://ftdichip.com/drivers/vcp-drivers/
   - CH340: http://www.wch.cn/downloads/CH341SER_ZIP.html

3. **安装项目依赖**
   ```bash
   cd bl_electron_gui
   npm install
   ```

4. **启动应用**
   ```bash
   npm start
   ```
   或双击 `start.bat`

### macOS 系统

1. **安装 Node.js**
   ```bash
   # 使用 Homebrew
   brew install node
   
   # 或下载安装包
   # https://nodejs.org/
   ```

2. **安装串口驱动**（如果需要）
   - 大多数驱动已内置
   - CP2102/FTDI驱动可能需要手动安装

3. **安装项目依赖**
   ```bash
   cd bl_electron_gui
   npm install
   ```

4. **启动应用**
   ```bash
   npm start
   ```
   或运行 `./start.sh`

### Linux 系统

1. **安装 Node.js**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install nodejs npm
   
   # 或使用 nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install --lts
   ```

2. **配置串口权限**
   ```bash
   # 将用户添加到 dialout 组
   sudo usermod -a -G dialout $USER
   
   # 重新登录或运行
   newgrp dialout
   ```

3. **安装项目依赖**
   ```bash
   cd bl_electron_gui
   npm install
   ```

4. **启动应用**
   ```bash
   npm start
   ```
   或运行 `./start.sh`

## 构建可执行文件

如果想要构建独立的可执行文件：

```bash
# Windows 可执行文件
npm run build:win

# macOS 应用
npm run build:mac

# Linux AppImage
npm run build:linux

# 所有平台
npm run build
```

构建完成后，可执行文件位于 `dist` 目录。

## 常见安装问题

### 1. npm install 失败

**原因：** 网络问题或权限问题

**解决方法：**
```bash
# 使用淘宝镜像
npm config set registry https://registry.npmmirror.com
npm install

# Windows 管理员权限
# 以管理员身份运行命令提示符

# Linux/macOS 权限问题
sudo npm install --unsafe-perm=true --allow-root
```

### 2. serialport 安装失败

**原因：** 需要编译原生模块

**解决方法：**
```bash
# Windows: 安装 windows-build-tools
npm install --global windows-build-tools

# macOS: 安装 Xcode Command Line Tools
xcode-select --install

# Linux: 安装构建工具
sudo apt-get install build-essential
```

### 3. Electron 下载慢

**解决方法：**
```bash
# 设置 Electron 镜像
npm config set electron_mirror https://npmmirror.com/mirrors/electron/

# 或使用环境变量
# Windows PowerShell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"

# Linux/macOS
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
```

### 4. 串口权限问题（Linux）

**解决方法：**
```bash
# 添加用户到 dialout 组
sudo usermod -a -G dialout $USER

# 或临时授权
sudo chmod 666 /dev/ttyUSB0
```

## 开发环境配置

如果想要修改代码或进行开发：

1. **安装推荐的 VSCode 扩展**
   - ESLint
   - Prettier
   - JavaScript 调试器

2. **启用开发模式**
   ```bash
   npm run dev
   ```

3. **热重载**
   修改代码后，按 `Ctrl+R` (Windows/Linux) 或 `Cmd+R` (macOS) 重载应用

## 下一步

- 查看 [README.md](README.md) 了解详细功能
- 查看 [EXAMPLES.md](EXAMPLES.md) 了解使用示例
- 查看 [../bl_main/PROTOCOL.md](../bl_main/PROTOCOL.md) 了解协议详情

## 技术支持

如遇到问题，请：
1. 查看日志输出
2. 检查串口连接
3. 参考常见问题解决方案
4. 查看 Python 版本的实现作为参考 (`../bl_upper_control/`)
