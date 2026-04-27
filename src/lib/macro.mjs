import { join, extname } from "node:path";
import { ResourceManager, ResourceTypes } from "./resource.mjs";
import Configuration from "./config.mjs";

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
            if (!this.#REGEXES.SIMPLE_MATCHALL.test(v)) return () => v;
            return (parameters) => {
                let result = v;
                if (typeof v === 'string') {
                    result = result.replaceAll(/\$([0-9])\.\.\.\$([0-9nN])/g, (_match, a, b) => {
                        if (b.includes('N') || b.includes('n')) b = parameters.length;
                        a = Number(a); b = Number(b);
                        let ret_str = '$' + a++;
                        while (a <= b) {
                            ret_str += ',$' + String(a);
                            a++;
                        }
                        return ret_str;
                    });
                    let i = 0;
                    while (this.#REGEXES.SIMPLE_MATCHALL.test(result)) {
                        result = result.replace(`\$${i + 1}`, parameters[i++]);
                        console.log(result);
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
                            keys = Array.from({ length: Math.min(obj.to, parameters.length) }).fill('');
                        }
                    });
                    let min = Infinity, max = -Infinity;
                    key_sequence.forEach(char_or_obj => {
                        if (typeof char_or_obj === 'string') {
                            keys = keys.map(key => key + char_or_obj);
                        } else {
                            keys = keys.map((key, i) => {
                                i += 1;
                                if (char_or_obj.from <= i && char_or_obj.to >= i) {
                                    min = Math.min(min, char_or_obj.from);
                                    max = Math.max(max, char_or_obj.to);
                                    return key + parameters[i - 1];
                                }
                                return key;
                            });
                        }
                    });
                    keys = keys.slice(min - 1, max - 1);
                    keys.forEach(key => {
                        result[key] = value_sequences[key_i](parameters);
                    })
                    key_i++;
                }
                i++;
            }
            delete result.___dontexportme___;
            delete result.___skip_resolve___;
            delete result.___parameter_macro___;
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