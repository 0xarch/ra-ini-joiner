/*
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
*/

import { readdir } from "node:fs/promises";
import { basename, join, extname, dirname } from "node:path";
import { join as joinUnix } from "node:path/posix";
import { statSync } from "node:fs";
import { readFile } from "./read.mjs";

export class MacroManager {
    /**
     * @type {Map<string,object>}
     */
    #macro_map = new Map();
    #macro_count_map = new Map();
    #constructed_regex = [];

    constructor(map) {
        // 初始化MapA和MapB
        this.#macro_map = map;
        this.#macro_count_map = new Map();

        // 在构造函数中直接处理映射关系
        this.#processMacros();
    }

    #getMacroRegex(int) {
        if (this.#constructed_regex.length <= int) {
            this.#constructed_regex[int] = new RegExp(`\\$\\{${int}\\}`, 'g');
        }
        return this.#constructed_regex[int];
    }

    // // 过时的处理宏映射的私有方法(不支持区间展开)
    // #processMacros() {
    //     for (const [key, value] of this.#macro_map) {
    //         const patterns = new Set();

    //         // 递归检查对象的键和值
    //         const checkValue = (obj) => {
    //             if (typeof obj === 'string') {
    //                 // 匹配${数字}格式的字符串
    //                 const matches = obj.match(/\$\{(\d+)\}/g);
    //                 if (matches) {
    //                     matches.forEach(match => patterns.add(match));
    //                 }
    //             } else if (typeof obj === 'object' && obj !== null) {
    //                 // 处理对象的键
    //                 Object.keys(obj).forEach(k => {
    //                     checkValue(k);  // 检查键名
    //                     checkValue(obj[k]);  // 检查键值
    //                 });
    //             }
    //         };

    //         // 执行检查
    //         checkValue(value);

    //         // 提取数字并排序
    //         const numbers = Array.from(patterns)
    //             .map(pattern => parseInt(pattern.match(/\$\{(\d+)\}/)[1], 10))
    //             .sort((a, b) => a - b);

    //         // 验证数字序列的有效性
    //         if (numbers.length > 0) {
    //             if (numbers[0] !== 0) {
    //                 throw new Error(`宏"${key}"中的模式必须从0开始`);
    //             }

    //             for (let i = 0; i < numbers.length; i++) {
    //                 if (numbers[i] !== i) {
    //                     throw new Error(`宏"${key}"中的模式不连贯，在位置${i}发现异常值${numbers[i]}`);
    //                 }
    //             }
    //         }



    //         // 存储统计结果
    //         this.#macro_count_map.set(key, numbers.length);
    //     }
    // }

    // 处理宏映射的私有方法
    #processMacros() {
        for (const [key, value] of this.#macro_map) {
            const singleNumbers = new Set(); // 存储单个数字 ${N}
            const ranges = []; // 存储区间 ${N1...N2}
            let hasInfinityRange = false; // 是否存在无限区间

            // 递归检查对象的键和值
            const checkValue = (obj) => {
                if (typeof obj === 'string') {
                    // 匹配单个数字模式 ${N}
                    const singleMatches = obj.match(/\$\{(\d+)\}(?![.])/g);
                    if (singleMatches) {
                        singleMatches.forEach(match => {
                            const num = parseInt(match.match(/\$\{(\d+)\}/)[1], 10);
                            singleNumbers.add(num);
                        });
                    }

                    // 匹配区间模式 ${N1...N2} 或 ${N1...}
                    const rangeMatches = obj.match(/\$\{(\d+)\.\.\.(\d*)\}/g);
                    if (rangeMatches) {
                        rangeMatches.forEach(match => {
                            const parts = match.match(/\$\{(\d+)\.\.\.(\d*)\}/);
                            const n1 = parseInt(parts[1], 10);
                            let n2;

                            if (parts[2] === '') {
                                // 处理无限区间 ${N1...}
                                n2 = Infinity;
                                hasInfinityRange = true;
                            } else {
                                // 处理有限区间 ${N1...N2}
                                n2 = parseInt(parts[2], 10);
                            }

                            if (n1 > n2 && n2 !== Infinity) {
                                throw new Error(`宏"${key}"中的区间${match}起始值大于结束值`);
                            }
                            ranges.push({ n1, n2 });
                        });
                    }
                } else if (typeof obj === 'object' && obj !== null) {
                    // 处理对象的键和值
                    Object.keys(obj).forEach(k => {
                        checkValue(k);  // 检查键名
                        checkValue(obj[k]);  // 检查键值
                    });
                }
            };

            // 执行检查
            checkValue(value);

            // 收集所有单个数字
            const numbers = Array.from(singleNumbers).sort((a, b) => a - b);

            // 计算所有区间覆盖的数字范围
            let maxNumber = numbers.length > 0 ? Math.max(...numbers) : -1;
            const rangeNumbers = new Set();

            ranges.forEach(({ n1, n2 }) => {
                // 更新最大值（无限区间不参与最大值计算）
                if (n2 !== Infinity && n2 > maxNumber) {
                    maxNumber = n2;
                }

                // 收集区间内的数字（有限区间）
                if (n2 !== Infinity) {
                    for (let i = n1; i <= n2; i++) {
                        rangeNumbers.add(i);
                    }
                }
            });

            // 合并单个数字和区间数字
            const allNumbers = new Set([...numbers, ...rangeNumbers]);
            const sortedAll = Array.from(allNumbers).sort((a, b) => a - b);

            // 验证逻辑
            if (sortedAll.length > 0) {
                // 检查是否从0开始
                if (sortedAll[0] !== 0) {
                    throw new Error(`宏"${key}"中的模式必须从0开始`);
                }

                // 无限区间不检查连贯性
                if (!hasInfinityRange) {
                    // 检查所有数字是否连贯
                    for (let i = 0; i <= maxNumber; i++) {
                        if (!allNumbers.has(i)) {
                            throw new Error(`宏"${key}"中的模式不连贯，缺少值${i}`);
                        }
                    }
                } else {
                    // 无限区间只需检查到最大单个数字或有限区间结束值
                    for (let i = 0; i <= maxNumber; i++) {
                        if (!allNumbers.has(i)) {
                            throw new Error(`宏"${key}"中的有限区间模式不连贯，缺少值${i}`);
                        }
                    }
                }
            }

            // 确定参数数量
            let paramCount;
            if (hasInfinityRange) {
                paramCount = Infinity;
            } else if (ranges.length > 0 || numbers.length > 0) {
                paramCount = maxNumber + 1; // 从0开始计数
            } else {
                paramCount = 0;
            }

            // 存储统计结果
            this.#macro_count_map.set(key, paramCount);
        }
    }

    static async new(macro_path) {
        if (!macro_path) {
            return new MacroManager(new Map());
        }
        let all_files = (await readdir(macro_path, {
            recursive: true
        })).filter(v => !basename(v).startsWith('@')).filter(v => statSync(join(macro_path, v)).isFile());

        let file_map = new Map();

        await Promise.all(all_files.map(filename => (async () => {
            let object = await readFile(join(macro_path, filename));

            let object_entires = Object.entries(object);

            if (object_entires.length === 0) return;

            if (object_entires.length === 1) {
                let macro_shortname = joinUnix(dirname(filename), basename(filename, extname(filename)));
                file_map.set(macro_shortname, Object.values(object)[0]);
            }

            object_entires.forEach(([k, v]) => {
                let macro_name = joinUnix(dirname(filename), basename(filename, extname(filename))) + `:${k}`;
                file_map.set(macro_name, v);
            });
        })()));

        return new this(file_map);
    }

    #getMacroSection(macro_name, macro_arguments) {
        if (!this.#macro_map.has(macro_name)) {
            if (this.#macro_map.has(`${macro_name}:${macro_arguments}`)) {
                return this.#macro_map.get(`${macro_name}:${macro_arguments}`);
            }
            throw new Error(`未定义的宏: ${macro_name}`);
        }
        return (this.#macro_map.get(macro_name));
    }

    getMacro(macro_name, macro_arguments = []) {
        let raw_macro = this.#getMacroSection(macro_name, macro_arguments);
        if (!Array.isArray(macro_arguments)) {
            // 保持原有的参数处理逻辑
            macro_arguments = String(macro_arguments).split(',');
        }

        // 解析区间模式的工具函数
        const parseRangePattern = (str) => {
            const rangeMatch = str.match(/\$\{(\d+)\.\.\.(\d*)\}/);
            if (!rangeMatch) return null;
            const n1 = parseInt(rangeMatch[1], 10);
            let n2 = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : Infinity;
            // 处理无限区间的实际边界（根据参数长度）
            if (n2 === Infinity) {
                n2 = macro_arguments.length - 1;
            }
            // 确保n2不超过参数实际长度
            if (n2 >= macro_arguments.length) {
                n2 = macro_arguments.length - 1;
            }
            // 确保区间有效
            if (n1 > n2) return null;
            return { n1, n2, pattern: rangeMatch[0] };
        };

        // 第一步：处理键中的${N1...N2}，生成多个键值对
        let expandedEntries = [];
        for (const [rawKey, rawValue] of Object.entries(raw_macro)) {
            const keyRange = parseRangePattern(rawKey);

            if (keyRange) {
                // 键中存在区间模式，生成多个键
                const { n1, n2, pattern } = keyRange;
                for (let i = n1; i <= n2; i++) {
                    if (macro_arguments[i] === undefined) continue; // 跳过超出参数范围的索引
                    // 替换键中的区间为当前参数
                    const newKey = rawKey.replace(pattern, macro_arguments[i]);
                    expandedEntries.push([newKey, rawValue]);
                }
            } else {
                // 键中无区间模式，直接保留
                expandedEntries.push([rawKey, rawValue]);
            }
        }

        // 第二步：处理值中的${N1...N2}和原有${N}模式
        let parsedEntries = [];
        for (const [key, value] of expandedEntries) {
            let processedValue = value;
            const valueRange = parseRangePattern(processedValue);

            if (valueRange) {
                // 值中存在区间模式，按逗号分割后展开
                const { n1, n2, pattern } = valueRange;
                const valueParts = processedValue.split(',');

                // 处理每个部分中的区间
                const expandedParts = valueParts.flatMap(part => {
                    if (part.includes(pattern)) {
                        // 包含区间的部分需要展开
                        const expanded = [];
                        for (let i = n1; i <= n2; i++) {
                            if (macro_arguments[i] === undefined) continue;
                            expanded.push(part.replace(pattern, macro_arguments[i]));
                        }
                        return expanded;
                    }
                    // 不包含区间的部分直接保留
                    return part;
                });

                processedValue = expandedParts.join(',');
            }

            // 处理原有${N}单个模式的替换
            const totalMacroCount = this.#macro_count_map.get(macro_name) || macro_arguments.length;
            const effectiveCount = totalMacroCount === Infinity ? macro_arguments.length : totalMacroCount;

            for (let i = 0; i < effectiveCount; i++) {
                if (macro_arguments[i] === undefined) continue;
                const reg = this.#getMacroRegex(i); // 假设该方法返回匹配${i}的正则
                processedValue = processedValue.replace(reg, macro_arguments[i]);
            }

            // 处理键中可能残留的${N}单个模式
            let processedKey = key;
            for (let i = 0; i < effectiveCount; i++) {
                if (macro_arguments[i] === undefined) continue;
                const reg = this.#getMacroRegex(i);
                processedKey = processedKey.replace(reg, macro_arguments[i]);
            }

            parsedEntries.push([processedKey, processedValue]);
        }

        return Object.fromEntries(parsedEntries);
    }

}