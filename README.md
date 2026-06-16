# RA-INI-Joiner

一个简单的 INI 文件管理工具，用于拼接、处理和管理多个 INI 文件。

## 支持特性
- **拼接**: 将项目内所有文件拼接为单个 INI 文件
- **宏 & 继承**: 支持提前定义宏并引用，实现代码复用
- **注册表**: 支持将指定的多个文件内的所有节统计并整合为数组
- **多语言**: 支持同时书写 YAML 和 INI，并可以无缝衔接
- **多项目**: 支持通过配置文件快速切换不同项目

## 安装

1. 确保已安装 Node.js 或 Bun
2. 克隆或下载项目
3. 安装依赖：

```bash
npm install
```

## 使用方法

```bash
node src/main.mjs <配置文件路径>
```

例如：

```bash
node src/main.mjs ini-joiner.config.yaml
```

## 配置文件

配置文件必须为 `YAML` 格式，包含以下配置项：

```yaml
InputRoot: string # 必填，指定要处理的源文件目录
OutputPath: string # 必填，指定最终生成的INI文件路径
Macro: # 必填，宏相关定义
  Root: string # 必填，指定宏文件存放目录
  IgnoreKeys: [] # 指定哪些键不应当被视作宏
  ExplicitKeys: [] # 指定哪些键需要被视作宏
  Overrides: object # 指定如何自定义映射宏
  DefaultFileSuffix: string # 指定默认查找的文件后缀名
  AutoDetect: boolean # 指定是否自动判断参数宏
Registry: 
  File: string # 指定注册表的虚拟文件名，默认 ___RegistryFile___.ini
    Table: # 定义注册表配置
    - Target: string # 目标注册表名,如 VehicleTypes
      Start: number # 起始序号，默认1
      Source: [] # 需要被注册的路径，支持Shell通配
IgnoreFiles: [] # 指定哪些文件不会被索引
ExplicitRequiredFiles: [] # 指定额外索引哪些文件
IsDetailedConsole: boolean # 在命令行中显示更多输出
```

关于所有配置的调用机制和作用，查看 [配置](./DOC.CONF.md).

## 功能

### 宏

通过引用、函数、替换等方式简化书写。详见 [宏](./DOC.MCPS.md).

### 继承

V2 的继承是宏的核心逻辑部分，这不同于其在 V1 中的特殊处理。详见 [宏](./DOC.MCPS.md).

### 注册表

通过 `Registry.File` 和 `Registry.Table` 来定义注册表：

不同于V1, 注册表无法从未被索引的文件中提取小节。你必须显示地在 `ExplicitRequiredFiles` 里声明哪些文件需要被索引。

支持同时记录多个注册表。

## 依赖

- `@types/node`: Node.js类型定义
- `ini`: INI文件解析
- `yaml`: YAML文件解析

## 注意事项

1. 确保配置文件中的路径正确无误。
2. 宏文件不应以`@`开头，否则会被忽略。
3. 不同于V1,若注册表使用的虚拟文件名和实际文件名碰撞，那么实际文件对应的值将会被覆盖。
4. 如有问题，请检查控制台输出的错误信息。

V2新增的配置项：
* `IsDetailedConsole` `bool`：在命令行中详细输出所有动作的执行时机。
* `Registry` `object`：现在 `RegistryFile` 被改为 `Registry.File`， `RegistryTable` 被改为 `Registry.Table`。旧格式仍然支持。
* `Macro` `object`：现在 `MacroRoot` 被改为 `Macro.Root`。旧格式仍然支持。
* `ExplicitRequiredFiles` `array<string>`：显式指定项目引用了哪些不在 `InputRoot` 和 `Macro.Root` 中的文件。V2将不会尝试自动读取未索引的文件。`ExplicitRequiredFiles`中的所有文件都不会被写入最终输出。
V2移除的配置项：
* `IsRelease` `bool`：在输出中写入文件名。(现在不会写入)
