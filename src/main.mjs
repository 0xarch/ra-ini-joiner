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

    let config = await readFile(argv[2]);
    let final_string = '';

    let { InputRoot, OutputPath, MacroRoot, Registery, RegisterFile, IsRelease } = config;


    // console.log(InputRoot, OutputPath, Registery);

    let all_files = (await readdir(InputRoot, {
        recursive: true
    })).filter(v => !v.startsWith('@') && !basename(v).startsWith('@')).filter(v => statSync(join(InputRoot, v)).isFile());

    let file_map = new Map();

    await Promise.all(all_files.map(v => (async () => {
        let object = await readFile(join(InputRoot, v));

        file_map.set(v, object);
    })()));

    const macroManager = await MacroManager.new(MacroRoot);
    const inherit = new Inherit(file_map);

    // handle registery
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
            };
        });
    }

    file_map.set(RegisterFile, registery_root);

    let sorted_file_map = new Map([...file_map.entries()].sort((a, b) => {
        return a[0].localeCompare(b[0]);
    }));

    for (const [name, obj] of sorted_file_map) {
        let processed_obj = Object.fromEntries(Object.entries(obj).map(([section_name, section_values]) => {
            // handle macro
            let raw_entries = Object.entries(section_values).map(v => new Wrap(...v));
            let raw_length = raw_entries.length;
            for (let i = 0; i < raw_length; i++) {
                let current_wrap = raw_entries[i];
                if (current_wrap.key.startsWith('@')) {
                    if (current_wrap.key === '@Inherits') {
                        let inherit_section = inherit.get(current_wrap.value);

                        raw_entries[i] = Wrap.wrapEntries(Object.entries(inherit_section));
                    } else {
                        let macro_name = current_wrap.key.replace('@', '');
                        let macroed_object = macroManager.getMacro(macro_name, current_wrap.value);
                        raw_entries[i] = Wrap.wrapEntries(Object.entries(macroed_object));
                    }
                }
            };
            let processed_obj = Object.fromEntries(raw_entries.flat(Infinity).map(v => v.unwrap()));
            return [section_name, processed_obj];
        }));

        let serialized_result = stringifyIni(processed_obj);

        final_string += IsRelease ? `\n` : `\n\n;; ${name}\n\n`;
        final_string += serialized_result;
    }

    await mkdir(dirname(OutputPath), { recursive: true });

    await writeFile(OutputPath, final_string);
}

await App(process.argv);