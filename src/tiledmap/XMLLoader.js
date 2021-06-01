import {Asset} from "phina.js";

export class XMLLoader extends Asset{
    constructor() {
        super();
        this.path = "";
    }

    loadDummy() { }

    _load(resolve) {
        //パス抜き出し
        this.path = "";
        const last = this.src.lastIndexOf("/");
        if (last > 0) {
            this.path = this.src.substring(0, last + 1);
        }

        //終了関数保存
        this._resolve = resolve;

        // load
        const xml = new XMLHttpRequest();
        xml.open('GET', this.src);
        xml.onreadystatechange = () => {
            if (xml.readyState === 4) {
                if ([200, 201, 0].indexOf(xml.status) !== -1) {
                    const data = (new DOMParser()).parseFromString(xml.responseText, "text/xml");
                    this.dataType = "xml";
                    this.data = data;
                    this._parse(data)
                        .then(() => this._resolve(this));
                }
            }
        };
        xml.send(null);
    }

    //XMLプロパティをJSONに変換
    _propertiesToJSON(elm) {
        const properties = elm.getElementsByTagName("properties")[0];
        const obj = {};
        if (properties === undefined) return obj;

        for (let k = 0; k < properties.childNodes.length; k++) {
            const p = properties.childNodes[k];
            if (p.tagName === "property") {
                let value = p.getAttribute('value');
                if (!value) value = p.textContent;
                //propertyにtype指定があったら変換
                const type = p.getAttribute('type');
                if (type === "int") {
                    obj[p.getAttribute('name')] = parseInt(value, 10);
                } else if (type === "float") {
                    obj[p.getAttribute('name')] = parseFloat(value);
                } else if (type === "bool" ) {
                    obj[p.getAttribute('name')] = value === "true";
                } else {
                    obj[p.getAttribute('name')] = value;
                }
            }
        }
        return obj;
    }

    //XML属性をJSONに変換
    _attrToJSON(source) {
        const obj = {};
        for (let i = 0; i < source.attributes.length; i++) {
            let val = source.attributes[i].value;
            val = isNaN(parseFloat(val))? val: parseFloat(val);
            obj[source.attributes[i].name] = val;
        }
        return obj;
    }

    //XML属性をJSONに変換（Stringで返す）
    _attrToJSON_str(source) {
        const obj = {};
        for (let i = 0; i < source.attributes.length; i++) {
            obj[source.attributes[i].name] = source.attributes[i].value;
        }
        return obj;
    }

    /**
     * CSVパース
     * @protected
     */
    _parseCSV(data) {
        const layer = [];
        const dataList = data.split(',');
        dataList.forEach(elm => {
            const num = parseInt(elm, 10);
            layer.push(num);
        });
        return layer;
    }

    /**
     * BASE64パース
     * http://thekannon-server.appspot.com/herpity-derpity.appspot.com/pastebin.com/75Kks0WH
     * @protected
     */
    _parseBase64(data) {
        const rst = [];
        const dataList = atob(data.trim()).split('').map(e => e.charCodeAt(0));
        for (let i = 0, len = dataList.length / 4; i < len; ++i) {
            const n = dataList[i * 4].toString();
            rst[i] = parseInt(n, 10);
        }
        return rst;
    }
}