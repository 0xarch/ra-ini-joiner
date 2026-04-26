import { readFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { parse as parseIni } from "ini";

export class Resource {
    path = '';
    type = ResourceTypes.INI;
    text_content = '';
    content = {};
    is_process_only = false;

    constructor(path, virtual_path = false) {
        if (!path) {
            console.info('[CRIT] 初始化资源文件时遇到错误：检测到空文件名');
            process.exit(2);
        }
        if (virtual_path) {
            this.path = path;
            this.type = ResourceTypes.INI;
        }
        this.path = path;
        let file_type = extname(path);
        if (dirname(path).includes('@')) {
            console.info.when_detailed(`[RESC] 因文件路径包含 @，文件 ${path} 将不会被输出.`);
            this.is_process_only = true;
        }
        if (basename(path).startsWith('@')) {
            console.info.when_detailed(`[RESC] 因文件名以 @ 开头，文件 ${path} 将不会被输出.`);
            this.is_process_only = true;
        }
        switch (file_type) {
            case '.ini': {
                this.type = ResourceTypes.INI;
                break;
            }
            case '.yml':
            case '.yaml': {
                this.type = ResourceTypes.YAML;
                break;
            }
            case '.js':
            case '.mjs': {
                this.type = ResourceTypes.JAVASCRIPT;
                this.is_process_only = true;
                break;
            }
            default:
                console.warn(`[CRIT] 初始化资源文件时遇到错误： ${path} 使用了不支持的格式 ${file_type} ! 此文件将被忽略.`);
                this.type = ResourceTypes.INVALID;
        }
    }

    async init(configuration) {
        try {
            let content = (await readFile(this.path)).toString();
            this.text_content = content;
            let parsed_content = {};
            switch (this.type) {
                case ResourceTypes.INI: {
                    parsed_content = parseIni(content);
                    // handle special macro
                    for (let [section_name, section] of Object.entries(parsed_content)) {
                        for (const [key, value] of Object.entries(section)) {
                            if (key.endsWith(':')) {
                                let e_key = key.substring(0, key.length - 1);
                                if ((e_key.startsWith('@') || configuration.Macro.ExplicitKeys.includes(e_key)) && !configuration.Macro.IgnoreKeys.includes(e_key)) {
                                    let new_section = Object.fromEntries(Object.entries(section).map(([k, v]) => k === key ? [e_key, v.split(',')] : [k, v]));
                                    parsed_content[section_name] = new_section;
                                }
                            }
                        }
                    }
                    break;
                }
                case ResourceTypes.YAML: {
                    parsed_content = parseYaml(content);
                    break;
                }
                case ResourceTypes.JAVASCRIPT: {
                    console.info(`[RESC] 检测到 JavaScript 模块 ${this.path} ，尝试导入...`);
                    let func = (await import(join(process.cwd(), this.path)));
                    let func_default = func.default
                    parsed_content = {
                        [basename(this.path)]: func_default,
                        ...func
                    };
                    break;
                }
                case ResourceTypes.INVALID: {
                    parsed_content = {};
                    break;
                }
            }
            this.content = parsed_content;
            if (parsed_content['@']) {
                this.is_process_only = true;
                console.info.when_detailed(`[RESC] 因文件包含 @ 小节，文件 ${path} 将不会被输出.`);
            }
        } catch (e) {
            console.info('[CRIT] 初始化资源文件时出现错误！');
            console.error(e);
            process.exit(4);
        }
    }
}

export const ResourceTypes = {
    INI: Symbol('resource_types:ini'),
    YAML: Symbol('resource_types:yaml'),
    JAVASCRIPT: Symbol('resource_types:javascript'),
    INVALID: Symbol('resource_types:invalid'),
}

export const source = async (path, configuration) => {
    let resource = new Resource(path);
    await resource.init(configuration);
    return resource;
};

export class ResourceManager {
    /**
     * @type {Map<string, Resource>}
     */
    resources = new Map();

    constructor(existed_map = []) {
        this.resources = new Map(existed_map);
    }

    get(path) {
        return this.resources.get(path);
    }
    set(path, object) {
        this.resources.set(path, object);
    }
    delete(path) {
        this.resources.delete(path);
    }
    get_sorted_resources() {
        const sorted_keys = [...this.resources.keys()].sort();

        const sorted_resources = new Map();
        sorted_keys.forEach(key => {
            sorted_resources.set(key, this.resources.get(key));
        });
        return sorted_resources;
    }
}