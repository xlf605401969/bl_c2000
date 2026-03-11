# HEX2 文件格式说明

## 1. 目标

HEX2 是一个面向本项目上位机烧录场景的文本容器格式，用于将多个固件镜像组合到一个文件中，同时尽量复用现有 Intel HEX 解析能力。

本格式的设计目标如下：

- 在一个文件中同时承载主 MCU、CM、CPU2 以及后续扩展目标的镜像。
- 段内继续使用标准 Intel HEX 记录，便于复用现有工具链输出。
- 所有分段统一使用同一套段头字段，不为标准目标和自定义目标设计两套格式。
- 由 `target` 决定烧录目标，由 `addr-unit` 和 `combine` 决定地址语义与合并方式。
- 预留其他自定义段能力，保证后续扩展时格式无需破坏性调整。
- 优先保证解析实现简单、可读、易于人工检查。

HEX2 不是 Intel HEX 的替代品，而是 Intel HEX 的多段封装格式。

## 2. 适用范围

当前版本的 HEX2 用于描述以下逻辑目标：

- `cpu1`：主 MCU
- `cm`：CM 核
- `cpu2`：CPU2
- 其他自定义目标，例如 `config`、`ram-helper`、`calib`

其中：

- `cpu1` 采用 C28x 16 位字地址语义，通常由一对 low/high 分段组成。
- `cm` 采用 8 位字节地址语义，通常由单段镜像组成。
- `cpu2` 当前按与 `cpu1` 一致的 high/low 双段模型定义，即 16 位字地址语义。
- 自定义目标用于承载后续专用镜像或附加数据，首版实现可先识别并拒绝烧录。

## 3. 总体结构

HEX2 文件是纯文本文件，由以下内容组成：

1. 文件头
2. 一个或多个分段头
3. 每个分段对应的 Intel HEX 内容

格式约定：

- 控制行以 `@` 开头。
- Intel HEX 记录行以 `:` 开头。
- 注释行以 `;` 或 `#` 开头。
- 空行允许存在，解析时应忽略。

推荐文件扩展名：`.hex2`

推荐文本编码：UTF-8

## 4. 文件头

文件第一个非空、非注释行必须是：

```text
@HEX2 version=1
```

说明：

- `@HEX2` 是格式魔数。
- `version=1` 表示当前规范版本。
- 若版本不支持，加载器必须报错并拒绝继续解析。

## 5. 分段头

每个逻辑镜像段以一行分段头开始，格式如下：

```text
@SEGMENT name=<segment-name> target=<target-id> addr-unit=<addr-unit> combine=<combine-mode> [purpose=<purpose>]
```

字段说明：

- `name`：必填，表示段名称，必须在同一文件内唯一。
- `target`：必填，表示烧录目标。
- `addr-unit`：必填，表示地址单位。
- `combine`：必填，表示该段是否需要与其他段配对合并。
- `purpose`：可选，表示该段业务用途，便于界面展示和后续策略扩展。

当前推荐的标准 `target` 取值如下：

| target | 含义 | 当前支持状态 |
| --- | --- | --- |
| `cpu1` | 主 MCU | 支持 |
| `cm` | CM 核 | 支持 |
| `cpu2` | CPU2 | 预留 |
| `<custom-target>` | 其他自定义目标 | 预留 |

标准字段值约定如下：

| 字段 | 允许值 | 说明 |
| --- | --- | --- |
| `addr-unit` | `word16`、`byte8` | `word16` 表示地址按 16 位字计数，`byte8` 表示地址按字节计数 |
| `combine` | `none`、`pair-low`、`pair-high` | `pair-low` 和 `pair-high` 表示该段需要与同目标下的另一段配对合并 |

通用约束如下：

- 同一个文件中，`name` 必须唯一。
- `target` 可以重复出现。
- 是否配对、如何配对，统一由 `combine` 决定。
- 同一个文件中不得出现未知控制行。

推荐的标准段命名约定如下：

