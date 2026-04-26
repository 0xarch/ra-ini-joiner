import { relative } from "node:path";
import { File } from "./file.mjs";
import { Resource } from "./resource.mjs";

export default class Registry {
    #configuration;
    #resourceManager;
    file_name;
    table;
    output_object = {};

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