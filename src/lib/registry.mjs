// 注册表模块 - 处理INI Joiner的注册表功能

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

    for (const { Target: register_name, Source: sources, Start } of registeryConfig) {
        registery_root[register_name] = {};
        let i = Start ?? 1;
        
        // 使用 for...of 循环配合 await 处理异步操作
        for (const v of sources) {
            if (file_map.has(v)) {
                // 处理项目内文件
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
                    console.log(`成功读取外部文件到注册表: ${v}`);
                } catch (error) {
                    console.warn(`注册表源文件不存在或读取失败: ${v}`, error.message);
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
export class Registery {
    static async process(file_map, registeryConfig, registerFile, fileManager) {
        return processRegistery(file_map, registeryConfig, registerFile, fileManager);
    }
}