| name | target | addr-unit | combine | 说明 |
| --- | --- | --- | --- | --- |
| `cpu1-low` | `cpu1` | `word16` | `pair-low` | 主 MCU 低位字节段 |
| `cpu1-high` | `cpu1` | `word16` | `pair-high` | 主 MCU 高位字节段 |
| `cm-image` | `cm` | `byte8` | `none` | CM 主镜像段 |
| `cpu2-low` | `cpu2` | `word16` | `pair-low` | CPU2 低位字节段 |
| `cpu2-high` | `cpu2` | `word16` | `pair-high` | CPU2 高位字节段 |

说明：

- 上表只是推荐命名，不是强制语义。
- 解析时应以 `target`、`addr-unit`、`combine` 为准，而不是以 `name` 为准。

## 6. 分段内容

分段头之后，直到该分段的 Intel HEX EOF 记录为止，全部视为该分段的 Intel HEX 内容。

每个分段内部必须是一个完整、合法的 Intel HEX 文本片段，并且必须包含 EOF 记录：

```text
:00000001FF
```

分段内容要求：

- 必须符合标准 Intel HEX 校验规则。
- 允许使用数据记录 `00`。
- 允许使用扩展段地址记录 `02`。
- 允许使用扩展线性地址记录 `04`。
- 其他记录类型若现有解析器无法处理，建议直接报错，而不是静默忽略。

注意：

- 在 HEX2 中，Intel HEX 的 EOF 记录表示“当前分段结束”，而不是“整个 HEX2 文件结束”。
- EOF 之后如果还有内容，下一条有效控制行必须是新的 `@SEGMENT`，否则报错。

## 7. 语义规则

### 7.1 `target=cpu1` 规则

当文件中存在 `target=cpu1` 的段时，上位机应按以下规则构造主 MCU 数据：

- 必须存在且仅存在一个 `combine=pair-low` 段和一个 `combine=pair-high` 段。
- 两个段的 `addr-unit` 必须都是 `word16`。
- 两个段的地址集合必须完全一致。
- 若地址不一致，必须报错。
- 对于相同地址 `A`：
  - `pair-low[A]` 为低字节
  - `pair-high[A]` 为高字节
  - 合并结果为一个 16 位字，按小端顺序输出为 `[low, high]`
- 合并后的逻辑地址仍为 16 位字地址。

### 7.2 `target=cm` 规则

当文件中存在 `target=cm` 的段时：

- 标准主镜像段应使用 `combine=none`。
- `addr-unit` 应为 `byte8`。
- 数据直接作为 8 位数据块写入。
- 不参与与其他目标段的地址对齐或合并。

首版建议只支持一个 `target=cm` 且 `combine=none` 的固件主段。

### 7.3 `target=cpu2` 规则

`target=cpu2` 采用与 `target=cpu1` 一致的 high/low 双段合并规则。

当文件中存在 `target=cpu2` 的段时，上位机应按以下规则构造 CPU2 数据：

- 必须存在且仅存在一个 `combine=pair-low` 段和一个 `combine=pair-high` 段。
- 两个段的 `addr-unit` 必须都是 `word16`。
- 两个段的地址集合必须完全一致。
- 若地址不一致，必须报错。
- 对于相同地址 `A`：
  - `pair-low[A]` 为低字节
  - `pair-high[A]` 为高字节
  - 合并结果为一个 16 位字，按小端顺序输出为 `[low, high]`
- 合并后的逻辑地址仍为 16 位字地址。

在 CPU2 烧录尚未实现前，加载器读到 `target=cpu2` 时应返回“文件格式合法，但当前版本不支持该目标”的错误。

### 7.4 自定义 `target` 规则

自定义目标用于承载标准目标之外的数据，例如：

- 配置分区镜像
- 校准数据镜像
- 仅下载到 RAM 的辅助镜像
- 未来新增核镜像

建议采用以下约束：

- `target` 由业务定义，例如 `config`、`ram-helper`、`calib`。
- `name` 必须唯一。
- `addr-unit` 必须显式给出。
- `combine=none` 表示单段数据。
- `combine=pair-low` 或 `pair-high` 表示该目标下的该段需要和另一段配对合并。

首版上位机可以只完成以下行为：

- 识别非标准 `target` 段。
- 在界面或日志中展示其元信息。
- 明确提示“当前版本暂不支持烧录该目标”。

