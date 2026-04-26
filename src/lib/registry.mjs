/**
 * 注册表配置处理模块
 * 负责处理INI文件中的注册表配置，包括项目内文件和外部文件
 */

import { relative } from "node:path";
import { File } from "./file.mjs";
import { Resource } from "./resource.mjs";

/**
 * 处理注册表配置，包括项目内文件和外部文件
 * @param {Map} file_map - 文件映射Map
 * @param {Array} registeryConfig - 注册表配置数组
 * @param {string} registerFile - 注册表文件名
 * @param {Object} fileManager - 文件管理器实例
 * @returns {Promise<Object>} 处理后的注册表对象
 */
export async function processRegistery(file_map, registeryConfig, registerFile, fileManager) {
    let registery_root = {};

    if (!registeryConfig) {
        return registery_root;
    }

    for (const { Target: register_name, Source: sources, Start } of registeryConfig) {
        registery_root[register_name] = {};
        let i = Start ?? 1;

        // 使用 for...of 循环配合 await 处理异步操作
        for (const v of sources) {
            // 检查路径是否包含通配符
            if (fileManager.hasWildcard(v)) {
                // 处理通配符路径
                const matchingFiles = fileManager.findMatchingFiles(v, file_map);

                if (matchingFiles.length > 0) {
                    for (const filePath of matchingFiles) {
                        if (file_map.has(filePath)) {
                            let target_obj = file_map.get(filePath);
                            let target_sections = Object.keys(target_obj);
                            target_sections.forEach(name => {
                                registery_root[register_name][i] = name;
                                i++;
                            });
                        }
                    }
                    console.log(`注册表：在表 ${register_name} 中，通配符模式 "${v}" 匹配到 ${matchingFiles.length} 个文件`);
                } else {
                    console.warn(`[!] 注册表：在表 ${register_name} 中，通配符模式 "${v}" 没有匹配到任何文件`);
                }
            } else if (file_map.has(v)) {
                // 处理项目内文件（无通配符）
                let target_obj = file_map.get(v);
                let target_sections = Object.keys(target_obj);
                target_sections.forEach(name => {
                    registery_root[register_name][i] = name;
                    i++;
                });
            } else {
                try {
                    // 尝试直接读取外部文件
                    let target_obj = await fileManager.readAndParseFile(v);
                    let target_sections = Object.keys(target_obj);
                    target_sections.forEach(name => {
                        registery_root[register_name][i] = name;
                        i++;
                    });
                    console.log(`注册表：成功读取外部文件到表 ${register_name}: ${v}`);
                } catch (error) {
                    console.warn(`注册表：尝试读取外部文件到表 ${register_name} 时：源文件不存在或读取失败: ${v}`, error.message);
                }
            }
        }
    }

    // 将注册表添加到文件映射中
    file_map.set(registerFile, registery_root);
    // 同时缓存到文件管理器中
    fileManager.cacheParsedFile(registerFile, registery_root);

    return registery_root;
}

// 保留类的形式以保持向后兼容
export class Registry {
    #configuration;
    #resourceManager;
    file_name;
    table;
    output_object = {};

    static async process(file_map, registeryConfig, registerFile, fileManager) {
        return processRegistery(file_map, registeryConfig, registerFile, fileManager);
    }

    /**
     * 
     * @param {import("./config.mjs").default} configuration 
     * @param {import("./resource.mjs").ResourceManager} resourceManager 
     */
    constructor(configuration, resourceManager) {
        this.#configuration = configuration;
        this.#resourceManager = resourceManager;
        this.file_name = configuration.Registry.File;
        this.table = configuration.Registry.Table;
    }

    async process_all() {
        for (let { Target, Start, Source } of this.table) {
            let sources = Source.map(s => this.get_source(s)).flat(Infinity);
            this.output_object[Target] = Array.from({ length: Start }).fill(null);
            sources.forEach((path) => {
                let resource = this.#resourceManager.get(path);
                this.output_object[Target].push(...Object.keys(resource.content));
            });
        }
        let resource = new Resource(this.file_name, true);
        resource.content = this.output_object;
        resource.is_process_only = false;
        this.#resourceManager.set(this.file_name, resource);
    }

    get_source(source_str) {
        let all_files = Array.from(this.#resourceManager.resources.keys());

        if (!source_str || source_str.trim() === '') {
            return [];
        }

        const regex = File.pattern_to_regex(source_str);

        return all_files.filter(file_path => {
            const formatted_path = File.format_path(relative(this.#configuration.InputRoot, file_path));
            if (formatted_path === '') return false;

            if (File.has_special_dir(formatted_path)) return false;

            return regex.test(formatted_path);
        });
    }
}