import path from "path/posix";
import { Wrap } from "./wrap.mjs";

export class Inherit {
    #file_map;

    constructor(file_map = new Map()) {
        this.#file_map = new Map([...file_map.entries()].map(([k, v]) => {
            k = path.normalize(k);
            return [k, v];
        }));
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

        let target_section_parsed = this.resolve(target_section, filename, new_visited);

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
                    let section = this.get(v, current_file, visited);
                    result.push(...Wrap.wrapEntries(Object.entries(section)));
                });
                entries[i] = result;
            }
        })
        entries = entries.flat(Infinity).map(v => v.unwrap());
        return Object.fromEntries(entries);
    }
}