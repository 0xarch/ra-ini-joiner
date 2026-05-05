# 配置

*   `InputRoot`：项目根目录，此目录相对于工作目录
*   `OutputPath`：输出文件路径，此路径相对于工作目录
*   `Macro.Root`：宏文件目录，此目录相对于工作目录
*   `Macro.IgnoreKeys`：要被忽略的键，所有以 `@` 开头的键和 `Macro.ExplicitKeys` 中的键，若出现在 `Macro.IgnoreKeys` 中，则不会被认为是宏键。
*   `Macro.ExplicitKeys`：显式指定的键，这些键会忽略是否以 `@` 开头并被解析为宏。仍然会被 `Macro.IgnoreKeys` 拦截。
*   `Macro.Overrides`：映射表，详见[宏](./DOC.MCPS.md)
*   `Macro.DefaultFileSuffix`：默认文件后缀
*   `Macro.AutoDetect`：自动检测参数宏
*   `IgnoreFiles`：忽略的文件，此路径数组均相对于工作目录
*   `ExplicitRequiredFiles`：显式要求索引的文件，此路径数组均相对于工作目录
*   `IsDetailedConsole`：显示更多输出
*   `PedanticErrors`：将警告视为错误