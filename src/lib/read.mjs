import { FileManager } from "./file.mjs";

// 全局文件管理器实例，用于向后兼容
let globalFileManager = null;

/**
 * 读取文件的函数，保持向后兼容
 * @param {string} file_path 文件路径
 * @param {object} options 选项
 * @returns {Promise<object>} 解析后的文件内容
 */
export async function readFile(file_path, { enableInclude = false, enableMacro = false, includeRootPath = '', macroRootPath = '' } = {}) {
    try {
        // 延迟初始化全局文件管理器
        if (!globalFileManager) {
            globalFileManager = new FileManager();
        }

        return await globalFileManager.readAndParseFile(file_path);
    } catch (e) {
        console.log('Error while reading file:', file_path);
        throw e;
    }
}

// 导出FileManager类，方便直接使用
readFile.FileManager = FileManager;