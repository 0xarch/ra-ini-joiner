# RA-INI-Joiner

一个简单的管理 INI 文件的工具.

## 支持特性
*   拼接:
        将项目内所有文件拼接为单个 INI 文件
*   简单宏:
        支持提前定义宏并引用
*   继承:
        支持继承项目内已有的章节
*   注册表:
        支持将指定的多个文件内的所有节统计并整合为数组
*   多语言:
        支持同时书写 YAML 和 INI, 并可以无缝衔接
*   多项目:
        可通过配置文件快速切换不同项目

### 简单宏

支持占位符替换和多占位符展开.

定义宏: 在`CONFIG>MacroRoot`指定的目录下创建文件并书写数据. 例如:

`project/@Macro/example.ini`:
```ini
[ExampleMacro]
MacroUsed=true
MacroArgument1=${0}
MacroArguments=${0...}
```

#### 宏参数

对于键和值中的普通占位符 `${N}`, 将在解析时被替换为参数列表对应位置的字符串.

占位符中 `N` 表示这个占位符将被替换为第几个参数. 如果整个节内所有占位符的替换标识不连贯, 则处理时将报错.

##### 展开占位符

展开占位符 `${N1...N2?}` 是一种特殊的缩写方法, 允许在格式相似但某些位置不同的地方进行简写. 

展开占位符的参数位被计算为从 N1 到 N2 区间内的所有数字, 若 N2 未提供, 则认为 N2 = `Infinity`, 此时不进行 `(N2, +Infinity)` 内的参数连贯性检查, `[N1, +Infinity)` 内的所有参数将被视为展开占位符的参数.

对于键中的展开占位符, 将会展开键为 N2-N1+1 个键, 并依次替换.

对于值中的展开占位符, 将会对值按逗号`,`分割, 将带有占位符的部分展开替换, 然后重新用逗号`,`连接.

#### 引用
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
*   **当宏文件内只有一个宏时**, 可以省略`sectionName`:
    ```ini
    [SOMESECTION]
    @<relativePath2>[]=<argument> # 标准
    @<relativePath>=<argument> # 单参简写
    @<relativePath>=<argument1>,<argument2> # 多参简写
    ```
*   可以将`sectionName`写在值里:
    ```ini
    [SOMESECTION]
    @<relativePath>=<sectionName>
    ```
    此时，认为**宏不需要参数**。注意：若宏实际上需要参数，那么`sectionName`会被认为是参数，将导致不可预期的结果。

宏**不支持**嵌套。

### 继承

如果一个宏的`relativePath`为`Inherits`，即如 `@Inherits=any`，此时将启用继承逻辑：
逻辑语法：

`@Inherits=<relativePath>:<sectionName>`

`relativePath`: 将要被继承的文件的路径，**需要包含文件后缀名**，特别的，若为`this`，则表示当前文件。  
`sectionName`：将要被继承的小节名。

被继承的节的所有内容将被复制到触发复制的节内 `@Inherits` 的对应位置。

继承支持嵌套。

### 注册表

启用 `CONFIG>Registery` 来定义注册表：

```yaml
RegisterFile: 09. Registery.ini # 目标文件。生成结果时，注册表将被追加到该文件的输出内容的末尾。如果没有该文件则假定文件内容为空。生成注册表将不修改该文件的源文件。
Registery:
  - Target: RegisteryTable1
    Start: 1 # 可选。默认以1开始
    Source: 
      - SourceFile1.ini #需要文件后缀
      - SourceFile2.yaml
      - ...
  - Target: RegisteryTable2
    Source:
      - SourceFile3.ini
      - ...
  ...
```

支持同时记录多个注册表。

## 配置

配置文件可以为 `YAML` 或 `INI`。

InputRoot: `string` 项目文件目录，必填
MacroRoot: `string` 宏目录，选填，若不填则认为项目不启用宏（继承不受影响）
OutputPath: `string` 输出文件路径，必填
RegisterFile: `string` 注册表文件路径，对应路径可以不存在文件
Registery: `<OBJECT>` 注册表。详见 [注册表](#注册表)