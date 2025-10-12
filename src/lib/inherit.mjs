import path from "path/posix";
import { Wrap } from "./wrap.mjs";

export class Inherit {
    #file_map;

    constructor(file_map = new Map()) {
        this.#file_map = new Map([...file_map.entries()].map(([k, v]) => {
            k = path.normalize(k);
            return [k, v];
        }));
    }
    get(inherit_name, current_file = null) {

        let [filename, sectionname] = inherit_name.split(':');

        if (!sectionname) {
            throw new Error('继承：参数格式不满足要求 "<filename>:<sectionname>" or "this:<sectionname>":', inherit_name);
        }

        // 处理this:前缀的情况
        if (filename === 'this') {
            if (!current_file) {
                throw new Error('继承：使用"this:"前缀时必须提供当前文件名');
            }
            filename = current_file;
        }

        filename = path.normalize(filename);

        let target_obj = this.#file_map.get(filename);

        if(!target_obj){
            throw new Error('继承：请求的文件不存在:',filename);
        }

        let target_section = target_obj[sectionname];

        if(!target_section){
            throw new Error('继承：请求的节不存在于文件',filename,':',sectionname);
        }

        let target_section_parsed = this.resolve(target_section, filename);

        return target_section_parsed;
    }

    resolve(object, current_file = null){
        let entries = Wrap.wrapEntries(Object.entries(object));
        entries.forEach((wrap,i)=>{
            if(wrap.key === '@Inherits'){
                let inherit_sections = [];
                if(Array.isArray(wrap.value)){
                    inherit_sections =[...wrap.value];
                } else {
                    inherit_sections = [wrap.value];
                }
                let result = [];
                inherit_sections.forEach(v => {
                    let section = this.get(v, current_file);
                    result.push(...Wrap.wrapEntries(Object.entries(section)));
                });
                entries[i] = result;
            }
        })
        entries = entries.flat(Infinity).map(v => v.unwrap());
        return Object.fromEntries(entries);
    }
}