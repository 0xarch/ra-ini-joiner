# RA-INI-Joiner

一个简单的 INI 文件管理工具，用于拼接、处理和管理多个 INI 文件。

## 支持特性
- **拼接**: 将项目内所有文件拼接为单个 INI 文件
- **简单宏**: 支持提前定义宏并引用，实现代码复用
- **继承**: 支持继承项目内已有的章节，减少重复代码
- **注册表**: 支持将指定的多个文件内的所有节统计并整合为数组
- **多语言**: 支持同时书写 YAML 和 INI，并可以无缝衔接
- **多项目**: 可通过配置文件快速切换不同项目

## 安装

1. 确保已安装 Node.js
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

配置文件可以是 `YAML` 或 `INI` 格式，包含以下必要配置项：

```yaml
InputRoot: 项目文件目录 # 必填，指定要处理的源文件目录
OutputPath: 输出文件路径 # 必填，指定最终生成的INI文件路径
MacroRoot: 宏目录 # 选填，若不填则认为项目不启用宏（继承不受影响）
RegistryFile: 注册表文件路径 # 选填，指定注册表将被追加到哪个文件的末尾
RegistryTable: # 选填，定义注册表配置
  - Target: RegistryTable1 # 目标注册表名
    Start: 1 # 可选，默认以1开始
    Source: 
      - SourceFile1.ini #需要文件后缀
      - SourceFile2.yaml
IsRelease: false # 可选，设置为true时不添加文件标记信息
```

### 配置文件示例 (ini-joiner.config.yaml)

```yaml
InputRoot: project/src
OutputPath: project/output/combined.ini
MacroRoot: project/@Macro
RegistryFile: project/src/09.Registry.ini
RegistryTable:
  - Target: InfantryTypes
    Source:
      - 11. Allied Infantries.ini
      - 12. Soviet Infantries.ini
      - 13. Yuri Infantries.ini
      - 14. Civilian Infantries.ini
  - Target: VehicleTypes
    Start: 100
    Source:
      - 21. Allied Vehicles.ini
      - 22. Soviet Vehicles.ini
      - 23. Yuri Vehicles.ini
      - 24. Civilian Vehicles.ini
```

## 功能详解

### 简单宏

支持占位符替换和多占位符展开。

#### 定义宏

在`CONFIG>MacroRoot`指定的目录下创建文件并书写数据。例如：

`project/@Macro/example.ini`:
```ini
[ExampleMacro]
MacroUsed=true
MacroArgument1=${0}
MacroArguments=${0...}
```

#### 宏参数

对于键和值中的普通占位符 `${N}`，将在解析时被替换为参数列表对应位置的字符串。

占位符中 `N` 表示这个占位符将被替换为第几个参数。如果整个节内所有占位符的替换标识不连贯，则处理时将报错。

##### 展开占位符

展开占位符 `${N1...N2?}` 是一种特殊的缩写方法，允许在格式相似但某些位置不同的地方进行简写。

展开占位符的参数位被计算为从 N1 到 N2 区间内的所有数字，若 N2 未提供，则认为 N2 = `Infinity`，此时不进行 `(N2, +Infinity)` 内的参数连贯性检查，`[N1, +Infinity)` 内的所有参数将被视为展开占位符的参数。

对于键中的展开占位符，将会展开键为 N2-N1+1 个键，并依次替换。
例如：对于以下宏：
```ini
[MacroWithExpander]
HasExpandKey{0...}=yes
```
若传入`1`,`2`,`3`，则展开为：
```ini
HasExpandKey1=yes
HasExpandKey2=yes
HasExpandKey3=yes
```

对于值中的展开占位符，将会对值按逗号`,`分割，将带有占位符的部分展开替换，然后重新用逗号`,`连接。

例如，对于以下宏：
```ini
[MarcoWithExpandInValue]
Expanded=First,${0...},Last
```
若传入`1`,`2`,`3`，则展开为：
```ini
Expanded=First,1,2,3,Last
```

#### 引用宏

`relativePath`: 宏相对于 `CONFIG>MacroRoot` 的路径，无文件后缀。例如：`project/@Macro/Voice.ini`(`CONFIG>MacroRoot:project/@Macro`) 应被写为 `Voice`。

`sectionName`：宏文件内对应宏的小节名。

`argument`：传递给宏的参数，所有参数均被视作字符串。

有以下几种语法来引用宏:

*   标准语法:
    ```ini
    [SOMESECTION]
    @<relativePath>:<sectionName>[]=<argument1>
    @<relativePath>:<sectionName>[]=<argument2>
    ...
    @<relativePath>:<sectionName>[]=<argumentN>
    ```

*   参数简写:
    ```ini
    [SOMESECTION]
    @<relativePath>:<sectionName>=<argument>
    @<relativePath>:<sectionName>=<argument1>,<argument2>,...,<argumentN>
    ```
    注意，若`argumentN`中含有一个逗号，那么其将会被视作多个参数。换言之，带有逗号的参数不支持参数简写。
    此外，参数简写也不能和标准引用混用。

