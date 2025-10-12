export class Wrap {
    constructor(k,v){
        this.key = k;
        this.value = v;
    }

    unwrap(){
        return [this.key,this.value];
    }

    static wrap(k,v){
        return new this(k,v);
    }

    /**
     * 
     * @param {ReturnType<typeof Object.entries>} entries 
     */
    static wrapEntries(entries){
        return entries.map(v => this.wrap(...v));
    }
}