import path from "path/posix";
import { Wrap } from "./wrap.mjs";

export class Inherit {
    #file_map;
    #macroManager;
    #fileManager;

    constructor(file_map = new Map(), macroManager = null, fileManager = null) {
        this.#file_map = new Map([...file_map.entries()].map(([k, v]) => {
            k = path.normalize(k);
            return [k, v];
        }));
        this.#macroManager = macroManager;
        this.#fileManager = fileManager;
    }
    
    get(inherit_name, current_file = null, visited = new Set()) {
        // 标准化继承名称（处理this:前缀）
        let normalized_inherit_name = inherit_name;
        if (inherit_name.startsWith('this:')) {
            if (!current_file) {
                throw new Error('继承：内部处理：使用"this:"前缀时必须提供当前文件名');
            }
            normalized_inherit_name = inherit_name.replace('this:', current_file + ':');
        }

        // 生成缓存键
        const cacheKey = this.#generateCacheKey(normalized_inherit_name);
        
        // 检查缓存
        if (this.#fileManager && this.#fileManager.getParsedFile(cacheKey)) {
            return this.#fileManager.getParsedFile(cacheKey);
        }

        // 检测循环引用
        if (visited.has(normalized_inherit_name)) {
            throw new Error(`继承：检测到循环引用：${[...visited.values()].join(' -> ')} -> ${normalized_inherit_name}`);
        }

        // 添加当前节点到已访问集合
        const new_visited = new Set(visited);
        new_visited.add(normalized_inherit_name);

        let [filename, sectionname] = inherit_name.split(':');
        
        if (!sectionname) {
            throw new Error(`继承：在文件 ${current_file} 中：参数格式不满足要求 "<filename>:<sectionname>" or "this:<sectionname>": ${inherit_name}`);
        }

        // 处理this:前缀的情况
        if (filename === 'this') {
            if (!current_file) {
                throw new Error('继承：内部处理：使用"this:"前缀时必须提供当前文件名');
            }
            filename = current_file;
        }

        try {
            filename = path.normalize(filename);
        } catch(e) {
            console.log(`继承：解析路径 ${filename} 时：未预期的错误`);
            throw e;
        }

        let target_obj = this.#file_map.get(filename);

        if (!target_obj) {
            throw new Error('继承：请求的文件不存在:', filename);
        }

        let target_section = target_obj[sectionname];

        if (!target_section) {
            throw new Error('继承：请求的节不存在于文件', filename, ':', sectionname);
        }

        // 递归解析继承内容，包括处理宏
        let target_section_parsed = this.resolve(target_section, filename, new_visited);

        // 缓存解析结果
        if (this.#fileManager) {
            this.#fileManager.cacheParsedFile(cacheKey, target_section_parsed);
        }

        return target_section_parsed;
    }

    resolve(object, current_file = null, visited = new Set()) {
        let entries = Wrap.wrapEntries(Object.entries(object));
        entries.forEach((wrap, i) => {
            if (wrap.key === '@Inherits') {
                let inherit_sections = [];
                if (Array.isArray(wrap.value)) {
                    inherit_sections = [...wrap.value];
                } else {
                    inherit_sections = [wrap.value];
                }
                let result = [];
                inherit_sections.forEach(v => {
                    // 递归解析继承内容，这会自动处理被继承项目中的继承和宏
                    let section = this.get(v, current_file, visited);
                    result.push(...Wrap.wrapEntries(Object.entries(section)));
                });
                entries[i] = result;
            } else if (wrap.key.startsWith('@') && wrap.key !== '@Inherits' && this.#macroManager) {
                // 处理继承内容中的宏
                let macro_name = wrap.key.replace('@', '');
                let macroed_object = this.#macroManager.getMacro(macro_name, wrap.value);
                entries[i] = Wrap.wrapEntries(Object.entries(macroed_object));
            }
        })
        entries = entries.flat(Infinity).map(v => v.unwrap());
        return Object.fromEntries(entries);
    }
    
    /**
     * 生成继承内容的缓存键
     * @param {string} inherit_name 继承名称
     * @returns {string} 缓存键
     */
    #generateCacheKey(inherit_name) {
        // 使用特殊前缀区分继承缓存和普通文件缓存
        return `__inherit__:${inherit_name}`;
    }
}