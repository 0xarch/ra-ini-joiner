// however this code is unused. one day someone will take this

export class FileManager {
    /**
     * @type {Map<string,string>}
     */
    #map = new Map();
    /**
     * @type {Map<string,object>}
     */
    #map_serialized = new Map();
    config;
    constructor(config){
        this.config = config;
    }

    push(file_path,file_content){
        this.#map.set(file_path,file_content);
    }

    get(file_path){
        return this.#map.get(file_path);
    }

    get_serialized(file_path){
        if(this.#map_serialized.has(file_path)){
            return this.#map_serialized.get(file_path);
        }
        this.#map_serialized.set(file_path,);
    }
}