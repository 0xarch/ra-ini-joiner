import { readFile } from "node:fs/promises";
import { parse } from "yaml";

export default class Configuration {
    path = '';
    raw_content = '';
    content = {};
    InputRoot = '';
    OutputPath = '';
    Macro = {
        Root: '',
        IgnoreKeys: [''],
        ExplicitKeys: [''],
        Overrides: { '': '' },
        DefaultFileSuffix: '',
        AutoDetect: false
    }
    Registry = {
        File: '',
        Table: [
            {
                Target: '',
                Start: 1,
                Source: ['']
            }
        ]
    };
    IgnoreFiles = [];
    ExplicitRequiredFiles = [];

    constructor(argv = process.argv) {
        let configurationFileIsFromConsole = true;
        let configurationFilePath = argv[2];
        if (!configurationFilePath) {
            configurationFileIsFromConsole = false;
        }
        console.info(`[CONF] 配置文件路径: ${argv[2]} (来自${configurationFileIsFromConsole ? '命令行' : '默认位置'})`);
        this.path = configurationFilePath;
    }

    async init() {
        try {
            let content = (await readFile(this.path)).toString();
            this.raw_content = content;
            let parsed_content = parse(content);
            this.content = parsed_content;
        } catch (e) {
            console.info('[CRIT] 读取配置文件时出现错误:');
            console.error(e);
            process.exit(1);
        }
        this.InputRoot = this.content.InputRoot ?? 'input';
        this.OutputPath = this.content.OutputPath ?? 'output';
        this.Macro.Root = this.content.Macro?.Root ?? this.content.MacroRoot ?? '';
        this.Macro.IgnoreKeys = this.content.Macro?.IgnoreKeys ?? [];
        this.Macro.ExplicitKeys = this.content.Macro?.ExplicitKeys ?? [];
        this.Macro.Overrides = this.content.Macro?.Overrides ?? {};
        this.Macro.DefaultFileSuffix = this.content.Macro?.DefaultFileSuffix ?? '.ini';
        this.Macro.AutoDetect = this.content.Macro?.AutoDetect ?? false;
        this.Registry.File = this.content.Registry?.File ?? this.content.RegistryFile ?? '';
        this.Registry.Table =
            Array.from(this.content.Registry?.Table ?? this.content.RegistryTable ?? []).map((object) => {
                if (!Array.isArray(object.Source)) return null;
                return {
                    Target: object.Target ?? '',
                    Start: object.Start ?? 1,
                    Source: object.Source
                }
            }).filter(Boolean);
        this.IgnoreFiles = this.content.IgnoreFiles ?? [];
        this.ExplicitRequiredFiles = this.content.ExplicitRequiredFiles ?? [];
        console.info(`[CONF] 成功读取了配置文件.`);
    }
}