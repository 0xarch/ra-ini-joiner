// 首先在导入部分添加Registry模块导入
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { stringify as stringifyIni } from "ini";
import MacroLib from "./lib/macro.mjs";
import Registry from "./lib/registry.mjs";
import Configuration from "./lib/config.mjs";
import { ResourceManager, source } from "./lib/resource.mjs";
import { traverseFileWork } from "./lib/workflow.mjs";

async function AppV2(argv = process.argv) {
    let configuration = new Configuration(argv);
    await configuration.init();

    // spec-options
    console.info.when_detailed = configuration.content.IsDetailedConsole ? console.info : () => { };
    console.warn.when_detailed = configuration.content.IsDetailedConsole ? console.warn : () => { };

    const resourceManager = new ResourceManager();

    console.info.when_detailed(`[MAIN] 正在遍历 ${configuration.InputRoot} 中的文件...`);
    let [all_input_files, ignore_input_file_count] = await traverseFileWork(configuration.InputRoot, configuration.IgnoreFiles);
    console.info(`[MAIN] 成功遍历了 ${configuration.InputRoot} 中的 ${all_input_files.length} 个文件, 忽略了 ${ignore_input_file_count} 个文件/文件夹.`);

    console.info.when_detailed(`[MAIN] 正在遍历 ${configuration.Macro.Root} 中的文件...`);
    let [all_macro_files, ignore_macro_file_count] = await traverseFileWork(configuration.Macro.Root, configuration.IgnoreFiles);
    console.info(`[MAIN] 成功遍历了 ${configuration.Macro.Root} 中的 ${all_macro_files.length} 个文件, 忽略了 ${ignore_macro_file_count} 个文件/文件夹.`);

    console.info.when_detailed(`[MAIN] 正在遍历显式指定的文件...`);
    let all_explicit_files = [];
    {
        all_explicit_files = (await Promise.all(configuration.ExplicitRequiredFiles.map(path => (async () => {
            let file_stat = await stat(path);
            if (!file_stat.isFile()) {
                console.warn(`[MAIN] 显式指定的文件 ${path} 不存在或不是文件！该文件被忽略.`);
                return null;
            }
            return path;
        })()))).filter(Boolean);
    }
    console.info.when_detailed(`[MAIN] 成功遍历了显式指定的文件.`);

    console.info.when_detailed(`[MAIN] 正在解析文件...`);
    let output_file_count = 0;
    await Promise.all(all_input_files.map(path => (async () => {
        let resource = await source(path, configuration);
        if (resource.is_process_only) output_file_count++;
        resourceManager.set(resource.path, resource);
    })()));
    await Promise.all(all_macro_files.map(path => (async () => {
        let resource = await source(path, configuration);
        if (!resource.is_process_only) {
            resource.is_process_only = true;
            console.info.when_detailed(`[RESC] 因文件 ${path} 位于宏目录 ${configuration.Macro.Root} 中，因此不会被输出.`);
        }
        output_file_count++;
        resourceManager.set(resource.path, resource);
    })()));
    await Promise.all(all_explicit_files.map(path => (async () => {
        let resource = await source(path, configuration);
        resource.is_process_only = true;
        output_file_count++;
        resourceManager.set(resource.path, resource);
    })()));
    console.info(`[MAIN] 成功解析了 ${resourceManager.resources.size} 个文件，其中 ${output_file_count} 个文件将不会被输出.`);

    console.info.when_detailed(`[MAIN] 开始处理宏.`);
    let macroLib = new MacroLib(configuration, resourceManager);
    await macroLib.resolve_all();
    console.info(`[MAIN] 完成处理宏.`);

    console.info.when_detailed(`[MAIN] 开始处理注册表.`);
    let registry = new Registry(configuration, resourceManager);
    await registry.process_all();
    console.info(`[MAIN] 注册表处理完毕.`);

    console.info.when_detailed(`[MAIN] 开始最终处理.`);
    let output_object = {};
    for (const [path, resource] of resourceManager.get_sorted_resources()) {
        if (resource.is_process_only) continue;
        console.info.when_detailed(`[MAIN] 最终处理文件 ${path} .`);
        for (const [obj_id, object] of Object.entries(resource.content)) {
            if (object.___dontexportme___) continue;
            if (!output_object[obj_id])
                output_object[obj_id] = {};
            for (const [key, value] of Object.entries(object)) {
                if (key === '___skip_resolve___' || key === '___parameter_macro___') continue;
                switch (typeof value) {
                    case 'number':
                    case 'boolean':
                    case 'string': {
                        output_object[obj_id][key] = value;
                        break;
                    }
                    case 'object': {
                        if (Array.isArray(value)) {
                            output_object[obj_id][key] = value;
                            break;
                        }
                        if (value === null) {
                            break;
                        }
                    }
                    default:
                        console.warn(`[MAIN] 检测到未支持的数据类型 ${typeof value} ！请检查文件 ${path} 中的 [${obj_id}]#${key}.\n       注意这可能由宏引起.`);
                }
            }
        }
        console.info.when_detailed(`[MAIN] 文件 ${path} 最终处理完毕.`);
    }
    console.info(`[MAIN] 最终处理完毕.`);

    let final_string = stringifyIni(output_object);
    await mkdir(dirname(configuration.OutputPath), {
        recursive: true
    });
    await writeFile(configuration.OutputPath, final_string);
}

AppV2(process.argv);