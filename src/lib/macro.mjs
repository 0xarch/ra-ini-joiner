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
import { ResourceManager, ResourceTypes } from "./resource.mjs";
import Configuration from "./config.mjs";

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

export default class MacroLib {
    /**
     * @type {Configuration}
     */
    #configuration;
    /**
     * @type {ResourceManager}
     */
    #resourceManager;
    cached_macros = new Map();

    #REGEXES = {
        SIMPLE_MATCHALL: /\$[0-9N]+/,
        MATCHINF: /\$[0-9]\.\.\.\$N/
    };

    constructor(configuration, resourceManager) {
        this.#configuration = configuration;
        this.#resourceManager = resourceManager;
    }

    init_macro(path, name) {
        let file_content = this.#resourceManager.get(path);
        let section = file_content.content[name];
        let section_keys = Object.keys(section);
        let section_values = Object.values(section);

        let is_simple_macro = true;
        if (section.___parameter_macro___) {
            is_simple_macro = false;
        } else
            if (this.#configuration.Macro.AutoDetect && this.#REGEXES.SIMPLE_MATCHALL.test(JSON.stringify(section))) {
                is_simple_macro = false;
            }

        if (is_simple_macro) {
            return function (...parameters) {
                let result = section;
                if (typeof section === 'function') result = section(...parameters);
                delete result.___dontexportme___;
                delete result.___skip_resolve___;
                delete result.___parameter_macro___;
                return result;
            }
        }
        let key_sequences = [[]];
        let i = -1, key_sequence_flag = 0;
        while (section_keys.length - 1 > i++) {
            if (this.#REGEXES.SIMPLE_MATCHALL.test(section_keys[i])) key_sequence_flag = 1;
            else key_sequence_flag = 0;
            if (key_sequence_flag) {
                let j = -1, char_seq_flag = 0, key = section_keys[i];
                let char_seq = [''];
                while (key.length - 1 > j++) {
                    let indicator = {};
                    if (key[j] == '$') {
                        char_seq_flag = 1;
                        let number = '';
                        while (!Number.isNaN(Number(key[++j]))) {
                            number += key[j];
                        }
                        indicator.from = Number(number);
                        while (key[j++] == '.');
                        j--;
                        if (key[j - 1] == '.' && key[j] == '$') {
                            let number2 = '';
                            while (!Number.isNaN(Number(key[++j])) || key[j] == 'N') {
                                number2 += key[j];
                            }
                            indicator.to = Number(number2) || Infinity;
                        } else indicator.to = indicator.from;
                        j--;
                    } else {
                        char_seq_flag = 0;
                    }
                    if (!char_seq_flag) char_seq[char_seq.length - 1] += key[j];
                    else {
                        char_seq.push(indicator);
                        char_seq.push('');
                    }
                }
                key_sequences.push(char_seq);
                key_sequences.push([]);
            } else {
                key_sequences[key_sequences.length - 1].push(section_keys[i]);
            }
        }
        let value_sequences = Array.from(section_values).map(v => {
            if(!this.#REGEXES.SIMPLE_MATCHALL.test(v)) return () => v;
            return (parameters) => {
                console.log(3.1);
                let result = v;
                if(typeof v === 'string'){
                    let i = 0;
                    while(this.#REGEXES.SIMPLE_MATCHALL.test(result)){
                        result = result.replace(`\$${i+1}`,parameters[i++]);
                    }
                }
                return result;
            }
        });

        return function (...parameters) {
            let result = {};

            let key_i = 0, i = 0;
            for (const key_sequence of key_sequences) {
                if (i % 2 == 0) {
                    key_sequence.forEach(key => {
                        result[key] = value_sequences[key_i](parameters);
                        key_i++;
                    })
                } else {
                    let keys = [];
                    key_sequence.filter(v => typeof v !== 'string').forEach(obj => {
                        if (keys.length <= obj.to && keys.length <= parameters.length) {
                            keys = Array.from({length:Math.min(obj.to, parameters.length)}).fill('');
                        }
                    });
                    let min = Infinity, max = -Infinity;
                    key_sequence.forEach(char_or_obj => {
                        if (typeof char_or_obj === 'string') {
                            keys = keys.map(key => key + char_or_obj);
                        } else {
                            keys = keys.map((key, i) => {
                                i+=1;
                                if(char_or_obj.from <= i && char_or_obj.to >= i) {
                                    min = Math.min(min,char_or_obj.from);
                                    max = Math.max(max,char_or_obj.to);
                                    return key + parameters[i-1];
                                }
                                return key;
                            });
                        }
                    });
                    keys = keys.slice(min-1,max-1);
                    keys.forEach(key => {
                        result[key] = value_sequences[key_i](parameters);
                    })
                    key_i++;
                }
                i++;
            }
            return result;
        }
    }

    get_macro(path, name) {
        let macro_id = this.get_macro_id(path, name);
        if (this.cached_macros.has(macro_id)) {
            return this.cached_macros.get(macro_id);
        }
        let macro = this.init_macro(path, name);
        this.cached_macros.set(macro_id, macro);
        return macro;
    }

    get_macro_id(path, name) {
        return `V2_Macro:${path}#${name}`;
    }

    async resolve_all() {
        console.info.when_detailed(`[MCPS] 正在处理所有文件中的宏.`);
        for (const [path, resource] of this.#resourceManager.resources) {
            this.resolve(path, resource);
        }
        console.info.when_detailed(`[MCPS] 所有文件中的宏均处理完毕.`);
    }

    /**
     * 
     * @param {string} path 
     * @param {Awaited<ReturnType<import("./resource.mjs").source>>} resource 
     */
    resolve(path, resource) {
        if (resource.type === ResourceTypes.INVALID) {
            // 跳过 JS
            return;
        }
        if (resource.is_process_only) {
            // 减少引用大文件时的不必要性能损耗
            return;
        }
        console.info.when_detailed(`[MCPS] 正在处理文件 ${path} 中的宏.`);
        Object.entries(resource.content).map(([section_name, _]) => {
            this.resolve_section(path, section_name);
        });
        console.info.when_detailed(`[MCPS] 文件 ${path} 中的宏处理完毕.`);
    }

    resolve_section(path, section_name) {
        let resource = this.#resourceManager.get(path);
        if (resource.type === ResourceTypes.JAVASCRIPT) {
            // handle javascript
            return;
        }
        const section = this.#resourceManager.get(path).content[section_name];
        if (section.___skip_resolve___) {
            console.info.when_detailed(`[MCPS] 小节 ${path}:${section_name} 包含有 ___skip_resolve___，将跳过宏解析.`);
            return;
        }
        let keys_unfiltered = Object.keys(section);
        let keys_required = keys_unfiltered
            .filter((key) => key.startsWith('@') || this.#configuration.Macro.ExplicitKeys.includes(key))
            .filter((key) => !this.#configuration.Macro.IgnoreKeys.includes(key));
        if (keys_required.length === 0)
            return;

        let all_overrided_keys = Object.keys(this.#configuration.Macro.Overrides);
        let flat_keys = [];
        keys_required.map((key) => (() => {
            // ensure target section is fully macro-ized
            let target_path = '', target_section = '';
            if (all_overrided_keys.includes(key)) {
                let overrided_resource_loc = String(this.#configuration.Macro.Overrides[key]).split(':');
                if (overrided_resource_loc.length !== 2) {
                    console.warn(`[MCPS] 自定义的宏覆写 ${this.#configuration.Macro.Overrides[key]} 无法被识别为合法的标签！已忽略.`);
                    return;
                }
                [target_path, target_section] = overrided_resource_loc;

                if (!this.#resourceManager.resources.has(target_path)) {
                    target_path = join(this.#configuration.Macro.Root, target_path);
                    if (!extname(target_path)) target_path += this.#configuration.Macro.DefaultFileSuffix;
                    if (!this.#resourceManager.resources.has(target_path)) {
                        console.warn(`[MCPS] 为 ${path}:${section_name} 中的 ${key} 查找宏 ${target_path}:${target_section} 时出现错误：文件 ${target_path} 不存在或没有被索引！`);
                        return;
                    }
                }
            } else {
                if (key.includes(':')) {
                    // @File:Foo
                    [target_path, target_section] = key.substring(1).split(':');
                } else {
                    // @Foo
                    target_path = target_section = key.substring(1);
                }
                let relative_target_path = join(path, target_path);
                if (this.#resourceManager.resources.has(relative_target_path)) {
                    target_path = relative_target_path;
                } else {
                    target_path = join(this.#configuration.Macro.Root, target_path);
                    if (!extname(target_path)) target_path += this.#configuration.Macro.DefaultFileSuffix;
                    if (!this.#resourceManager.resources.has(target_path)) {
                        console.warn(`[MCPS] 为 ${path}:${section_name} 中的 ${key} 查找宏 ${target_path}:${target_section} 时出现错误：文件 ${target_path} 不存在或没有被索引！`);
                        return;
                    }
                }
            }
            console.info.when_detailed(`[MCPS] 为 ${path}:${section_name} 中的 ${key} 查找宏 ${target_path}:${target_section}`);
            this.resolve_section(target_path, target_section);
            let insert_section = this.get_macro(target_path, target_section);
            flat_keys.push(key);
            if (typeof insert_section === 'function') {
                console.info.when_detailed(`[MCPS] 尝试使用函数解析 ${target_path}:${target_section}`);
                let parameters = section[key];
                if (!Array.isArray(parameters)) {
                    parameters = String(parameters).split(',');
                }
                insert_section = insert_section(...parameters);
            } else {
                console.info(`[MCPS] 检测到不寻常的问题：insert_section is not a function. CodeMCPS_1`);
            }
            section[key] = insert_section;
        })());
        // do flatten
        let flat_keys_ordered = keys_required.filter(key => flat_keys.includes(key));

        console.info.when_detailed(`[MCPS] 为 ${path}:${section_name} 中的 ${flat_keys} 进行替换.`);
        const original_section_keys = Object.keys(section);
        const new_entries = [];

        for (const key of original_section_keys) {
            if (flat_keys_ordered.includes(key)) {
                const content = section[key];
                if (content && typeof content === 'object') {
                    for (const subKey of Object.keys(content)) {
                        new_entries.push([subKey, content[subKey]]);
                    }
                }
            } else {
                new_entries.push([key, section[key]]);
            }
        }
        for (const key of original_section_keys) {
            delete section[key];
        }
        for (const [key, value] of new_entries) {
            section[key] = value;
        }
        section.___skip_resolve___ = true;
        console.info(`[MCPS] 成功为 ${path}:${section_name} 中的 ${flat_keys} 替换.`);

    }
}