import { mkdir, readdir, writeFile } from "node:fs/promises";
import { statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { stringify as stringifyIni } from "ini";
import { MacroManager } from "./lib/macro.mjs";
import { Inherit } from "./lib/inherit.mjs";
import { Wrap } from "./lib/wrap.mjs";
import { readFile } from "./lib/read.mjs";

async function App(argv = ['Console Argument']) {
    console.log('Config path:', argv[2]);

    // 读取配置文件
    let config = await readFile(argv[2]);
    let final_string = '';

    let { InputRoot, OutputPath, MacroRoot, Registery, RegisterFile, IsRelease } = config;

    // 初始化文件管理器
    const fileManager = new readFile.FileManager(config);

    // 读取所有文件
    let all_files = (await readdir(InputRoot, {
        recursive: true
    })).filter(v => !v.startsWith('@') && !basename(v).startsWith('@')).filter(v => statSync(join(InputRoot, v)).isFile());

    let file_map = new Map();

    // 并行读取文件
    await Promise.all(all_files.map(v => (async () => {
        try {
            let object = await fileManager.readAndParseFile(join(InputRoot, v));
            file_map.set(v, object);
        } catch (error) {
            console.error(`读取文件失败: ${v}`, error);
            // 可以选择继续执行或抛出错误
        }
    })()));

    // 处理宏和继承
    const macroManager = await MacroManager.new(MacroRoot);
    const inherit = new Inherit(file_map);

    // 处理注册表
    let registery_root = {};

    for (const { Target: register_name, Source: sources, Start } of Registery) {
        registery_root[register_name] = {};
        let i = Start ?? 1;
        sources.forEach(v => {
            if (file_map.has(v)) {
                let target_obj = file_map.get(v);
                let target_sections = Object.keys(target_obj);
                target_sections.forEach(name => {
                    registery_root[register_name][i] = name;
                    i++;
                });
            } else {
                console.warn(`注册表源文件不存在: ${v}`);
            }
        });
    }

    // 将注册表添加到文件映射中
    file_map.set(RegisterFile, registery_root);
    // 同时缓存到文件管理器中
    fileManager.cacheParsedFile(RegisterFile, registery_root);

    // 排序文件映射
    let sorted_file_map = new Map([...file_map.entries()].sort((a, b) => {
        return a[0].localeCompare(b[0]);
    }));

    // 处理每个文件的内容
    for (const [name, obj] of sorted_file_map) {
        let processed_obj = Object.fromEntries(Object.entries(obj).map(([section_name, section_values]) => {
            // 处理宏和继承
            let raw_entries = Object.entries(section_values).map(v => new Wrap(...v));
            let raw_length = raw_entries.length;
            for (let i = 0; i < raw_length; i++) {
                let current_wrap = raw_entries[i];
                if (current_wrap.key.startsWith('@')) {
                    if (current_wrap.key === '@Inherits') {
                        // 传递当前文件名给inherit.get方法
                        let inherit_section = inherit.get(current_wrap.value, name);
                        raw_entries[i] = Wrap.wrapEntries(Object.entries(inherit_section));
                    } else {
                        let macro_name = current_wrap.key.replace('@', '');
                        let macroed_object = macroManager.getMacro(macro_name, current_wrap.value);
                        raw_entries[i] = Wrap.wrapEntries(Object.entries(macroed_object));
                    }
                }
            }
            let processed_obj = Object.fromEntries(raw_entries.flat(Infinity).map(v => v.unwrap()));
            return [section_name, processed_obj];
        }));

        // 序列化为INI格式
        let serialized_result = stringifyIni(processed_obj);

        // 添加文件标记（非发布模式）
        final_string += IsRelease ? `\n` : `\n\n;; ${name}\n\n`;
        final_string += serialized_result;
    }

    // 确保输出目录存在
    await mkdir(dirname(OutputPath), { recursive: true });

    // 写入输出文件
    await writeFile(OutputPath, final_string);

    console.log(`处理完成，输出文件: ${OutputPath}`);
}

await App(process.argv);