// 完善文件管理器，用于统一管理文件的读取、解析和缓存
import { readFile as Node_readFile } from "node:fs/promises";
import { statSync } from "node:fs";
import { extname, normalize } from "node:path";
import { parse as parseYaml } from "yaml";
import { parse as parseIni } from "ini";

/**
 * 文件管理器类，统一管理文件的读取、解析和缓存
 */
export class FileManager {
    /**
     * @type {Map<string,string>} 缓存原始文件内容
     */
    #rawContentMap = new Map();

    /**
     * @type {Map<string,object>} 缓存解析后的文件内容
     */
    #parsedContentMap = new Map();

    /**
     * @type {Map<string,boolean>} 记录文件是否存在
     */
    #fileExistsMap = new Map();

    /**
     * @type {object} 配置对象
     */
    #config;

    /**
     * 构造函数
     * @param {object} config 配置对象
     */
    constructor(config) {
        this.#config = config || {};
    }

    /**
     * 规范化文件路径
     * @param {string} file_path 文件路径
     * @returns {string} 规范化后的路径
     */
    normalizePath(file_path) {
        return normalize(file_path);
    }

    /**
     * 检查文件是否存在
     * @param {string} file_path 文件路径
     * @returns {boolean} 文件是否存在
     */
    fileExists(file_path) {
        const normalizedPath = this.normalizePath(file_path);

        if (this.#fileExistsMap.has(normalizedPath)) {
            return this.#fileExistsMap.get(normalizedPath);
        }

        try {
            const exists = statSync(normalizedPath).isFile();
            this.#fileExistsMap.set(normalizedPath, exists);
            return exists;
        } catch (error) {
            this.#fileExistsMap.set(normalizedPath, false);
            return false;
        }
    }

    /**
     * 读取文件原始内容
     * @param {string} file_path 文件路径
     * @returns {Promise<string>} 文件原始内容
     */
    async readRawFile(file_path) {
        const normalizedPath = this.normalizePath(file_path);

        // 检查缓存
        if (this.#rawContentMap.has(normalizedPath)) {
            return this.#rawContentMap.get(normalizedPath);
        }

        // 检查文件是否存在
        if (!this.fileExists(normalizedPath)) {
            throw new Error(`文件不存在: ${normalizedPath}`);
        }

        try {
            const content = await Node_readFile(normalizedPath, 'utf8');
            this.#rawContentMap.set(normalizedPath, content);
            return content;
        } catch (error) {
            console.error(`读取文件失败: ${normalizedPath}`, error);
            throw error;
        }
    }

    /**
     * 读取并解析文件
     * @param {string} file_path 文件路径
     * @returns {Promise<object>} 解析后的文件内容
     */
    async readAndParseFile(file_path) {
        const normalizedPath = this.normalizePath(file_path);

        // 检查缓存
        if (this.#parsedContentMap.has(normalizedPath)) {
            return this.#parsedContentMap.get(normalizedPath);
        }

        try {
            const rawContent = await this.readRawFile(normalizedPath);
            const parsedContent = this.parseContent(rawContent, file_path);
            this.#parsedContentMap.set(normalizedPath, parsedContent);
            return parsedContent;
        } catch (error) {
            console.error(`解析文件失败: ${normalizedPath}`, error);
            throw error;
        }
    }

    /**
     * 根据文件扩展名解析内容
     * @param {string} content 文件内容
     * @param {string} file_path 文件路径
     * @returns {object} 解析后的内容
     */
    parseContent(content, file_path) {
        const ext_name = extname(file_path).toLowerCase();

        try {
            if (ext_name === '.ini') {
                return parseIni(content);
            } else if (ext_name === '.yaml' || ext_name === '.yml') {
                return parseYaml(content);
            } else {
                throw new Error(`不支持的文件类型: ${ext_name}`);
            }
        } catch (error) {
            console.error(`解析内容失败: ${file_path}`, error);
            throw error;
        }
    }

    /**
     * 缓存解析后的文件内容
     * @param {string} file_path 文件路径
     * @param {object} content 解析后的内容
     */
    cacheParsedFile(file_path, content) {
        const normalizedPath = this.normalizePath(file_path);
        this.#parsedContentMap.set(normalizedPath, content);
    }

    /**
     * 获取缓存的解析内容
     * @param {string} file_path 文件路径
     * @returns {object|null} 解析后的内容，不存在则返回null
     */
    getParsedFile(file_path) {
        const normalizedPath = this.normalizePath(file_path);
        return this.#parsedContentMap.get(normalizedPath) || null;
    }

    /**
     * 清除指定文件的缓存
     * @param {string} file_path 文件路径
     */
    clearCache(file_path) {
        const normalizedPath = this.normalizePath(file_path);
        this.#rawContentMap.delete(normalizedPath);
        this.#parsedContentMap.delete(normalizedPath);
        this.#fileExistsMap.delete(normalizedPath);
    }

    /**
     * 清除所有缓存
     */
    clearAllCache() {
        this.#rawContentMap.clear();
        this.#parsedContentMap.clear();
        this.#fileExistsMap.clear();
    }
}