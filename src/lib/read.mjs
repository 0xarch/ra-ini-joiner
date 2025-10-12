import { parse as parseYaml } from "yaml";
// import { default as parseIni } from "ini-simple-parser";
import { parse as parseIni } from "ini";
import { readFile as Node_readFile } from "node:fs/promises";
import { extname } from "node:path";

export async function readFile(file_path, { enableInclude=false, enableMacro=false, includeRootPath='', macroRootPath=''} = {}){
    try {
        let raw_content = await Node_readFile(file_path);
        let ext_name = extname(file_path);
        if(ext_name === '.ini') {
            // console.log('Parsing INI File:',file_path);
            let parsed_object = parseIni(raw_content.toString());
            // if(Object.keys(parsed_object).length === 1){ // simple hack to ensure the same behaviour with YAML
            //     return Object.values(parsed_object)[0];  // should be handled only when including and marcos. dont do it here
            // }
            return parsed_object;
        }
        if(ext_name === '.yaml' || ext_name === '.yml'){
            // console.log('Parsing YAML File:', file_path);
            return parseYaml(raw_content.toString());
        }
    } catch(e) {
        console.log('Error while reading file:',file_path);
        throw e;
    }
}