## 8. 必填组合规则

HEX2 文件允许只携带部分目标镜像，但每个目标自身必须完整。

合法组合示例：

- `target=cpu1` 下一个 `pair-low` 段加一个 `pair-high` 段。
- 一个 `target=cm` 且 `combine=none` 的段。
- `cpu1` 配对段加 `cm` 单段。
- `cpu1` 配对段加 `cm` 单段加 `cpu2` 配对段。
- `cpu1` 配对段加一个自定义 `target=config` 单段。

非法组合示例：

- `target=cpu1` 下只有 `pair-low`，没有 `pair-high`。
- `target=cpu1` 下只有 `pair-high`，没有 `pair-low`。
- `target=cpu2` 下只有 `pair-low`，没有 `pair-high`。
- `target=cpu2` 下只有 `pair-high`，没有 `pair-low`。
- `target=cm` 使用了 `pair-low` 或 `pair-high`。
- 两个段使用了相同 `name`。

推荐校验规则：

- `target=cpu1` 必须恰好形成一对 `pair-low` 和 `pair-high`。
- `target=cpu2` 必须恰好形成一对 `pair-low` 和 `pair-high`。
- `target=cm` 标准镜像应使用 `combine=none`。
- 自定义 `target` 可独立出现，但必须满足字段完整性要求。
- `cpu2` 段和自定义 `target` 段可在实现时作为“格式合法但功能未支持”处理。

## 9. 解析流程建议

上位机加载 HEX2 时，建议按以下步骤处理：

1. 读取全文本，按行拆分。
2. 跳过空行和注释行。
3. 校验文件头是否为 `@HEX2 version=1`。
4. 读取每个 `@SEGMENT` 分段头。
5. 收集该分段下所有 `:` 开头的 Intel HEX 行，直到遇到该段 EOF。
6. 对该段单独执行 Intel HEX 解析与校验。
7. 按 `target` 将分段归类，并按 `combine` 决定是单段还是配对段。
8. 执行跨段一致性检查：
   - `cpu1` 配对段是否成对存在。
   - `cpu1` 配对段地址集合是否完全一致。
   - `cpu2` 配对段是否成对存在。
   - `cpu2` 配对段地址集合是否完全一致。
   - 每个分段的 `name`、`target`、`addr-unit`、`combine` 是否满足约束。
   - 是否存在重复 `name`。
9. 生成供烧录器使用的逻辑结果：
   - 主 MCU：16 位字地址数据块。
   - CM：8 位字节地址数据块。
   - CPU2：16 位字地址数据块。
   - 自定义目标：按元信息保留原始分段数据。

## 10. 错误处理建议

以下情况必须报错：

- 文件头缺失。
- `version` 不支持。
- `@SEGMENT` 缺少 `name`。
- `@SEGMENT` 缺少 `target`。
- `@SEGMENT` 缺少 `addr-unit`。
- `@SEGMENT` 缺少 `combine`。
- 分段内 Intel HEX 校验失败。
- 分段缺少 EOF。
- `target=cpu1` 的 low/high 段未成对出现。
- `target=cpu1` 的 low/high 段地址不一致。
- `target=cpu2` 的 low/high 段未成对出现。
- `target=cpu2` 的 low/high 段地址不一致。
- `target=cm` 的段使用了非法 `combine`。
- 分段 `name` 重复。
- 出现未知控制行。

以下情况建议作为“支持性错误”处理：

- 出现 `target=cpu2`，但当前程序尚未实现 CPU2 烧录。
- 出现自定义 `target`，但当前程序尚未实现该 `target` 的处理逻辑。

## 11. 示例

下面是一个包含主 MCU、CM、CPU2 和自定义目标的示例：

