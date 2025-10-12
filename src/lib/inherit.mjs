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
    get(inherit_name) {

        let [filename, sectionname] = inherit_name.split(':');

        if (!sectionname) {
            throw new Error('继承：参数格式不满足要求 "<filename>:<sectionname>":', inherit_name);
        }

        filename = path.normalize(filename);

        let target_obj = this.#file_map.get(filename);

        if(!target_obj){
            throw new Error('继承：请求的文件不存在:',filename);
        }

        // console.log(target_obj);

        let target_section = target_obj[sectionname];

        if(!target_section){
            throw new Error('继承：请求的节不存在于文件',filename,':',sectionname);
        }

        let target_section_parsed = this.resolve(target_section);

        return target_section_parsed;
    }

    resolve(object){
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
                    let section = this.get(v);
                    result.push(...Wrap.wrapEntries(Object.entries(section)));
                });
                entries[i] = result;
            }
        })
        entries = entries.flat(Infinity).map(v => v.unwrap());
        return Object.fromEntries(entries);
    }
}