*   **当宏文件内只有一个宏时**，可以省略`sectionName`:
    ```ini
    [SOMESECTION]
    @<relativePath2>[]=<argument> # 标准
    @<relativePath>=<argument> # 单参简写
    @<relativePath>=<argument1>,<argument2> # 多参简写
    ```

*   无参简写：某些情况下，可以将`sectionName`写在值里:
    ```ini
    [SOMESECTION]
    @<relativePath>=<sectionName>
    ```
    此时，认为**宏不需要参数**。注意：若宏实际上需要参数，那么`sectionName`会被认为是参数，将导致不可预期的结果。
    这种简写也可以被用于实现一些基于枚举的语句简写，如`Locomotor`。
    <details>
    <summary>这是一份对于Locomotor的CLSID简写宏文件，可以通过无参简写引用</summary>

    例如，`@Locomotor=Drive`将被展开为`Locomotor={4A582741-9839-11d1-B709-00A024DDAFD1}`。
    在不使用 Phobos 的简写支持时，或许很有用。
        
    ```ini
    [Drive]
    Locomotor={4A582741-9839-11d1-B709-00A024DDAFD1}

    [Hover]
    Locomotor={4A582742-9839-11d1-B709-00A024DDAFD1}

    [Tunnel]
    Locomotor={4A582743-9839-11d1-B709-00A024DDAFD1}

    [Walk]
    Locomotor={4A582744-9839-11d1-B709-00A024DDAFD1}

    [DropPod]
    Locomotor={4A582745-9839-11d1-B709-00A024DDAFD1}

    [Fly]
    Locomotor={4A582746-9839-11d1-B709-00A024DDAFD1}

    [Teleport]
    Locomotor={4A582747-9839-11d1-B709-00A024DDAFD1}

    [Mech]
    Locomotor={55D141B8-DB94-11d1-AC98-006008055BB5}

    [Ship]
    Locomotor={2BEA74E1-7CCA-11d3-BE14-00104B62A16C}

    [Jumpjet]
    Locomotor={92612C46-F71F-11d1-AC9F-006008055BB5}

    [Rocket]
    Locomotor={B7B49766-E576-11d3-9BD9-00104B972FE8}
    ```
    </details>

宏**不支持**嵌套。

### 继承

如果一个宏的`relativePath`为`Inherits`，即如 `@Inherits=any`，此时将启用继承逻辑：

逻辑语法：`@Inherits=<relativePath>:<sectionName>`

`relativePath`: 将要被继承的文件的路径，**需要包含文件后缀名**，特别的，若为`this`，则表示当前文件。

`sectionName`：将要被继承的小节名。

被继承的节的所有内容将被复制到触发复制的节内 `@Inherits` 的对应位置。

继承支持嵌套。

### 注册表

启用 `CONFIG>RegistryFile` 和 `CONFIG>RegistryTable` 来定义注册表：

```yaml
RegistryFile: 09.Registry.ini # 目标文件。生成结果时，注册表将被追加到该文件的输出内容的末尾。如果没有该文件则假定文件内容为空。生成注册表将不修改该文件的源文件。
RegistryTable:
  - Target: RegistryTable1 # 目标注册表名。生成结果时，将在目标文件内创建一个名为 `[RegistryTable1]` 的小节，将所有源文件内的节名按顺序写入。
    Start: 1 # 可选。默认以1开始
    Source: 
      - SourceFile1.ini #需要文件后缀
      - SourceFile2.yaml
      - ...
  - Target: RegistryTable2
    Source:
      - SourceFile3.ini
      - ...
  ...
```

对于没有被预先读取的文件（比如不在项目目录内或以`@`开头的文件，将会尝试以**相对于工作目录**的路径来读取。例如，要读取 `project+project_2>another_file.ini`，则需要将其写为 `project_2>another_file.ini`。这主要被用于动画注册等方面。

支持同时记录多个注册表。

## 项目结构

```
├── .gitignore
├── README.md
├── package.json
└── src/
    ├── lib/
    │   ├── file.mjs       # 文件管理相关功能
    │   ├── inherit.mjs    # 继承功能实现
    │   ├── macro.mjs      # 宏功能实现
    │   ├── read.mjs       # 文件读取功能
    │   ├── registry.mjs   # 注册表功能实现
    │   └── wrap.mjs       # 包装功能实现
    ├── main.mjs           # 主程序入口
    └── quickdiff.mjs      # 快速比较功能，具体功能请直接查看源码实现
```

## 依赖

- `@types/node`: Node.js类型定义
- `ini`: INI文件解析
- `yaml`: YAML文件解析

## 注意事项

1. 确保配置文件中的路径正确无误
2. 宏文件不应以`@`开头，否则会被忽略
3. 注册表生成不会修改源文件，只会追加到输出文件末尾
4. 如有问题，请检查控制台输出的错误信息