```text
@HEX2 version=1

@SEGMENT name=cpu1-low target=cpu1 addr-unit=word16 combine=pair-low purpose=firmware
:020000040008F2
:100000000102030405060708090A0B0C0D0E0F1068
:00000001FF

@SEGMENT name=cpu1-high target=cpu1 addr-unit=word16 combine=pair-high purpose=firmware
:020000040008F2
:100000001112131415161718191A1B1C1D1E1F2058
:00000001FF

@SEGMENT name=cm-image target=cm addr-unit=byte8 combine=none purpose=firmware
:020000040020DA
:10000000AABBCCDDEEFF00112233445566778899D4
:00000001FF

@SEGMENT name=cpu2-low target=cpu2 addr-unit=word16 combine=pair-low purpose=firmware
:020000040030CA
:100000002122232425262728292A2B2C2D2E2F3048
:00000001FF

@SEGMENT name=cpu2-high target=cpu2 addr-unit=word16 combine=pair-high purpose=firmware
:020000040030CA
:100000003132333435363738393A3B3C3D3E3F4038
:00000001FF

@SEGMENT name=config-zone target=config addr-unit=byte8 combine=none purpose=config
:020000040040BA
:1000000055AA55AA55AA55AA55AA55AA55AA55AA88
:00000001FF
```

该示例的含义是：

- 主 MCU 在字地址 `0x00080000` 开始有一段数据。
- `target=cpu1` 下两段数据分别提供低位和高位字节。
- `target=cm` 下有一段字节地址的独立固件镜像。
- `target=cpu2` 下两段数据的合并方式与主 MCU 相同。
- `config-zone` 是一个自定义目标 `config` 的字节地址段。

## 12. 推荐的数据结构

为了便于上位机实现，建议解析后输出如下逻辑结构：

```javascript
{
  format: 'HEX2',
  version: 1,
  targets: {
    cpu1: {
      lowSegmentName: 'cpu1-low',
      highSegmentName: 'cpu1-high',
      low: Map<wordAddress, byte>,
      high: Map<wordAddress, byte>,
      mergedBlocks: Map<wordAddress, Buffer>
    },
    cm: {
      segmentName: 'cm-image',
      blocks: Map<byteAddress, Buffer>
    },
    cpu2: {
      lowSegmentName: 'cpu2-low',
      highSegmentName: 'cpu2-high',
      low: Map<wordAddress, byte>,
      high: Map<wordAddress, byte>,
      mergedBlocks: Map<wordAddress, Buffer>
    },
    customTargets: {
      config: [
        {
          name: 'config-zone',
          target: 'config',
          addrUnit: 'byte8',
          combine: 'none',
          blocks: Map<byteAddress, Buffer>
        }
      ]
    }
  }
}
```

如果后续需要兼容当前上位机实现，最直接的落地方式是：

- `target=cpu1` 或 `target=cpu2` 且为 `pair-low` / `pair-high` 的段，可复用现有双 HEX 合并逻辑。
- `target=cm` 且 `combine=none` 的段，可复用现有单 HEX 解析逻辑。
- 在 HEX2 解析层只负责“拆段”和“分发”。

## 13. 与现有系统的对应关系

本规范与当前项目实现保持以下一致性：

- 主 MCU 当前使用双 HEX 输入，地址语义为 16 位字地址。
- CM 当前使用单 HEX 输入，地址语义为字节地址。
- CPU2 在 HEX2 规范中按与主 MCU 相同的配对段语义定义，便于后续直接复用主 MCU 解析路径。
- `cpu1`、`cm`、`cpu2` 在规范中都只是推荐的标准 `target` 值，不再使用专门的段类型分支。
- Bootloader 协议已支持会话目标切换，后续可根据 HEX2 内包含的目标集合自动决定烧录流程。
- 当前协议层已预留 MCU2/CPU2 目标枚举，因此 HEX2 可以直接将 `target=cpu2` 作为标准目标值。

## 14. 建议的首版实现边界

为了降低首版开发复杂度，建议上位机第一阶段只实现以下能力：

- 识别 `@HEX2 version=1`。
- 支持 `target=cpu1` 的配对段和 `target=cm` 的单段。
- 识别 `target=cpu2`，但明确提示当前暂不支持烧录。
- 识别自定义 `target`，但明确提示当前暂不支持处理。
- 不支持未知控制字段。
- 不支持重复 `name`。

这样可以保证格式先稳定，再逐步扩展 CPU2 和自定义目标的实际处理能力。