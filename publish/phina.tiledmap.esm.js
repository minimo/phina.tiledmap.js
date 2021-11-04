/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/tiledmap/Tiledmap.js":
/*!**********************************!*\
  !*** ./src/tiledmap/Tiledmap.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TiledMap": () => (/* binding */ TiledMap)
/* harmony export */ });
/* harmony import */ var _XMLLoader__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./XMLLoader */ "./src/tiledmap/XMLLoader.js");
/* harmony import */ var phina_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! phina.js */ "./node_modules/phina.js/build/phina.esm.js");



class TiledMap extends _XMLLoader__WEBPACK_IMPORTED_MODULE_0__.XMLLoader{
    constructor() {
      super();
      this.image = null;
      this.tilesets = null;
      this.layers = null;
      this.path = "";
    }

    /**
     * マップイメージ取得
     * @param layerName {String}
     * @returns {Texture|null}
     */
    getImage(layerName) {
      if (layerName === undefined) {
        return this.image;
      } else {
        return this._generateImage(layerName);
      }
    }

    /**
     * 指定マップレイヤーを配列として取得
     * @param layerName {String}
     * @returns {null|*}
     */
    getMapData(layerName) {
      //レイヤー検索
      for(let i = 0; i < this.layers.length; i++) {
        if (this.layers[i].name === layerName) {
          //コピーを返す
          return this.layers[i].data.concat();
        }
      }
      return null;
    }

    /**
     * オブジェクトグループを取得（指定が無い場合、全レイヤーを配列にして返す）
     * @param groupName {String}
     * @returns {*[]|any}
     */
    getObjectGroup(groupName) {
      groupName = groupName || null;
      const ls = [];
      const len = this.layers.length;
      for (let i = 0; i < len; i++) {
        if (this.layers[i].type === "objectgroup") {
          if (groupName == null || groupName === this.layers[i].name) {
            //レイヤー情報をクローンする
            const obj = this._cloneObjectLayer(this.layers[i]);
            if (groupName !== null) return obj;
            ls.push(obj);
          }
        }
      }
      return ls;
    }

    /**
     * オブジェクトレイヤーをクローンして返す
     * @param srcLayer {String}
     * @returns {any}
     * @private
     */
    _cloneObjectLayer(srcLayer) {
      const result = $safe.call({}, srcLayer);
      result.objects = [];
      //レイヤー内オブジェクトのコピー
      srcLayer.objects.forEach(obj => {
        const resObj = {
          properties: $safe.call({}, obj.properties),
        }
        $extend.call(resObj, obj);
        if (obj.ellipse) resObj.ellipse = obj.ellipse;
        if (obj.gid) resObj.gid = obj.gid;
        if (obj.polygon) resObj.polygon = obj.polygon.clone();
        if (obj.polyline) resObj.polyline = obj.polyline.clone();
        result.objects.push(resObj);
      });
      return result;
    }

    /**
     * データのパースを行う
     * @param data {XMLDocument}
     * @returns {Promise<void>}
     * @private
     */
    _parse(data) {
      return new Promise(resolve => {
        //タイル属性情報取得
        const map = data.getElementsByTagName('map')[0];
        const attr = this._attrToJSON(map);
        $extend.call(this, attr);
        this.properties = this._propertiesToJSON(map);

        //タイルセット取得
        this.tilesets = this._parseTilesets(data);
        this.tilesets.sort((a, b) => a.firstgid - b.firstgid);

        //レイヤー取得
        this.layers = this._parseLayers(data);

        //イメージデータ読み込み
        this._checkImage()
          .then(() => {
            //マップイメージ生成
            this.image = this._generateImage();
            resolve(this.image);
          });
      })
    }

    /**
     * タイルセットのパース
     * @param xml {XMLDocument}
     * @returns {*[]}
     * @private
     */
    _parseTilesets(xml) {
      const each = Array.prototype.forEach;
      const data = [];
      const tilesets = xml.getElementsByTagName('tileset');
      each.call(tilesets, async tileset => {
        const t = {};
        const attr = this._attrToJSON(tileset);
        if (attr.source) {
          t.isOldFormat = false;
          t.source = this.path + attr.source;
        } else {
          //旧データ形式（未対応）
          t.isOldFormat = true;
          t.data = tileset;
        }
        t.firstgid = attr.firstgid;
        data.push(t);
      });
      return data;
    }

    /**
     * レイヤー情報のパース
     * @param xml {XMLDocument}
     * @returns {*[]}
     * @private
     */
    _parseLayers(xml) {
      const each = Array.prototype.forEach;
      const data = [];

      const map = xml.getElementsByTagName("map")[0];
      const layers = [];
      each.call(map.childNodes, elm => {
        if (elm.tagName === "layer" || elm.tagName === "objectgroup" || elm.tagName === "imagelayer") {
          layers.push(elm);
        }
      });

      layers.forEach(layer => {
        switch (layer.tagName) {
          case "layer":
            {
              //通常レイヤー
              const d = layer.getElementsByTagName('data')[0];
              const encoding = d.getAttribute("encoding");
              const l = {
                  type: "layer",
                  name: layer.getAttribute("name"),
              };

              if (encoding === "csv") {
                  l.data = this._parseCSV(d.textContent);
              } else if (encoding === "base64") {
                  l.data = this._parseBase64(d.textContent);
              }

              const attr = this._attrToJSON(layer);
              $extend.call(l, attr);
              l.properties = this._propertiesToJSON(layer);

              data.push(l);
            }
            break;

          //オブジェクトレイヤー
          case "objectgroup":
            {
              const l = {
                type: "objectgroup",
                objects: [],
                name: layer.getAttribute("name"),
                x: parseFloat(layer.getAttribute("offsetx")) || 0,
                y: parseFloat(layer.getAttribute("offsety")) || 0,
                alpha: layer.getAttribute("opacity") || 1,
                color: layer.getAttribute("color") || null,
                draworder: layer.getAttribute("draworder") || null,
              };
              each.call(layer.childNodes, elm => {
                if (elm.nodeType === 3) return;
                const d = this._attrToJSON(elm);
                d.properties = this._propertiesToJSON(elm);
                //子要素の解析
                if (elm.childNodes.length) {
                  elm.childNodes.forEach(e => {
                    if (e.nodeType === 3) return;
                    //楕円
                    if (e.nodeName === 'ellipse') {
                      d.ellipse = true;
                    }
                    //多角形
                    if (e.nodeName === 'polygon') {
                      d.polygon = [];
                      const attr = this._attrToJSON_str(e);
                      const pl = attr.points.split(" ");
                      pl.forEach(function(str) {
                        const pts = str.split(",");
                        d.polygon.push({x: parseFloat(pts[0]), y: parseFloat(pts[1])});
                      });
                    }
                    //線分
                    if (e.nodeName === 'polyline') {
                      d.polyline = [];
                      const attr = this._attrToJSON_str(e);
                      const pl = attr.points.split(" ");
                      pl.forEach(str => {
                        const pts = str.split(",");
                        d.polyline.push({x: parseFloat(pts[0]), y: parseFloat(pts[1])});
                      });
                    }
                  });
                }
                l.objects.push(d);
              });
              l.properties = this._propertiesToJSON(layer);

              data.push(l);
            }
            break;

          //イメージレイヤー
          case "imagelayer":
            {
              const l = {
                type: "imagelayer",
                name: layer.getAttribute("name"),
                x: parseFloat(layer.getAttribute("offsetx")) || 0,
                y: parseFloat(layer.getAttribute("offsety")) || 0,
                alpha: layer.getAttribute("opacity") || 1,
                visible: (layer.getAttribute("visible") === undefined || layer.getAttribute("visible") !== 0),
              };
              const imageElm = layer.getElementsByTagName("image")[0];
              l.image = {source: imageElm.getAttribute("source")};

              data.push(l);
            }
            break;
          //グループ
          case "group":
            break;
        }
      });
      return data;
    }

    /**
     * アセットに無いイメージデータを読み込み
     * @returns {Promise<void>}
     * @private
     */
    _checkImage() {
      const imageSource = [];
      const loadImage = [];

      //一覧作成
      this.tilesets.forEach(tileset => {
        const obj = {
          isTileset: true,
          image: tileset.source,
        };
        imageSource.push(obj);
      });
      this.layers.forEach(layer => {
        if (layer.image) {
          const obj = {
            isTileset: false,
            image: layer.image.source,
          };
          imageSource.push(obj);
        }
      });

      //アセットにあるか確認
      imageSource.forEach(e => {
        if (e.isTileset) {
          const tsx = phina_js__WEBPACK_IMPORTED_MODULE_1__.AssetManager.get('tsx', e.image);
          if (!tsx) {
            //アセットになかったのでロードリストに追加
            loadImage.push(e);
          }
        } else {
          const image = phina_js__WEBPACK_IMPORTED_MODULE_1__.AssetManager.get('image', e.image);
          if (!image) {
            //アセットになかったのでロードリストに追加
            loadImage.push(e);
          }
        }
      });

      //一括ロード
      //ロードリスト作成
      if (loadImage.length) {
        const assets = { image: [], tsx: [] };
        loadImage.forEach(e => {
          if (e.isTileset) {
            assets.tsx[e.image] = e.image;
          } else {
            //アセットのパスをマップと同じにする
            assets.image[e.image] = this.path + e.image;
          }
        });
        return new Promise(resolve => {
          const loader = new phina_js__WEBPACK_IMPORTED_MODULE_1__.AssetLoader();
          loader.load(assets);
          loader.on('load', () => {
            this.tilesets.forEach(e => {
              e.tsx = phina_js__WEBPACK_IMPORTED_MODULE_1__.AssetManager.get('tsx', e.source);
            });
            resolve();
          });
        });
      } else {
        return Promise.resolve();
      }
    }

    /**
     * マップイメージ作成
     * @param layerName {String}
     * @returns {Texture|null}
     * @private
     */
    _generateImage(layerName) {
      let numLayer = 0;
      for (let i = 0; i < this.layers.length; i++) {
        if (this.layers[i].type === "layer" || this.layers[i].type === "imagelayer") numLayer++;
      }
      if (numLayer === 0) return null;

      const width = this.width * this.tilewidth;
      const height = this.height * this.tileheight;
      const canvas = new phina_js__WEBPACK_IMPORTED_MODULE_1__.Canvas().setSize(width, height);

      for (let i = 0; i < this.layers.length; i++) {
        //マップレイヤー
        if (this.layers[i].type === "layer" && this.layers[i].visible !== "0") {
          if (layerName === undefined || layerName === this.layers[i].name) {
            const layer = this.layers[i];
            const mapdata = layer.data;
            const width = layer.width;
            const height = layer.height;
            const opacity = layer.opacity || 1.0;
            let count = 0;
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const index = mapdata[count];
                if (index !== 0) {
                  //マップチップを配置
                  this._setMapChip(canvas, index, x * this.tilewidth, y * this.tileheight, opacity);
                }
                count++;
              }
            }
          }
        }
        //オブジェクトグループ
        if (this.layers[i].type === "objectgroup" && this.layers[i].visible !== "0") {
          if (layerName === undefined || layerName === this.layers[i].name) {
            const layer = this.layers[i];
            const opacity = layer.opacity || 1.0;
            layer.objects.forEach(function(e) {
              if (e.gid) {
                this._setMapChip(canvas, e.gid, e.x, e.y, opacity);
              }
            }.bind(this));
          }
        }
        //イメージレイヤー
        if (this.layers[i].type === "imagelayer" && this.layers[i].visible !== "0") {
          if (layerName === undefined || layerName === this.layers[i].name) {
            const image = phina_js__WEBPACK_IMPORTED_MODULE_1__.AssetManager.get('image', this.layers[i].image.source);
            canvas.context.drawImage(image.domElement, this.layers[i].x, this.layers[i].y);
          }
        }
      }

      const texture = new phina_js__WEBPACK_IMPORTED_MODULE_1__.Texture();
      texture.domElement = canvas.domElement;
      return texture;
    }

    /**
     * キャンバスの指定した座標にマップチップのイメージをコピーする
     * @param canvas {HTMLCanvasElement}
     * @param index {Number}
     * @param x {Number}
     * @param y {Number}
     * @private
     */
    _setMapChip(canvas, index, x, y) {
      //対象タイルセットの判別
      let tileset;
      for (let i = 0; i < this.tilesets.length; i++) {
        const tsx1 = this.tilesets[i];
        const tsx2 = this.tilesets[i + 1];
        if (!tsx2) {
          tileset = tsx1;
          i = this.tilesets.length;
        } else if (tsx1.firstgid <= index && index < tsx2.firstgid) {
          tileset = tsx1;
          i = this.tilesets.length;
        }
      }
      //タイルセットからマップチップを取得
      const tsx = tileset.tsx;
      const chip = tsx.chips[index - tileset.firstgid];
      const image = phina_js__WEBPACK_IMPORTED_MODULE_1__.AssetManager.get('image', chip.image);
      canvas.context.drawImage(
        image.domElement,
        chip.x + tsx.margin, chip.y + tsx.margin,
        tsx.tilewidth, tsx.tileheight,
        x, y,
        tsx.tilewidth, tsx.tileheight);
    }
}

/**
 * tmxファイル読み込み
 * @param key {String}
 * @param path {String}
 * @returns {Flow}
 */
phina_js__WEBPACK_IMPORTED_MODULE_1__.AssetLoader.assetLoadFunctions.tmx = (key, path) => {
    const tmx = new TiledMap();
    return tmx.load(path);
}


/***/ }),

/***/ "./src/tiledmap/Tileset.js":
/*!*********************************!*\
  !*** ./src/tiledmap/Tileset.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TileSet": () => (/* binding */ TileSet)
/* harmony export */ });
/* harmony import */ var _XMLLoader__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./XMLLoader */ "./src/tiledmap/XMLLoader.js");
/* harmony import */ var phina_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! phina.js */ "./node_modules/phina.js/build/phina.esm.js");



class TileSet extends _XMLLoader__WEBPACK_IMPORTED_MODULE_0__.XMLLoader{
    constructor(xml) {
        super();
        this.image = null;
        this.tilewidth = 0;
        this.tileheight = 0;
        this.tilecount = 0;
        this.columns = 0;
        this.path = "";
        if (xml) {
            this.loadFromXML(xml);
        }
    }

    /**
     * XMLファイル読み込み
     * @param xml {XMLDocument}
     * @returns {Promise<void>}
     */
    loadFromXML(xml) {
      return this._parse(xml);
    }

    /**
     *
     * @param data {XMLDocument}
     * @returns {Promise<unknown>}
     * @private
     */
    _parse(data) {
      return new Promise(resolve => {
        //タイルセット取得
        const tileset = data.getElementsByTagName('tileset')[0];
        // const props = this._propertiesToJSON(tileset);

        //タイルセット属性情報取得
        const attr = this._attrToJSON(tileset);
        $safe.call(attr,{
          tilewidth: 32,
          tileheight: 32,
          spacing: 0,
          margin: 0,
        });
        $extend.call(this, attr);
        this.chips = [];

        //ソース画像設定取得
        this.imageName = tileset.getElementsByTagName('image')[0].getAttribute('source');
  
        //透過色設定取得
        const trans = tileset.getElementsByTagName('image')[0].getAttribute('trans');
        if (trans) {
          this.transR = parseInt(trans.substring(0, 2), 16);
          this.transG = parseInt(trans.substring(2, 4), 16);
          this.transB = parseInt(trans.substring(4, 6), 16);
        }
  
        //マップチップリスト作成
        for (let r = 0; r < this.tilecount; r++) {
          this.chips[r] = {
              image: this.imageName,
              x: (r  % this.columns) * (this.tilewidth + this.spacing) + this.margin,
              y: Math.floor(r / this.columns) * (this.tileheight + this.spacing) + this.margin,
          };
        }

        //イメージデータ読み込み
        this._loadImage()
          .then(() => resolve());
      });
    }

    /**
     * アセットに無いイメージデータを読み込み
     * @returns {Promise<unknown>}
     * @private
     */
    _loadImage() {
      return new Promise(resolve => {
        const imageSource = {
          imageName: this.imageName,
          imageUrl: this.path + this.imageName,
          transR: this.transR,
          transG: this.transG,
          transB: this.transB,
        };
        
        let loadImage = null;
        const image = phina_js__WEBPACK_IMPORTED_MODULE_1__.AssetManager.get('image', imageSource.image);
        if (image) {
          this.image = image;
        } else {
          loadImage = imageSource;
        }

        //ロードリスト作成
        const assets = { image: [] };
        assets.image[imageSource.imageName] = imageSource.imageUrl;

        if (loadImage) {
          const loader = new phina_js__WEBPACK_IMPORTED_MODULE_1__.AssetLoader();
          loader.load(assets);
          loader.on('load', () => {
            //透過色設定反映
            this.image = phina_js__WEBPACK_IMPORTED_MODULE_1__.AssetManager.get('image', imageSource.imageUrl);
            if (imageSource.transR !== undefined) {
              const r = imageSource.transR;
              const g = imageSource.transG;
              const b = imageSource.transB;
              this.image.filter((pixel, index, x, y, bitmap) => {
                const data = bitmap.data;
                if (pixel[0] === r && pixel[1] === g && pixel[2] === b) {
                    data[index+3] = 0;
                }
              });
            }
            resolve();
          });
        } else {
          resolve();
        }
      });
    }
}

/**
 * tsxファイル読み込み
 * @param key
 * @param path
 * @returns {Flow}
 */
phina_js__WEBPACK_IMPORTED_MODULE_1__.AssetLoader.assetLoadFunctions.tsx = function(key, path) {
    const tsx = new TileSet();
    return tsx.load(path);
};



/***/ }),

/***/ "./src/tiledmap/XMLLoader.js":
/*!***********************************!*\
  !*** ./src/tiledmap/XMLLoader.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "XMLLoader": () => (/* binding */ XMLLoader)
/* harmony export */ });
/* harmony import */ var phina_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! phina.js */ "./node_modules/phina.js/build/phina.esm.js");


class XMLLoader extends phina_js__WEBPACK_IMPORTED_MODULE_0__.Asset{
    constructor() {
        super();
        this.path = "";
    }

    loadDummy() { }

    /**
     * XMLファイルのロード
     * @param resolve {function}
     * @protected
     */
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

    /**
     * XMLプロパティをJSONに変換
     * @param elm {XMLDocument}
     * @returns {{}}
     * @protected
     */
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

    /**
     * XML属性をJSONに変換
     * @param source
     * @returns {{}}
     * @protected
     */
    _attrToJSON(source) {
        const obj = {};
        for (let i = 0; i < source.attributes.length; i++) {
            let val = source.attributes[i].value;
            val = isNaN(parseFloat(val))? val: parseFloat(val);
            obj[source.attributes[i].name] = val;
        }
        return obj;
    }

    /**
     * XML属性をJSONに変換（Stringで返す）
     * @param source
     * @returns {{}}
     * @protected
     */
    _attrToJSON_str(source) {
        const obj = {};
        for (let i = 0; i < source.attributes.length; i++) {
            obj[source.attributes[i].name] = source.attributes[i].value;
        }
        return obj;
    }

    /**
     * CSVパース
     * @param data {string}
     * @returns {*[]}
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
     * @param data {string}
     * @returns {*[]}
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

/***/ }),

/***/ "./node_modules/phina.js/build/phina.esm.js":
/*!**************************************************!*\
  !*** ./node_modules/phina.js/build/phina.esm.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Accelerometer": () => (/* binding */ Accelerometer),
/* harmony export */   "Accessory": () => (/* binding */ Accessory),
/* harmony export */   "Ajax": () => (/* binding */ Ajax),
/* harmony export */   "ArrayEx": () => (/* binding */ arrayExtensions),
/* harmony export */   "ArrayExStatic": () => (/* binding */ arrayStaticExtensions),
/* harmony export */   "Asset": () => (/* binding */ Asset),
/* harmony export */   "AssetLoader": () => (/* binding */ AssetLoader),
/* harmony export */   "AssetManager": () => (/* binding */ AssetManager),
/* harmony export */   "BaseApp": () => (/* binding */ BaseApp),
/* harmony export */   "Button": () => (/* binding */ Button),
/* harmony export */   "Canvas": () => (/* binding */ Canvas),
/* harmony export */   "CanvasApp": () => (/* binding */ CanvasApp),
/* harmony export */   "CanvasLayer": () => (/* binding */ CanvasLayer),
/* harmony export */   "CanvasRenderer": () => (/* binding */ CanvasRenderer),
/* harmony export */   "ChangeDispatcher": () => (/* binding */ ChangeDispatcher),
/* harmony export */   "Circle": () => (/* binding */ Circle),
/* harmony export */   "CircleGauge": () => (/* binding */ CircleGauge),
/* harmony export */   "CircleShape": () => (/* binding */ CircleShape),
/* harmony export */   "Collision": () => (/* binding */ Collision),
/* harmony export */   "Color": () => (/* binding */ Color),
/* harmony export */   "CountScene": () => (/* binding */ CountScene),
/* harmony export */   "DisplayElement": () => (/* binding */ DisplayElement),
/* harmony export */   "DisplayScene": () => (/* binding */ DisplayScene),
/* harmony export */   "DomApp": () => (/* binding */ DomApp),
/* harmony export */   "Draggable": () => (/* binding */ Draggable),
/* harmony export */   "Element": () => (/* binding */ Element),
/* harmony export */   "EventDispatcher": () => (/* binding */ EventDispatcher),
/* harmony export */   "File": () => (/* binding */ File),
/* harmony export */   "Flickable": () => (/* binding */ Flickable),
/* harmony export */   "Flow": () => (/* binding */ Flow),
/* harmony export */   "Font": () => (/* binding */ Font),
/* harmony export */   "FrameAnimation": () => (/* binding */ FrameAnimation),
/* harmony export */   "GameApp": () => (/* binding */ GameApp),
/* harmony export */   "Gamepad": () => (/* binding */ PhinaGamepad),
/* harmony export */   "GamepadManager": () => (/* binding */ GamepadManager),
/* harmony export */   "Gauge": () => (/* binding */ Gauge),
/* harmony export */   "Grid": () => (/* binding */ Grid),
/* harmony export */   "HeartShape": () => (/* binding */ HeartShape),
/* harmony export */   "Input": () => (/* binding */ Input),
/* harmony export */   "Interactive": () => (/* binding */ Interactive),
/* harmony export */   "Keyboard": () => (/* binding */ Keyboard),
/* harmony export */   "Label": () => (/* binding */ Label),
/* harmony export */   "LabelArea": () => (/* binding */ LabelArea),
/* harmony export */   "Layer": () => (/* binding */ Layer),
/* harmony export */   "LoadingScene": () => (/* binding */ LoadingScene),
/* harmony export */   "ManagerScene": () => (/* binding */ ManagerScene),
/* harmony export */   "MathEx": () => (/* binding */ mathExtensions),
/* harmony export */   "Matrix33": () => (/* binding */ Matrix33),
/* harmony export */   "Mouse": () => (/* binding */ Mouse),
/* harmony export */   "NumberEx": () => (/* binding */ numberExtensions),
/* harmony export */   "Object2D": () => (/* binding */ Object2D),
/* harmony export */   "ObjectEx": () => (/* binding */ objectExtensions),
/* harmony export */   "PathShape": () => (/* binding */ PathShape),
/* harmony export */   "PauseScene": () => (/* binding */ PauseScene),
/* harmony export */   "Physical": () => (/* binding */ Physical),
/* harmony export */   "PlainElement": () => (/* binding */ PlainElement),
/* harmony export */   "PolygonShape": () => (/* binding */ PolygonShape),
/* harmony export */   "QueryString": () => (/* binding */ QueryString),
/* harmony export */   "Random": () => (/* binding */ Random),
/* harmony export */   "Rect": () => (/* binding */ Rect),
/* harmony export */   "RectangleShape": () => (/* binding */ RectangleShape),
/* harmony export */   "ResultScene": () => (/* binding */ ResultScene),
/* harmony export */   "Scene": () => (/* binding */ Scene),
/* harmony export */   "Script": () => (/* binding */ Script),
/* harmony export */   "Shape": () => (/* binding */ Shape),
/* harmony export */   "Sound": () => (/* binding */ Sound),
/* harmony export */   "SoundManager": () => (/* binding */ SoundManager),
/* harmony export */   "SplashScene": () => (/* binding */ SplashScene),
/* harmony export */   "Sprite": () => (/* binding */ Sprite),
/* harmony export */   "SpriteSheet": () => (/* binding */ SpriteSheet),
/* harmony export */   "StarShape": () => (/* binding */ StarShape),
/* harmony export */   "StringEx": () => (/* binding */ stringExtensions),
/* harmony export */   "Support": () => (/* binding */ Support),
/* harmony export */   "Texture": () => (/* binding */ Texture),
/* harmony export */   "ThreeLayer": () => (/* binding */ ThreeLayer),
/* harmony export */   "Ticker": () => (/* binding */ Ticker),
/* harmony export */   "TitleScene": () => (/* binding */ TitleScene),
/* harmony export */   "Touch": () => (/* binding */ Touch$1),
/* harmony export */   "TouchList": () => (/* binding */ TouchList),
/* harmony export */   "TriangleShape": () => (/* binding */ TriangleShape),
/* harmony export */   "Tween": () => (/* binding */ Tween),
/* harmony export */   "Tweener": () => (/* binding */ Tweener),
/* harmony export */   "Twitter": () => (/* binding */ Twitter),
/* harmony export */   "Updater": () => (/* binding */ Updater),
/* harmony export */   "Vector2": () => (/* binding */ Vector2),
/* harmony export */   "Vector3": () => (/* binding */ Vector3),
/* harmony export */   "Wave": () => (/* binding */ Wave),
/* harmony export */   "dateEx": () => (/* binding */ dateExtensions),
/* harmony export */   "dateExStatic": () => (/* binding */ dateStaticExtensions),
/* harmony export */   "extendBuiltInObject": () => (/* binding */ extendBuiltInObject),
/* harmony export */   "extendEventObject": () => (/* binding */ extendEventObject),
/* harmony export */   "phina": () => (/* binding */ phina)
/* harmony export */ });
/*!
 * phina.js v0.2.3
 * Released under the MIT license
 *
 * Copyright (C) phi
 */
/**
 * @class global.String
 * # 拡張した String クラス
 */

/**
 * @method format
 * フォーマットに引数を適用した文字列を返します。
 *
 * 引数がオブジェクトの場合、"{プロパティ名}" がオブジェクトのプロパティの値に置き換わります。
 * 指定したプロパティがオブジェクトにない場合は空文字列になります。
 *
 * 第1引数がオブジェクトでなかった場合、"{整数}" が各引数に置き換わります。
 * 指定した値の引数がなかった場合は空文字列になります。
 *
 * ### Example
 *     obj = {r: 128, g: 0, b: 255};
 *     "color: rgb({r}, {g}, {b});".format(obj); // => "color: rgb(128, 0, 255);"
 *
 *     "{0} + {1} = {2}".format(5, 8, (5+8)); // => "5 + 8 = 13"
 *
 * @this String
 * @param {Object} arg パラメータとなるオブジェクト
 * @return {String} 生成した文字列
 */
function format(arg) {
// String.prototype.$method("format", function(arg) {
  // 置換ファンク
  var rep_fn = undefined;
  
  // オブジェクトの場合
  if (typeof arg == "object") {
    /** @ignore */
    rep_fn = function(m, k) {
      if (arg[k] === undefined) {
        return '';
      }
      else {
        return arg[k];
      }
    };
  }
  // 複数引数だった場合
  else {
    var args = arguments;
    /** @ignore */
    rep_fn = function(m, k) {
      var v = args[ parseInt(k) ];
      if (v !== undefined && v !== null) {
        return v;
      }
      else {
        return '';
      }
    };
  }
  
  return this.replace( /\{(\w+)\}/g, rep_fn );
}


/**
 * @method each
 * 各文字を順番に渡しながら関数を繰り返し実行します。
 *
 * ### Example
 *     str = 'abc';
 *     str.each(function(ch) {
 *       console.log(ch);
 *     });
 *     // => 'a'
 *     //    'b'
 *     //    'c'
 *
 * @this String
 * @param {Function} _callback 各要素に対して実行するコールバック関数
 * @param {Object} [_self=this] callback 内で this として参照される値
 */
function each(_callback, _self) {
// String.prototype.$method("each", function() {
  Array.prototype.forEach.apply(this, arguments);
  return this;
}

// ==========
// 以下ライブラリ内では未使用
// ==========

/**
 * @method trim
 * 文字列先頭と末尾の空白文字を全て取り除いた文字列を返します。
 *
 * ###Reference
 * - [String Functions for Javascript – trim, to camel case, to dashed, and to underscore](http://jamesroberts.name/blog/2010/02/22/string-functions-for-javascript-trim-to-camel-case-to-dashed-and-to-underscore/)
 *
 * ### Example
 *     "  Hello, world!  ".trim(); // => "Hello, world!"
 * 
 * @this String
 * @return {String} トリムした結果の文字列
 */
function trim() {
// String.prototype.$method("trim", function() {
  return this.replace(/^\s+|\s+$/g, "");
}

/**
 * @method capitalize
 * キャピタライズした文字列、すなわち、すべての単語の先頭を大文字にした文字列を返します。
 *
 * 単語の先頭以外は小文字化されます。
 *
 * ###Reference
 * - [キャピタライズ(単語の先頭の大文字化)を行う - oct inaodu](http://d.hatena.ne.jp/brazil/20051212/1134369083)  
 * - [デザインとプログラムの狭間で: javascriptでキャピタライズ（一文字目を大文字にする）](http://design-program.blogspot.com/2011/02/javascript.html)
 *
 * ### Example
 *     "i aM a pen.".capitalize(); // => "I Am A Pen."
 *
 * @this String
 * @return {String} キャピタライズした文字列
 */
function capitalize() {
// String.prototype.$method("capitalize", function() {
  return this.replace(/\w+/g, function(word){
    return capitalizeFirstLetter.call(word);
    // return word.capitalizeFirstLetter();
  });
}

/**
 * @method capitalizeFirstLetter
 * 先頭の文字を大文字にして、それ以外を小文字にした文字列を返します。
 *
 * ### Example
 *     "i aM a pen.".capitalizeFirstLetter(); // "I am a pen."
 *
 * @this String
 * @return {String} 先頭の文字を大文字にして、それ以外を小文字にした文字列
 */
function capitalizeFirstLetter() {
// String.prototype.$method("capitalizeFirstLetter", function() {
  return this.charAt(0).toUpperCase() + this.substr(1).toLowerCase();
}

/**
 * @method toDash
 * 文字列内の大文字を「"-" + 小文字」に変換します。
 *
 * css2properties（element.style）の各プロパティ名を CSS のプロパティ名に変換する場合に便利です。
 *
 * ### Example
 *     "borderTopColor".toDash(); // => "border-top-color"
 *
 * @this String
 * @return {String} 変換後の文字列
 */
function toDash() {
// String.prototype.$method("toDash", function() {
  return this.replace(/([A-Z])/g, function(m){ return '-'+m.toLowerCase(); });
}


/**
 * @method toHash
 * ハッシュ値を生成して返します。
 *
 * ### Example
 *     "phina.js".toHash(); // => 2676327394
 *
 * @this String
 * @return {Number} CRC32ハッシュ値
 */
function toHash() {
// String.prototype.$method("toHash", function() {
  return toCRC32.call(this);
  // return this.toCRC32();
}


/**
 * @method padding
 * 左に文字を埋めて指定した桁にします。this の文字列は右寄せされます。
 *
 * ### Example
 *     "1234".padding(10);      // => "      1234"
 *     "1234".padding(10, '0'); // => "0000001234"
 *
 * @this String
 * @param {Number} n 桁数
 * @param {String} [ch=" "] 埋める文字
 * @return {String} 指定した桁の文字列
 */
function padding(n, ch) {
// String.prototype.$method("padding", function(n, ch) {
  var str = this.toString();
  n  = n-str.length;
  ch = (ch || ' ')[0];
  
  while(n-- > 0) { str = ch + str; }
  
  return str;
}
/**
 * @method paddingLeft
 * 左に文字を埋めて指定した桁にします。this の文字列を右寄せされます。
 *
 * @this String
 * {@link #padding} と同じです。
 * @inheritdoc #padding
 */
function paddingLeft(n, ch) {
// String.prototype.$method("paddingLeft", function(n, ch) {
  var str = this.toString();
  n  = n-str.length;
  ch = (ch || ' ')[0];
  
  while(n-- > 0) { str = ch + str; }
  
  return str;
}

/**
 * @method paddingRight
 * 右に文字を埋めて指定した桁にします。this の文字列は左寄せされます。
 *
 * ### Example
 *     "1234".paddingRight(10);      // => "1234      "
 *     "1234".paddingRight(10, '0'); // => "1234000000"
 *
 * @this String
 * @param {Number} n 桁数
 * @param {String} [ch=" "] 埋める文字
 * @return {String} 指定した桁の文字列
 */
function paddingRight(n, ch) {
// String.prototype.$method("paddingRight", function(n, ch) {
  var str = this.toString();
  n  = n-str.length;
  ch = (ch || ' ')[0];
  
  while(n-- > 0) { str = str + ch; }
  
  return str;
}
  
/**
 * @method quotemeta
 * 正規表現のメタ文字をクォートします。
 *
 * ### Example
 *     "Hello world. (can you hear me?)".quotemeta(); // => "Hello\\ world\\.\\ \\(can\\ you\\ hear\\ me\\?\\)"
 *
 * @this String
 * @return {String} クォートされた文字列
 */
function quotemeta(n) {
// String.prototype.$method("quotemeta", function(n) {
  return this.replace(/([^0-9A-Za-z_])/g, '\\$1');
}
  
/**
 * @method repeat
 * 自分自身を指定した回数だけ繰り返した文字列を返します。
 *
 * ### Example
 *     "Abc".repeat(4); // => "AbcAbcAbcAbc"
 *
 * @this String
 * @param {Number} n 繰り返し回数
 * @return {String} 文字列
 */
function repeat(n) {
// String.prototype.$method("repeat", function(n) {
  // TODO: 確認する
  var arr = Array(n);
  for (var i=0; i<n; ++i) arr[i] = this;
  return arr.join('');
}

/**
 * @method count
 * 指定した文字列が何個入っているかをカウントして返します。
 *
 * 大文字・小文字は区別されます。
 *
 * ### Example
 *     "This is a string. Isn't it?".count("is"); // => 2
 *
 * @this String
 * @param {String} str 調べる文字列
 * @return {Number} this に str が入っている個数
 */
function count(str) {
// String.prototype.$method("count", function(str) {
  var re = new RegExp(str, 'gm');
  return this.match(re).length;
}

/**
 * @method include
 * 指定した文字列が含まれているかどうかを返します。
 *
 * 大文字・小文字は区別されます。
 *
 * ### Example
 *     "This is a string.".include("is"); // => true
 *     "This is a string.".include("was"); // => false
 *
 * @this String
 * @param {String} str 調べる文字列
 * @return {Boolean} 含まれているかどうか
 */
function include(str) {
// String.prototype.$method("include", function(str) {
  return this.indexOf(str) != -1;
}

/**
 * @method toArray
 * 1文字ずつ分解した配列を返します。
 *
 * ### Example
 *     "12345".toArray(); // => ["1", "2", "3", "4", "5"]
 *     "あいうえお".toArray(); // => "あ", "い", "う", "え", "お"]
 *
 * @this String
 * @return {String[]} 配列
 */
function toArray() {
// String.prototype.$method("toArray", function() {
  var arr = [];
  for (var i=0,len=this.length; i<len; ++i) {
    arr.push(this[i]);
  }
  return arr;
}

/**
 * @method toObject
 * キーと値の組み合わせが連結された文字列からオブジェクトを生成します。
 *
 * 値は Number、Boolean、String のいずれかの型として評価されます。
 *
 * ### Example
 *     obj1 = "num=128.5&flag1=true&flag2=false&str=hoge";
 *     obj1.toObject(); // => {num: 128.5, flag1: true, flag2: false, str: "hoge" }
 *     
 *     obj2 = "num:-64.5|flag1:false|flag2:true|str:foo";
 *     obj2.toObject('|', ':'); // => {num: -64.5, flag1: false, flag2: true, str: "foo" }
 *
 * @this String
 * @param {String} [sep="&"] セパレータ文字
 * @param {String} [eq=""] キーと値の組み合わせを表す文字
 * @return {Object} オブジェクト
 */
function toObject(sep, eq) {
// String.prototype.$method("toObject", function(sep, eq) {
  sep = sep || '&';
  eq  = eq || '=';

  var obj = {};
  var params = this.split(sep);
  params.forEach(function(str, i) {
  // params.each(function(str, i) {
    var pos = str.indexOf(eq);
    if (pos > 0) {
      var key = str.substring(0, pos);
      /** @type string|number|boolean */
      var val = str.substring(pos+1);
      var num = Number(val);

      if (!isNaN(num)) {
        val = num;
      }
      else if (val === 'true') {
        val = true;
      }
      else if (val === 'false') {
        val = false;
      }

      obj[key] = val;
    }
  });

  return obj;
}


var table = "00000000 77073096 EE0E612C 990951BA 076DC419 706AF48F E963A535 9E6495A3 0EDB8832 79DCB8A4 E0D5E91E 97D2D988 09B64C2B 7EB17CBD E7B82D07 90BF1D91 1DB71064 6AB020F2 F3B97148 84BE41DE 1ADAD47D 6DDDE4EB F4D4B551 83D385C7 136C9856 646BA8C0 FD62F97A 8A65C9EC 14015C4F 63066CD9 FA0F3D63 8D080DF5 3B6E20C8 4C69105E D56041E4 A2677172 3C03E4D1 4B04D447 D20D85FD A50AB56B 35B5A8FA 42B2986C DBBBC9D6 ACBCF940 32D86CE3 45DF5C75 DCD60DCF ABD13D59 26D930AC 51DE003A C8D75180 BFD06116 21B4F4B5 56B3C423 CFBA9599 B8BDA50F 2802B89E 5F058808 C60CD9B2 B10BE924 2F6F7C87 58684C11 C1611DAB B6662D3D 76DC4190 01DB7106 98D220BC EFD5102A 71B18589 06B6B51F 9FBFE4A5 E8B8D433 7807C9A2 0F00F934 9609A88E E10E9818 7F6A0DBB 086D3D2D 91646C97 E6635C01 6B6B51F4 1C6C6162 856530D8 F262004E 6C0695ED 1B01A57B 8208F4C1 F50FC457 65B0D9C6 12B7E950 8BBEB8EA FCB9887C 62DD1DDF 15DA2D49 8CD37CF3 FBD44C65 4DB26158 3AB551CE A3BC0074 D4BB30E2 4ADFA541 3DD895D7 A4D1C46D D3D6F4FB 4369E96A 346ED9FC AD678846 DA60B8D0 44042D73 33031DE5 AA0A4C5F DD0D7CC9 5005713C 270241AA BE0B1010 C90C2086 5768B525 206F85B3 B966D409 CE61E49F 5EDEF90E 29D9C998 B0D09822 C7D7A8B4 59B33D17 2EB40D81 B7BD5C3B C0BA6CAD EDB88320 9ABFB3B6 03B6E20C 74B1D29A EAD54739 9DD277AF 04DB2615 73DC1683 E3630B12 94643B84 0D6D6A3E 7A6A5AA8 E40ECF0B 9309FF9D 0A00AE27 7D079EB1 F00F9344 8708A3D2 1E01F268 6906C2FE F762575D 806567CB 196C3671 6E6B06E7 FED41B76 89D32BE0 10DA7A5A 67DD4ACC F9B9DF6F 8EBEEFF9 17B7BE43 60B08ED5 D6D6A3E8 A1D1937E 38D8C2C4 4FDFF252 D1BB67F1 A6BC5767 3FB506DD 48B2364B D80D2BDA AF0A1B4C 36034AF6 41047A60 DF60EFC3 A867DF55 316E8EEF 4669BE79 CB61B38C BC66831A 256FD2A0 5268E236 CC0C7795 BB0B4703 220216B9 5505262F C5BA3BBE B2BD0B28 2BB45A92 5CB36A04 C2D7FFA7 B5D0CF31 2CD99E8B 5BDEAE1D 9B64C2B0 EC63F226 756AA39C 026D930A 9C0906A9 EB0E363F 72076785 05005713 95BF4A82 E2B87A14 7BB12BAE 0CB61B38 92D28E9B E5D5BE0D 7CDCEFB7 0BDBDF21 86D3D2D4 F1D4E242 68DDB3F8 1FDA836E 81BE16CD F6B9265B 6FB077E1 18B74777 88085AE6 FF0F6A70 66063BCA 11010B5C 8F659EFF F862AE69 616BFFD3 166CCF45 A00AE278 D70DD2EE 4E048354 3903B3C2 A7672661 D06016F7 4969474D 3E6E77DB AED16A4A D9D65ADC 40DF0B66 37D83BF0 A9BCAE53 DEBB9EC5 47B2CF7F 30B5FFE9 BDBDF21C CABAC28A 53B39330 24B4A3A6 BAD03605 CDD70693 54DE5729 23D967BF B3667A2E C4614AB8 5D681B02 2A6F2B94 B40BBE37 C30C8EA1 5A05DF1B 2D02EF8D".split(' ');

/**
 * @method toCRC32
 * 文字列の CRC32 を計算します。
 *
 * ### Example
 *     "phina.js".toCRC32(); // => 2676327394
 *
 * @this String
 * @return {Number} CRC32 ハッシュ値
 */
function toCRC32() {
// String.prototype.$method("toCRC32", function() {
  var crc = 0, x=0, y=0;
  
  crc = crc ^ (-1);
  for (var i=0, iTop=this.length; i<iTop; ++i) {
    y = (crc ^ this.charCodeAt(i)) & 0xff;
    x = Number("0x" + table[y]);
    crc = (crc >>> 8) ^ x;
  }
  
  return (crc ^ (-1)) >>> 0;
}

var stringExtensions = /*#__PURE__*/Object.freeze({
  __proto__: null,
  format: format,
  each: each,
  trim: trim,
  capitalize: capitalize,
  capitalizeFirstLetter: capitalizeFirstLetter,
  toDash: toDash,
  toHash: toHash,
  padding: padding,
  paddingLeft: paddingLeft,
  paddingRight: paddingRight,
  quotemeta: quotemeta,
  repeat: repeat,
  count: count,
  include: include,
  toArray: toArray,
  toObject: toObject,
  toCRC32: toCRC32
});

/**
 * @class global.Object
 * Objectの拡張
 */

/**
 * 関数を追加
 * 
 * @param   {String} name name
 * @param   {Function} fn
 */
function $method(name, fn) {
  Object.defineProperty(this, name, {
    value: fn,
    enumerable: false,
    writable: true
  });
}

/**
 * @method setter
 * セッターを定義する
 * 
 * @param {string | number | symbol} name
 * @param {any} fn
 */
// Object.prototype.$method("setter", function(name, fn){
function setter(name, fn) {
  Object.defineProperty(this, name, {
    set: fn,
    enumerable: false,
    configurable: true,
  });
}

/**
 * @method getter
 * ゲッターを定義する
 * 
 * @this {Object}
 * @param {string | number | symbol} name
 * @param {any} fn
 */
// Object.prototype.$method("getter", function(name, fn){
function getter(name, fn) {
  Object.defineProperty(this, name, {
    get: fn,
    enumerable: false,
    configurable: true,
  });
}

/**
 * @method accessor
 * アクセッサ(セッター/ゲッター)を定義する
 * 
 * @this Object
 * @param {string | number | symbol} name
 * @param {import('../phina').AccessorExtendObject} param
 */
// Object.prototype.$method("accessor", function(name, param) {
function accessor(name, param) {
  Object.defineProperty(this, name, {
    set: param["set"],
    get: param["get"],
    enumerable: false,
    configurable: true,
  });
}

/**
 * @method forIn
 * オブジェクト用ループ処理
 * 
 * @param {Function} fn
 * @param {any} self
 */
function forIn(fn, self) {
  self = self || this;

  Object.keys(this).forEach(function(key, index) {
    var value = this[key];

    fn.call(self, key, value, index);
  }, this);

  return this;
}

/**
 * @method  $extend
 * 他のライブラリと競合しちゃうので extend -> $extend としました
 */
function $extend() {
// Object.prototype.$method("$extend", function() {
  Array.prototype.forEach.call(arguments, function(source) {
    for (var property in source) {
      this[property] = source[property];
    }
  }, this);
  return this;
}

/**
 * @method  $safe
 * 安全拡張
 * 上書きしない
 */
function $safe(source) {
// Object.prototype.$method("$safe", function(source) {
  Array.prototype.forEach.call(arguments, function(source) {
    for (var property in source) {
      if (this[property] === undefined) this[property] = source[property];
    }
  }, this);
  return this;
}

/**
 * @method $watch
 * 
 * @param  {string} key       [description]
 * @param  {function} callback  [description]
 * @return {void}           [description]
 */
function $watch(key, callback) {
// Object.prototype.$method('$watch', function(key, callback) {
  var target = this;
  var descriptor = null;

  while(target) {
    descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor) {
      break;
    }
    target = Object.getPrototypeOf(target);
  }

  // すでにアクセッサーとして存在する場合
  if (descriptor) {
    // データディスクリプタの場合
    if (descriptor.value !== undefined) {
      var tempKey = '__' + key;
      var tempValue = this[key];

      this[tempKey] = tempValue;

      accessor.call(this, key, {
      // this.accessor(key, {
        get: function() {
          return this[tempKey];
        },
        set: function(v) {
          var old = this[tempKey];
          this[tempKey] = v;
          callback.call(this, v, old);
        },
      });
    }
    // アクセサディスクリプタの場合
    else {
      accessor.call(this, key, {
      // this.accessor(key, {
        get: function() {
          return descriptor.get.call(this);
        },
        set: function(v) {
          var old = descriptor.get.call(this);
          descriptor.set.call(this, v);
          callback.call(this, v, old);
        },
      });
    }
  }
  else {
    var accesskey = '__' + key;

    accessor.call(this, key, {
    // this.accessor(key, {
      get: function() {
        return this[accesskey];
      },
      set: function(v) {
        var old = this[accesskey];
        this[accesskey] = v;
        callback.call(this, v, old);
      },
    });
  }
}

// ==========
// 以下ライブラリ内では未使用
// ==========

/**
 * @method property
 * 変数を追加
 * 
 * @param   {String} name name
 * @param   {Object} val
 */
function property(name, val) {
  Object.defineProperty(this, name, {
    value: val,
    enumerable: true,
    writable: true
  });
}

/**
 * @method $get
 * パス指定で値を取得
 * 
 * @param {string} key
 */
function $get(key) {
// Object.prototype.$method('$get', function(key) {
  return key.split('.').reduce(function(t, v) {
    return t && t[v];
  }, this);
}

/**
 * @method $set
 * パス指定で値を設定
 * 
 * @param {string} key
 * @param {any} value
 */
function $set(key, value) {
// Object.prototype.$method('$set', function(key, value) {
  key.split('.').reduce(function(t, v, i, arr) {
    if (i === (arr.length-1)) {
      t[v] = value;
    }
    else {
      if (!t[v]) t[v] = {};
      return t[v];
    }
  }, this);
}

/**
 * @method $has
 * そのプロパティを持っているかを判定する
 * 
 * @param {any} key
 */
function $has(key) {
// Object.prototype.$method("$has", function(key) {
  return this.hasOwnProperty(key);
}

/**
 * @method  $strict
 * 厳格拡張
 * すでにあった場合は警告
 */
function $strict(source) {
// Object.prototype.$method("$strict", function(source) {
  Array.prototype.forEach.call(arguments, function(source) {
    for (var property in source) {
      console.assert(!this[property], format.call("tm error: {0} is Already", property));
      // console.assert(!this[property], "tm error: {0} is Already".format(property));
      this[property] = source[property];
    }
  }, this);
  return this;
}

/**
 * @method  $pick
 * ピック
 */
function $pick() {
// Object.prototype.$method("$pick", function() {
  var temp = {};

  Array.prototype.forEach.call(arguments, function(key) {
    if (key in this) temp[key] = this[key];
  }, this);

  return temp;
}

/**
 * @method  $omit
 * オミット
 */
function $omit() {
// Object.prototype.$method("$omit", function() {
  var temp = {};

  for (var key in this) {
    if (Array.prototype.indexOf.call(arguments, key) == -1) {
      temp[key] = this[key];
    }
  }

  return temp;
}

/**
 * @method  $toArray
 * 配列化
 */
function $toArray() {
// Object.prototype.$method("$toArray", function() {
  return Array.prototype.slice.call(this);
}

/**
 * [observe description]
 * @param  {any}   obj      [description]
 * @param  {Function} callback [description]
 * @return {void}            [description]
 */
function observe(obj, callback) {
// Object.$method('observe', function(obj, callback) {
  if (Object['observe']) return Object['observe'].call(obj, callback); // add
  var keys = Object.keys(obj);
  keys.forEach(function(key) {
    var tempKey = '__' + key;
    var tempValue = obj[key];
    obj[tempKey] = tempValue;
    
    accessor.call(obj, key, {
    // obj.accessor(key, {
      get: function() {
        return this[tempKey];
      },
      set: function(v) {
        this[tempKey] = v;
        callback();
      },
    });
  });
}

/**
 * [unobserve description]
 * @param  {any}   obj      [description]
 * @param  {Function} callback [description]
 * @return {void}            [description]
 */
function unobserve(obj, callback) {
// Object.$method('unobserve', function(obj, callback) {
  if (Object['unobserve']) return Object['unobserve'].call(obj, callback); // add
  console.assert(false);
}

var objectExtensions = /*#__PURE__*/Object.freeze({
  __proto__: null,
  $method: $method,
  setter: setter,
  getter: getter,
  accessor: accessor,
  forIn: forIn,
  $extend: $extend,
  $safe: $safe,
  $watch: $watch,
  property: property,
  $get: $get,
  $set: $set,
  $has: $has,
  $strict: $strict,
  $pick: $pick,
  $omit: $omit,
  $toArray: $toArray,
  observe: observe,
  unobserve: unobserve
});

/**
 * @class global.Math
 * # 拡張した Math クラス
 * 数学的な処理を扱う Math クラスを拡張しています。
 * 
 * 全てstaticメンバーです。
 */

/**
 * @static
 * @method clamp
 * 指定した値を指定した範囲に収めた結果を返します。
 *
 * ### Example
 *     Math.clamp(120, 0, 640); // => 120
 *     Math.clamp(980, 0, 640); // => 640
 *     Math.clamp(-80, 0, 640); // => 0
 *
 * @param {Number} value 値
 * @param {Number} min  範囲の下限
 * @param {Number} max  範囲の上限
 * @return {Number} 丸めた結果の値
 */
function clamp(value, min, max) {
  return (value < min) ? min : ( (value > max) ? max : value );
}

/**
 * @property DEG_TO_RAD
 * 度をラジアンに変換するための定数です。
 */
var DEG_TO_RAD = Math.PI/180;

/**
 * @property RAD_TO_DEG
 * ラジアンを度に変換するための定数です。
 */
var RAD_TO_DEG = 180/Math.PI;


// ==========
// 以下ライブラリ内では未使用
// ==========

/**
 * @property PHI
 * 黄金比です。
 */
var PHI = (1 + Math.sqrt(5)) / 2;

/**
 * @static
 * @method degToRad
 * 度をラジアンに変換します。
 *
 * ### Example
 *     Math.degToRad(180); // => 3.141592653589793
 *
 * @param {Number} deg 度
 * @return {Number} ラジアン
 */
function degToRad(deg) {
// Math.degToRad = function(deg) {
  return deg * DEG_TO_RAD;
}

/**
 * @static
 * @method radToDeg
 * ラジアンを度に変換します。
 *
 * ### Example
 *     Math.radToDeg(Math.PI/4); // => 45
 *
 * @param {Number} rad ラジアン
 * @return {Number} 度
 */
function radToDeg(rad) {
// Math.radToDeg = function(rad) {
  return rad * RAD_TO_DEG;
}

/**
 * @static
 * @method inside
 * 指定した値が指定した値の範囲にあるかどうかを返します。
 *
 * ### Example
 *     Math.inside(980, 0, 640); // => false
 *     Math.inside(120, 0, 640); // => true
 *
 * @param {Number} value チェックする値
 * @param {Number} min  範囲の下限
 * @param {Number} max  範囲の上限
 * @return {Boolean} 範囲内に値があるかないか
 */
function inside(value, min, max) {
// Math.$method("inside", function(value, min, max) {
  return (value >= min) && (value) <= max;
}

/**
 * @static
 * @method randint
 * 指定された範囲内でランダムな整数値を生成します。
 *
 * ### Example
 *     Math.randint(-4, 4); // => -4、0、3、4 など
 *
 * @param {Number} min  範囲の最小値
 * @param {Number} max  範囲の最大値
 * @return {Number} ランダムな整数値
 */
function randint(min, max) {
// Math.$method("randint", function(min, max) {
  return Math.floor( Math.random()*(max-min+1) ) + min;
}

/**
 * @static
 * @method randfloat
 * 指定された範囲内でランダムな数値を生成します。
 *
 * ### Example
 *     Math.randfloat(-4, 4); // => -2.7489193824000937 など
 *
 * @param {Number} min  範囲の最小値
 * @param {Number} max  範囲の最大値
 * @return {Number} ランダムな数値
 */
function randfloat(min, max) {
// Math.$method("randfloat", function(min, max) {
  return Math.random()*(max-min)+min;
}

/**
 * @static
 * @method randbool
 * ランダムに真偽値を生成します。
 * 引数で百分率を指定する事もできます。
 *
 * ### Example
 *     Math.randbool();   // => true または false
 *     Math.randbool(80); // => 80% の確率で true
 *
 * @param {Number} percent  真になる百分率
 * @return {Boolean} ランダムな真偽値
 */
function randbool(percent) {
// Math.$method("randbool", function(percent) {
  return Math.random() < (percent === undefined ? 50 : percent) / 100;
}

var mathExtensions = /*#__PURE__*/Object.freeze({
  __proto__: null,
  clamp: clamp,
  DEG_TO_RAD: DEG_TO_RAD,
  RAD_TO_DEG: RAD_TO_DEG,
  PHI: PHI,
  degToRad: degToRad,
  radToDeg: radToDeg,
  inside: inside,
  randint: randint,
  randfloat: randfloat,
  randbool: randbool
});

/*
 * array.js
 */

/**
 * @type {import('../phina').AccessorExtendObject} first
 * 最初の要素を返す、もしくはそこにセットする
 *
 * ### Example
 *     arr = [6, 5, 2, 3, 1, 4];
 *     arr.first; // => 6
 */
const first = {
// Array.prototype.accessor("first", {
  /** @this Array */
  "get": function()   { return this[0]; },
  /** @this Array */
  "set": function(v)  { this[0] = v; }
};

/**
 * @type {import('../phina').AccessorExtendObject} last
 * 最後の要素を返す、もしくはそこにセットする
 *
 * ### Example
 *     arr = [6, 5, 2, 3, 1, 4];
 *     arr.last; // => 4
 */
const last = {
// Array.prototype.accessor("last", {
  /** @this Array */
  "get": function()   { return this[this.length-1]; },
  /** @this Array */
  "set": function(v)  { this[this.length-1] = v; }
};


/**
 * @method at
 * 指定したインデックスの要素を返します（ループ・負数の指定可）。
 *
 * 添字が負数の場合は末尾からのオフセットとみなします。末尾の要素が -1 番目になります。  
 * 添字の絶対値が Array.length 以上の場合はループします。
 *
 * ### Example
 *     arr = ['a', 'b', 'c', 'd', 'e', 'f'];
 *     arr.at(0);  // => 'a'
 *     arr.at(6);  // => 'a'
 *     arr.at(13); // => 'b'
 *     arr.at(-1); // => 'f'
 *     arr.at(-8); // => 'e'
 *
 * @this Array
 * @param {Number} i 添字
 * @return {Object} 添字で指定された要素
 */
function at(i) {
// Array.prototype.$method("at", function(i) {
  i%=this.length;
  i+=this.length;
  i%=this.length;
  return this[i];
}

/**
 * @method erase
 * @chainable
 * 指定したオブジェクトと一致した最初の要素を削除します。
 *
 * ### Example
 *     arr1 = ['a', 'b', 'b', 'c'];
 *     arr2 = arr1.erase('b'); // => ['a', 'b', 'c']
 *     arr1 === arr2;          // => true
 *
 * @this Array
 * @param {Object} elm 削除したいオブジェクト
 */
function erase(elm) {
// Array.prototype.$method("erase", function(elm) {
  var index  = this.indexOf(elm);
  if (index >= 0) {
    this.splice(index, 1);
  }
  return this;
}


/**
 * @method clear
 * @chainable
 * 自身を空の配列にします。
 *
 * ### Example
 *     arr = [1, 2, [3, 4]];
 *     arr.clear(); // => []
 * 
 * @this Array
 */
function clear(deep) {
// Array.prototype.$method("clear", function() {
  this.length = 0;
  return this;
}

/**
 * @method contains
 * 指定した要素が配列に含まれているかをチェックします。
 *
 * 比較には厳密な同値（三重イコール演算子 === で使われるのと同じ方法）を用います。
 *
 * ### Example
 *     arr = [6, 5, 2, 3, 1, 4];
 *     arr.contains(3);     // => true
 *     arr.contains(3, 4);  // => false
 *     arr.contains(3, -4); // => true
 *     arr.contains("6");   // => false
 *
 * @this Array
 * @param {Object} item チェックするオブジェクト
 * @param {Number} [fromIndex=0] 検索を始める位置。負数を指定した場合は末尾からのオフセットと見なします。
 * @return {Boolean} チェックの結果
 */
function contains(item, fromIndex) {
// Array.prototype.$method("contains", function(item, fromIndex) {
  return this.indexOf(item, fromIndex) != -1;
}

/**
 * @method clone
 * 自身のコピーを生成して返します。
 *
 * ### Example
 *     arr1 = [1, 2, [3, 4]];
 *     arr2 = arr1.clone();      // => [1, 2, [3, 4]]
 *     arr1[2] === arr2[2];      // => true
 *     arr1[2][0] = 9;
 *     arr2;                     // => [1, 2, [9, 4]]
 *     arr1 = [1, 2, [3, 4]];
 *     arr2 = arr1.clone(true);  // => [1, 2, [3, 4]]
 *     arr1[2] === arr2[2];      // => false
 *     arr1[2][0] = 9;
 *     arr2;                     // => [1, 2, [3, 4]]
 *
 * @this Array
 * @param {Boolean} [deep=false] 配列のネストをたどって複製するかどうか
 * @return {Array} 新しい配列
 */
function clone(deep) {
// Array.prototype.$method("clone", function(deep) {
  if (deep === true) ;
  else {
    return Array.prototype.slice.apply(this);
  }
}

/**
 * @method range
 * @chainable
 * 自身を等差数列（一定間隔の整数値の列）とします。
 *
 * - 引数が1つの場合、0～end（end含まず）の整数の配列です。  
 * - 引数が2つの場合、start～end（end含まず）の整数の配列です。  
 * - 引数が3つの場合、start～end（end含まず）かつ start + n * step (nは整数)を満たす整数の配列です。
 *
 * ### Example
 *     arr = [];
 *     arr.range(4);        // => [0, 1, 2, 3]
 *     arr.range(2, 5);     // => [2, 3, 4]
 *     arr.range(2, 14, 5); // => [2, 7, 12]
 *     arr.range(2, -3);    // => [2, 1, 0, -1, -2]
 *
 * @this Array
 * @param {Number} start 最初の値（デフォルトは 0）
 * @param {Number} end 最後の値（省略不可）
 * @param {Number} [step] 間隔。デフォルト値は1または-1
 */
function range(start, end, step) {
// Array.prototype.$method("range", function(start, end, step) {
  clear.call(this);
  // this.clear();
  
  if (arguments.length == 1) {
    for (var i=0; i<start; ++i) this[i] = i;
  }
  else if (start < end) {
    step = step || 1;
    if (step > 0) {
      for (var i=start, index=0; i<end; i+=step, ++index) {
        this[index] = i;
      }
    }
  }
  else {
    step = step || -1;
    if (step < 0) {
      for (var i=start, index=0; i>end; i+=step, ++index) {
        this[index] = i;
      }
    }
  }
  
  return this;
}


// ==========
// 以下ライブラリ内では未使用
// ==========


/**
 * @method equals
 * 渡された配列と等しいかどうかをチェックします。
 *
 * 要素同士を === で比較します。要素に配列が含まれている場合は {@link #deepEquals} を使用してください。
 *
 * ### Example
 *     arr1 = [6, 5, 2, 3, 1, 4];
 *     arr1.equals([6, 5, 2, 3, 1, 4]);       // => true
 *     arr2 = [6, 5, 2, [3, 1], 4];
 *     arr2.equals([6, 5, 2, [3, 1], 4]);     // => false
 *     arr2.deepEquals([6, 5, 2, [3, 1], 4]); // => true
 *
 * @this Array
 * @param {Array} arr 比較する対象の配列
 * @return {Boolean} チェックの結果
 */
function equals(arr) {
// Array.prototype.$method("equals", function(arr) {
  // 長さチェック
  if (this.length !== arr.length) return false;
  
  for (var i=0,len=this.length; i<len; ++i) {
    if (this[i] !== arr[i]) {
      return false;
    }
  }

  return true;
}

/**
 * @method deepEquals
 * ネストされている配列を含め、渡された配列と等しいかどうかをチェックします。
 *
 * ※equalsDeep にするか検討. (Java では deepEquals なのでとりあえず合わせとく)
 *
 * ### Example
 *     arr = [6, 5, 2, [3, 1], 4];
 *     arr.equals([6, 5, 2, [3, 1], 4]);     // => false
 *     arr.deepEquals([6, 5, 2, [3, 1], 4]); // => true
 *
 * @this Array
 * @param {Array} arr 比較する対象の配列
 * @return {Boolean} チェックの結果
 */
function deepEquals(arr) {
// Array.prototype.$method("deepEquals", function(arr) {
  // 長さチェック
  if (this.length !== arr.length) return false;
  
  for (var i=0,len=this.length; i<len; ++i) {
    var result = (this[i].deepEquals) ? this[i].deepEquals(arr[i]) : (this[i] === arr[i]);
    if (result === false) {
      return false;
    }
  }
  return true;
}

/**
 * @method swap
 * @chainable
 * a 番目の要素 と b 番目の要素を入れ替えます。
 *
 * ### Example
 *     arr1 = ['a', 'b', 'c', 'd'];
 *     arr2 = arr1.swap(0, 3); // => ['d', 'b', 'c', 'a']
 *     arr1 === arr2;          // => true
 *
 * @this Array
 * @param {Number} a  インデックス
 * @param {Number} b  インデックス
 */
function swap(a, b) {
// Array.prototype.$method("swap", function(a, b) {
  var temp = this[a];
  this[a] = this[b];
  this[b] = temp;
  
  return this;
}

/**
 * @method eraseAll
 * @chainable
 * 指定したオブジェクトと一致したすべての要素を削除します。
 *
 * ### Example
 *     arr1 = ['a', 'b', 'b', 'c'];
 *     arr2 = arr1.eraseAll('b'); // => ['a', 'c']
 *     arr1 === arr2;             // => true
 *
 * @this Array
 * @param {Object} elm 削除したいオブジェクト
 */
function eraseAll(elm) {
// Array.prototype.$method("eraseAll", function(elm) {
  for (var i=0,len=this.length; i<len; ++i) {
    if (this[i] == elm) {
      this.splice(i--, 1);
    }
  }
  return this;
}

/**
 * @method eraseIf
 * @chainable
 * 各要素を引数にして関数を実行し、その値が真となる（＝条件にマッチする）最初の要素を削除します。
 *
 * どの要素もマッチしなければ何も起きません。
 *
 * ### Example
 *     arr = ['foo', 'bar', 'hoge', 'fuga'];
 *     arr.eraseIf( function(elm) {
 *       return elm.indexOf('o') >= 0;
 *     });
 *     // => ['bar', 'hoge', 'fuga']
 *
 * @this Array
 * @param {Function} fn 各要素に対して実行するコールバック関数
 */
function eraseIf(fn) {
// Array.prototype.$method("eraseIf", function(fn) {
  for (var i=0,len=this.length; i<len; ++i) {
    if ( fn(this[i], i, this) ) {
      this.splice(i, 1);
      break;
    }
  }
  return this;
}

/**
 * @method eraseIfAll
 * @chainable
 * 各要素を引数にして関数を実行し、その値が真となる（＝条件にマッチする）すべての要素を削除します。
 *
 * どの要素もマッチしなければ何も起きません。
 *
 * ### Example
 *     arr = ['foo', 'bar', 'hoge', 'fuga'];
 *     arr.eraseIfAll( function(elm) {
 *       return elm.indexOf('o') >= 0;
 *     });
 *     // => ['bar', 'fuga']
 *
 * @this Array
 * @param {Function} fn 各要素に対して実行するコールバック関数
 */
function eraseIfAll(fn) {
// Array.prototype.$method("eraseIfAll", function(fn) {
  for (var i=0,len=this.length; i<len; ++i) {
    if ( fn(this[i], i, this) ) {
      this.splice(i--, 1);
      len--;
    }
  }
  return this;
}

/**
 * @method random
 * 配列からランダムに1つ取り出した要素を返します。
 *
 * 取り出す範囲をインデックスで指定することもできます。  
 * {@link #pickup}、{@link #lot} と同じです。  
 *
 * ### Example
 *     arr = ['foo', 'bar', 'hoge', 'fuga'];
 *     arr.random(2, 3);  // => 'hoge' または 'fuga'
 *
 * @this Array
 * @param {Number} [min=0] インデックスの下限
 * @param {Number} [max=配列の最大インデックス] インデックスの上限
 * @return {Object} ランダムに1つ取り出した要素
 */
function random(min, max) {
// Array.prototype.$method("random", function(min, max) {
  min = min || 0;
  max = max || this.length-1;
  return this[randint(min, max) ];
}

/**
 * @method pickup
 * 配列からランダムで1つ取り出した要素を返します。
 * 
 * {@link #random}、{@link #lot} と同じです。
 * @inheritdoc #random
 * 
 * @this {Array}
 * @param {number} min
 * @param {number} max
 */
function pickup(min, max) {
// Array.prototype.$method("pickup", function(min, max) {
  min = min || 0;
  max = max || this.length-1;
  return this[randint(min, max) ];
}

/**
 * @method lot
 * 配列からランダムで1つ取り出した要素を返します。
 * 
 * {@link #random}、{@link #pickup} と同じです。
 * @inheritdoc #random
 * 
 * @this {Array}
 * @param {number} min
 * @param {number} max
 */
function lot(min, max) {
// Array.prototype.$method("lot", function(min, max) {
  min = min || 0;
  max = max || this.length-1;
  return this[randint(min, max) ];
}

/**
 * @method uniq
 * 要素の重複を取り除いた配列を生成して返します。
 *
 * 自分自身は破壊されません。
 *
 * ### Example
 *     arr = [1, 2, 3, 4, 3, 2];
 *     arr.uniq(); // => [1, 2, 3, 4]
 *
 * @this Array
 * @param {Number} [deep] 未使用
 * @return {Object} 新しい配列
 */
function uniq(deep) {
// Array.prototype.$method("uniq", function(deep) {
  return this.filter(function(value, index, self) {
    return self.indexOf(value) === index;
  });
}


/**
 * @method flatten
 * 自身を再帰的に平滑化した配列を生成して返します。
 *
 * level を指定しなければ深さの際限なく完全に平滑化します。
 *
 * ### Example
 *     arr = [1, 2, [3, [4, 5]]];
 *     arr.flatten();  // => [1, 2, 3, 4, 5]
 *     arr.flatten(1); // => [1, 2, 3, [4, 5]]
 *
 * @this Array<Array>
 * @param {Number} [level=0]  平滑化の再帰の深さ
 * @return {Object} 平滑化した配列
 */
function flatten(level) {
// Array.prototype.$method("flatten", function(level) {
  var arr = null;

  if (level) {
    arr = this;
    for (var i=0; i<level; ++i) {
      arr = Array.prototype.concat.apply([], arr);
    }
  }
  else {
    // 完全フラット
    arr = this.reduce(function (previousValue, curentValue) {
      return Array.isArray(curentValue) ?
        // previousValue.concat(curentValue.flatten()) : previousValue.concat(curentValue);
        previousValue.concat(flatten.call(curentValue)) : previousValue.concat(curentValue);
    }, []);
  }

  return arr;
}

/**
 * @method fill
 * @chainable
 * 自身の一部の要素を特定の値で埋めます。
 *
 * ### Example
 *     arr = [1, 2, 3, 4, 5];
 *     arr.fill("x");       // => ["x", "x", "x", "x", "x"]
 *     arr.fill("x", 2, 4); // => [1, 2, "x", "x", 5]
 *
 * @this Array
 * @param {Object} value 埋める値
 * @param {Number} [start=0] 値を埋める最初のインデックス
 * @param {Number} [end=自身の配列の長さ] 値を埋める最後のインデックス+1
 */
function fill(value, start, end) {
// Array.prototype.$method("fill", function(value, start, end) {
  start = start || 0;
  end   = end   || (this.length);
  
  for (var i=start; i<end; ++i) {
    this[i] = value;
  }
  
  return this;
}


/**
 * @method shuffle
 * @chainable
 * 自身の要素をランダムにシャッフルします。
 *
 * ### Example
 *     arr = [1, 2, 3, 4, 5];
 *     arr.shuffle(); // => [5, 1, 4, 2, 3] など
 * 
 * @this Array
 */
function shuffle() {
// Array.prototype.$method("shuffle", function() {
  for (var i=0,len=this.length; i<len; ++i) {
    var j = randint(0, len-1);
    
    if (i != j) {
      // this.swap(i, j);
      swap.call(this, i, j);
    }
  }
  
  return this;
}

/**
 * @method sum
 * 要素の合計値を返します。
 *
 * 要素に数値以外が含まれる場合の挙動は不定です。
 *
 * ### Example
 *     arr = [1, 2, 3, 4, 5, 6];
 *     arr.sum(); // => 21
 *
 * @this Array
 * @return {Number} 合計
 */
function sum() {
// Array.prototype.$method("sum", function() {
  var sum = 0;
  for (var i=0,len=this.length; i<len; ++i) {
    sum += this[i];
  }
  return sum;
}

/**
 * @method average
 * 要素の平均値を返します。
 *
 * 要素に数値以外が含まれる場合の挙動は不定です。
 *
 * ### Example
 *     arr = [1, 2, 3, 4, 5, 6]
 *     arr.average(); // => 3.5
 *
 * @this Array
 * @return {Number} 平均値
 */
function average() {
// Array.prototype.$method("average", function() {
  var sum = 0;
  var len = this.length;
  for (var i=0; i<len; ++i) {
    sum += this[i];
  }
  return sum/len;
}

/**
 * @method each
 * @chainable
 * 要素を順番に渡しながら関数を繰り返し実行します。
 *
 * メソッドチェーンに対応していますが、このメソッドによって自分自身は変化しません。
 *
 * ###Reference
 * - [Array.prototype.forEach() - JavaScript | MDN](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach)
 *
 * ### Example
 *     arr = [1, 2, 3];
 *     arr.each( function(elm) {
 *       console.log(elm * elm)
 *     });
 *     // => 1
 *     //    4
 *     //    9
 *
 * @this Array
 * @param {Function} callback 各要素に対して実行するコールバック関数
 * @param {Object} [self] callback 内で this として参照される値
 */
function each$1(callback, self) {
  this.forEach.call(this, callback, self || this);
  return this;
}
// Array.prototype.$method("each", function() {
//   this.forEach.apply(this, arguments);
//   return this;
// }

// /**
//  * @method toULElement
//  * ULElement に変換します（未実装）
//  */
// Array.prototype.$method("toULElement", function(){
//     // TODO: 
// });

// /**
//  * @method toOLElement
//  * OLElement に変換します（未実装）
//  */
// Array.prototype.$method("toOLElement", function(){
//     // TODO:
// });

/**
 * @method most
 * 指定した関数の返り値が最小となる要素と最大となる要素をまとめて返します。
 *
 * 空の配列に対して実行すると {max: Infinity, min: -Infinity} を返します。
 *
 * ### Example
 *     [5,1,4,1,9,2,-10].most(); // => {max:9, min: -10}
 *
 *     points = [ {x:0, y:0}, {x:640, y:960}, {x:-80, y:100} ];
 *     points.most(function(e){return e.x;}).min; // => [x:-80, y:100]
 *     points.most(function(e){return e.y;}).max; // => [x:640, y:960]
 * 
 * @typedef {Object} ArrayMostReturnValue max と min をキーに持つオブジェクト
 * @property {number} min - 関数の返り値が最小となる要素
 * @property {number} max - 関数の返り値が最大となる要素
 *
 * @this Array<number>
 * @param {Function} [func] 各要素に対して実行するコールバック関数
 * @param {Object} [self=this] 関数内で this として参照される値。デフォルトは自分自身。
 * @return {ArrayMostReturnValue}
 */
function most(func, self) {
// Array.prototype.$method("most", function(func, self) {
  if(this.length < 1){
    return {
      max: -Infinity,
      min: Infinity,
    };
  }
  if(func){
    var maxValue = -Infinity;
    var minValue = Infinity;
    var maxIndex = 0;
    var minIndex = 0;
    
    if(typeof self === 'undefined'){self = this;}
    
    for (var i = 0, len = this.length; i < len; ++i) {
      var v = func.call(self, this[i], i, this);
      if(maxValue < v){
        maxValue = v;
        maxIndex = i;
      }
      if(minValue > v){
        minValue = v;
        minIndex = i;
      }
    }
    return {
      max: this[maxIndex],
      min: this[minIndex],
    };
  }
  else {
    var max = -Infinity;
    var min = Infinity;
    for (var i = 0, len = this.length;i < len; ++i) {
      if(max<this[i]){max=this[i];}
      if(min>this[i]){min=this[i];}
    }
    return {
      max: max,
      min: min,
    };
  }
  
}  


// ==========
// 以下はes2015以降に存在するため、保留
// ==========


// /**
//  * @method find
//  * 各要素を引数にして関数を実行し、その値が真となる（＝条件にマッチする）最初の要素を返します。
//  *
//  * どの要素もマッチしなければ undefined を返します。
//  *
//  * ### Example
//  *     arr = ['foo', 'bar', 'hoge', 'fuga'];
//  *     arr.find( function(elm) {
//  *       return elm.indexOf('a') >= 0;
//  *     });
//  *     // => 'bar'
//  *
//  * @param {Function} callback 各要素に対して実行するコールバック関数
//  * @param {Object} [self=this] callback 内で this として参照される値。デフォルトは呼び出し時の this。
//  * @return {Object} 条件にマッチした最初の要素、または undefined
//  */
// Array.prototype.$method("find", function(fn, self) {
//   var target = null;

//   this.some(function(elm, i) {
//     if (fn.call(self, elm, i, this)) {
//       target = elm;
//       return true;
//     }
//   });

//   return target;
// });

// /**
//  * @method findIndex
//  * 各要素を引数にして関数を実行し、その値が真となる（＝条件にマッチする）最初のインデックスを返します。
//  *
//  * どの要素もマッチしなければ -1 を返します。
//  *
//  * ### Example
//  *     arr = ['foo', 'bar', 'hoge', 'fuga'];
//  *     arr.findIndex( function(elm) {
//  *       return elm.indexOf('a') >= 0;
//  *     });
//  *     // => 1
//  *
//  * @param {Function} callback 各要素に対して実行するコールバック関数
//  * @param {Object} [self=this] callback 内で this として参照される値。デフォルトは呼び出し時の this。
//  * @return {Object} 条件にマッチした最初のインデックス、または -1
//  */
// Array.prototype.$method("findIndex", function(fn, self) {
//   var target = -1;

//   this.some(function(elm, i) {
//     if (fn.call(self, elm, i, this)) {
//       target = i;
//       return true;
//     }
//   });

//   return target;
// });

/**
 * @method of
 * @static
 * ES6 準拠の of 関数です。可変長引数をとって Array オブジェクトにして返します。
 *
 * ### Example
 *     Array.of();        // => []
 *     Array.of(1, 2, 3); // => [1, 2, 3]
 *
 * @param {Object} elementN 生成する配列の要素
 * @return {Array} 生成した配列
 */
// Array.$method("of", function() {
//   return Array.prototype.slice.call(arguments);
// });

/**
 * @method from
 * @static
 * ES6 準拠の from 関数です。array-like オブジェクトかiterable オブジェクトから新しい配列を生成します。
 *
 * array-like オブジェクトとは、length プロパティを持ち、数字の添字でアクセス可能なオブジェクトのことです。
 * 通常の配列のほか、String、arguments、NodeList なども array-like オブジェクトです。
 *
 * iterable オブジェクトとは、Symbol.iterator プロパティを持つオブジェクトのことです。
 * 通常の配列のほか、String、arguments、NodeList なども iterable オブジェクトです。
 *
 * ### Example
 *     Array.from([1, 2, 3], function(elm){ return elm * elm} ); // => [1, 4, 9]
 *     Array.from("foo");                                        // => ["f", "o", "o"]
 *     Array.from( document.querySelectorAll("span"))            // => [Element, Element, Element,...]
 *
 * @param {Object} arrayLike 配列に変換する array-like オブジェクト
 * @param {Function} [callback] arrayLike のすべての要素に対して実行するマップ関数
 * @param {Object} [context] callback 内で this として参照される値
 * @return {Array} 生成した配列
 */
// Array.$method("from", function(arrayLike, callback, context) {
//   if (!Object(arrayLike).length) return [];

//   var result = [];
//   if (Symbol && Symbol.iterator && arrayLike[Symbol.iterator]) {
//       var iterator = arrayLike[Symbol.iterator]();
//       while (true) {
//           var iteratorResult = iterator.next();
//           if (iteratorResult.done) break;

//           var value = typeof callback === 'function' ? callback.bind(context || this)(iteratorResult.value) : iteratorResult.value;
//           result.push(value);
//       }
//       return result;
//   }

//   for (var i = 0, len = arrayLike.length; i < len; i++) {
//       result.push(arrayLike[i]);
//   }
//   return result.map(typeof callback == 'function' ? callback : function(item) {
//     return item;
//   }, context);
// });

var arrayExtensions = /*#__PURE__*/Object.freeze({
  __proto__: null,
  first: first,
  last: last,
  at: at,
  erase: erase,
  clear: clear,
  contains: contains,
  clone: clone,
  range: range,
  equals: equals,
  deepEquals: deepEquals,
  swap: swap,
  eraseAll: eraseAll,
  eraseIf: eraseIf,
  eraseIfAll: eraseIfAll,
  random: random,
  pickup: pickup,
  lot: lot,
  uniq: uniq,
  flatten: flatten,
  fill: fill,
  shuffle: shuffle,
  sum: sum,
  average: average,
  each: each$1,
  most: most
});

/**
 * アクセサ拡張用オブジェクト
 * @typedef {{get: ()=> any, set: (v:any)=> void}} AccessorExtendObject
 */

/**
 * @typedef {{
 *   _creator: any
 *   _hierarchies: PhinaClass[]
 *   init: function
 *   superClass?: any
 *   superInit?: function
 *   superMethod?: (methodName: string, ...args:any) => any // スーパーメソッドの結果
 *   constructor?: any
 *   [k: string]: any // その他のプロパティ
 * }} PhinaClassPrototype
 */

/**
 * @typedef {{
 *   prototype: PhinaClassPrototype
 *   [k: string]: any // その他のstaticプロパティ
 * }} PhinaClass
 */

/**
 * @typedef {Object} CreateClassParam
 * @property {Function & {owner: any}} params.init クラス初期化関数
 * @property {PhinaClass} [params.superClass] スーパークラス
 * @property {{[k: string]: AccessorExtendObject}} [params._accessor] アクセサを付与
 * @property {{[k: string]: any}} [params._static] staticプロパティを付与
 * @property {Function} [params._defined] 定義時に実行したい関数
 */

var _classDefinedCallback = {};

var phina = {
  /**
   * @property {String} VERSION
   * @memberof phina
   * @static
   * phina.js のバージョンです。
   */
  VERSION: "0.2.3",

  /**
   * @method isNode
   * Node.js の module かどうかをチェックします。
   * @memberof phina
   * @static
   */
  isNode: function () {
    return "object" !== "undefined";
  },

  /**
   * @method namespace
   * 引数は関数で、その関数内での this は phina になります。
   * @memberof phina
   * @static
   *
   * @param {Function} fn 関数
   */
  namespace: function (fn) {
    fn.call(this);
  },

  /**
   * @method testUA
   * 引数の RegExp オブジェクトとユーザーエージェントを比較して返します。
   * @memberof phina
   * @static
   *
   * @param {RegExp} regExp
   * @return {Boolean}
   */
  testUA: function (regExp) {
    if (!this.global.navigator) return false;
    var ua = this.global.navigator.userAgent;
    return regExp.test(ua);
  },

  /**
   * @method isAndroid
   * Android かどうかを返します。
   * @memberof phina
   * @static
   *
   * @return {Boolean} Android かどうか
   */
  isAndroid: function () {
    return this.testUA(/Android/);
  },

  /**
   * @method isIPhone
   * iPhone かどうかを返します。
   * @memberof phina
   * @static
   *
   * @return {Boolean} iPhone かどうか
   */
  isIPhone: function () {
    return this.testUA(/iPhone/);
  },

  /**
   * @method isIPad
   * iPad かどうかを返します。
   * @memberof phina
   * @static
   *
   * @return {Boolean} iPad かどうか
   */
  isIPad: function () {
    return this.testUA(/iPad/);
  },

  /**
   * @method isIOS
   * iOS かどうかを返します。
   * @memberof phina
   * @static
   *
   * @return {Boolean} iOS かどうか
   */
  isIOS: function () {
    return this.testUA(/iPhone|iPad/);
  },

  /**
   * @method isMobile
   * モバイルかどうかを返します。具体的には Android, iPhone, iPad のいずれかだと true になります。
   * @memberof phina
   * @static
   *
   * @return {Boolean} モバイルかどうか
   */
  isMobile: function () {
    return this.testUA(/iPhone|iPad|Android/);
  },

  /**
   * @method createClass
   * クラスを作成する関数です。
   * 親クラスの指定は文字列でも可能です。
   * 何も継承しない場合 superClass の指定は不要です。また、親クラスを継承している場合、コンストラクタ内で this.superInit() を実行して親クラスを初期化することが必須です。
   * @memberof phina
   * @static
   *
   * @example
   * var Class = phina.createClass({
   *   superClass: namespace.Super,//親クラス継承
   *
   *   //メンバ変数
   *   member1: 100,
   *   member2: 'test',
   *   member3: null,
   *
   *   // コンストラクタ
   *   // Class()を呼び出したとき実行される
   *   init: function(a, b){
   *     //スーパークラス(継承したクラス)のinit
   *     this.superInit(a, b);
   *     this.a = a;
   *     this.b = b;
   *   },
   *
   *   //メソッド
   *   method1: function(){},
   *   method2: function(){},
   *
   * });
   *
   * @param {CreateClassParam} params
   * @return {PhinaClass} phinaクラス
   */
  createClass: function (params) {

    /** @type {PhinaClass} */
    var _class = function () {
      var instance = new _class.prototype._creator();
      _class.prototype.init.apply(instance, arguments);
      return instance;
    };

    if (params.superClass) {
      _class.prototype = Object.create(params.superClass.prototype);
      params.init.owner = _class;
      _class.prototype.superInit = function () {
        this.__counter = this.__counter || 0;

        var superClass = this._hierarchies[this.__counter++];
        var superInit = superClass.prototype.init;
        superInit.apply(this, arguments);

        this.__counter = 0;
      };
      _class.prototype.superMethod = function () {
        var args = Array.prototype.slice.call(arguments, 0);
        var name = args.shift();
        this.__counters = this.__counters || {};
        this.__counters[name] = this.__counters[name] || 0;

        var superClass = this._hierarchies[this.__counters[name]++];
        var superMethod = superClass.prototype[name];
        var rst = superMethod.apply(this, args);

        this.__counters[name] = 0;

        return rst;
      };
      _class.prototype.constructor = _class;
    }

    // //
    // params.forIn(function(key, value) {
    //   if (typeof value === 'function') {
    //     _class.$method(key, value);
    //   }
    //   else {
    //     _class.prototype[key] = value;
    //   }
    // });
    // 継承
    $extend.call(_class.prototype, params);
    // _class.prototype.$extend(params);

    // 継承用
    _class.prototype._hierarchies = [];
    var _super = _class.prototype.superClass;
    while (_super) {
      _class.prototype._hierarchies.push(_super);
      _super = _super.prototype.superClass;
    }

    // accessor
    if (params._accessor) {
      // params._accessor.forIn(
      forIn.call(
        params._accessor,
        /**
         * @param {string} key
         * @param {AccessorExtendObject} value
         */
        function (key, value) {
          accessor.call(_class.prototype, key, value);
          // _class.prototype.accessor(key, value);
        }
      );
      // _class.prototype = Object.create(_class.prototype, params._accessor);
    }

    _class.prototype._creator = function () {
      return this;
    };
    _class.prototype._creator.prototype = _class.prototype;

    // static property/method
    if (params._static) {
      $extend.call(_class, params._static);
      // _class.$extend(params._static);
    }

    if (params._defined) {
      params._defined.call(_class, _class);
    }

    return _class;
  },

  /**
   * @method using
   * 文字列で定義したパスを使ってオブジェクトを取り出します。パスは , . / \ :: で区切ることができます。
   * {@link #phina.register} で登録したオブジェクトを取り出すときなどに使うと便利な関数です。
   * @memberof phina
   * @static
   *
   * @example
   * hoge = {
   *   foo: {
   *     bar: {
   *       num: 100
   *     }
   *   }
   * };
   * var bar = phina.using('hoge.foo.bar');
   * console.log(bar.num); // => 100
   *
   * @param {String} path オブジェクトへのパス
   * @return {Object} 取り出したオブジェクト
   */
  using: function (path) {
    if (!path) {
      return this.global;
    }

    var pathes = path.split(/[,.\/ ]|::/);
    var current = this.global;

    pathes.forEach(function (p) {
      current = current[p] || (current[p] = {});
    });

    return current;
  },

  /**
   * @method register
   * パス指定でオブジェクトを登録する関数です。パスは , . / \ :: で区切ることができます。
   * @memberof phina
   * @static
   *
   * @example
   * phina.register('hoge.foo.bar', {
   *   num: 100,
   * });
   * console.log(hoge.foo.bar.num); // => 100
   *
   * @param {String} path 登録するオブジェクトのパス
   * @param {Object} _class 登録するオブジェクト
   * @return {Object} 登録したオブジェクト
   */
  register: function (path, _class) {
    var pathes = path.split(/[,.\/ ]|::/);
    // var className = pathes.last;
    var className = last.get.call(pathes);
    // FIXME: ここを直さないとピリオド区切り以外は無効？
    var parentPath = path.substring(0, path.lastIndexOf("."));
    var parent = this.using(parentPath);

    parent[className] = _class;

    return _class;
  },

  /**
   * @method define
   * クラスを定義する関数です。使い方は {@link #createClass} とほとんど同じです。
   * ただし、引数は2つあり、第一引数は定義するクラスのパスを文字列で渡します。第二引数のオブジェクトは {@link #createClass} の引数と同じようにします。
   * {@link #createClass} と違い、変数に代入する必要がなく、パス指定でクラスを定義できます。
   * 内部的には {@link #register}, {@link #using} を使用しているため、パスは , . / \ :: で区切ることができます。
   * @memberof phina
   * @static
   *
   * @example
   * phina.define('namespace.Class', {
   *   superClass: 'namespace.Super',//親クラス継承
   *
   *   //メンバ変数
   *   member1: 100,
   *   member2: 'test',
   *   member3: null,
   *
   *   //コンストラクタ
   *   //Class()を呼び出したとき実行される
   *   init: function(a, b){
   *     //スーパークラス(継承したクラス)のinit
   *     this.superInit(a, b);
   *     this.a = a;
   *     this.b = b;
   *   },
   *
   *   //メソッド
   *   method1: function(){},
   *   method2: function(){},
   * });
   *
   * @param {String} path パス
   * @param {Object} params
   * @param {Function & {owner: any}} params.init クラス初期化関数
   * @param {string | PhinaClass} [params.superClass] スーパークラス
   * @param {{[k: string]: AccessorExtendObject}} [params._accessor] アクセサを付与
   * @param {{[k: string]: any}} [params._static] staticプロパティを付与
   * @param {Function} [params._defined] 定義時に実行したい関数
   * @return {PhinaClass} 定義したクラス
   */
  define: function (path, params) {
    if (params.superClass) {
      if (typeof params.superClass === "string") {
        var _superClass = this.using(params.superClass);
        if (typeof _superClass != "function") {
          if (!_classDefinedCallback[params.superClass]) {
            _classDefinedCallback[params.superClass] = [];
          }
          _classDefinedCallback[params.superClass].push(function () {
            this.define(path, params);
          });

          return;
        } else {
          params.superClass = _superClass;
        }
      } else {
        params.superClass = params.superClass;
      }
    }

    var _class = this.createClass(/** @type CreateClassParam */ (params));
    // _class.prototype.accessor('className', {
    accessor.call(_class.prototype, "className", {
      get: function () {
        return path;
      },
    });

    this.register(path, _class);

    if (_classDefinedCallback[path]) {
      _classDefinedCallback[path].forEach(function (callback) {
        callback();
      });
      _classDefinedCallback[path] = null;
    }

    return _class;
  },

  /**
   * @method globalize
   * phina.js が用意している全てのクラスをグローバルに展開します。（具体的には phina が持つオブジェクトが一通りグローバルに展開されます。）
   * この関数を実行することで、いちいち global からたどっていかなくても phina.js の用意しているクラスをクラス名だけで呼び出すことができます。
   * @memberof phina
   * @static
   *
   * @example
   * var sprite1 = phina.display.Sprite("piyo"); 
   * phina.globalize();
   * var sprite2 = Sprite("piyo"); // sprite1と等価
   *
   */
  globalize: function () {
    // phina.forIn(
    forIn.call(this, function (key, value) {

      if (typeof value !== "object") return;

      // value.forIn(function(key, value) {
      forIn.call(value, function (key, value) {
        // if (phina.global[key]) {
        //   console.log(ns, key);
        //   phina.global['_' + key] = value;
        // }
        // else {
        //   phina.global[key] = value;
        // }
        this.global[key] = value;
      });
    });
  },

  /** @private */
  _mainListeners: [],
  /** @private */
  _mainLoaded: false,

  /**
   * @method main
   * phina.js でプログラミングする際、メインの処理を記述するための関数です。
   * 基本的に phina.js でのプログラミングではこの中にプログラムを書いていくことになります。
   * @memberof phina
   * @static
   *
   * @example
   * phina.main(function() {
   *   //ここにメインの処理を書く
   * });
   *
   * @param {Function} func メインの処理
   */
  main: function (func) {
    if (this._mainLoaded) {
      func();
    } else {
      this._mainListeners.push(func);
    }
  },

  /**
   * @memberof phina
   * Node.js なら global、 ブラウザなら window を返します。
   * ゲッターのみ定義されています。
   */
  get global() {
    return GLOBAL;
  },
};

var GLOBAL = phina.isNode() ? __webpack_require__.g : window;

var doc = phina.global.document;
if (phina.global.addEventListener && doc && doc.readyState !== "complete") {
  phina.global.addEventListener("load", function () {
    var run = function () {
      var listeners = clone.call(phina._mainListeners);
      // var listeners = phina._mainListeners.clone();
      clear.call(phina._mainListeners);
      // phina._mainListeners.clear();
      listeners.forEach(function (func) {
        // listeners.each(function(func) {
        func();
      });

      // main 内で main を追加している場合があるのでそのチェック
      if (phina._mainListeners.length > 0) {
        run();
        // run(0);
      } else {
        phina._mainLoaded = true;
      }
    };
    // ちょっと遅延させる(画面サイズ問題)
    setTimeout(run);
  });
} else {
  phina._mainLoaded = true;
}

/**
 * Arrayクラスのstatic拡張
 */

/**
 * @method range
 * @static
 * インスタンスメソッドの {@link #range} と同じです。
 *
 * ### Example
 *     Array.range(2, 14, 5); // => [2, 7, 12]
 */
function range$1(start, end, step) {
  return range.apply([], arguments);
}
// Array.$method("range", function(start, end, step) {
//   return Array.prototype.range.apply([], arguments);
// });

var arrayStaticExtensions = /*#__PURE__*/Object.freeze({
  __proto__: null,
  range: range$1
});

/**
 * @class global.Number
 * # 拡張した Number クラス
 * 数値を扱う Number クラスを拡張しています。
 */

/**
 * @method times
 * 0 から自分自身の数-1まで、カウンタをインクリメントしながら関数を繰り返し実行します。
 *
 * ### Example
 *     arr = [];
 *     (5).times(function(i){
 *       arr.push(i);
 *     }); // => [0, 1, 2, 3, 4]
 *
 * @this Number
 * @param {Function} fn コールバック関数
 * @param {Object} [self=this] 関数内で this として参照される値。デフォルトは自分自身。
 */
function times(fn, self) {
// Number.prototype.$method("times",  function(fn, self) {
  self = self || this;
  for (var i=0; i<this; ++i) {
    fn.call(self, i, this);
  }
  return this;
}

/**
 * @method step
 * 自分自身の値から指定した数まで、カウンタを増分させながら関数を繰り返し実行します。
 *
 * 上限値や増分値は float 型を指定することができます。
 *
 * ### Example
 *     var arr = [];
 *     (2.4).step(5.3, 0.8, function(n) {
 *       arr.push(n);
 *      }); // => [2.4, 3.2, 4.0, 4.8]
 *
 * @this Number
 * @param {Number} limit カウンタの上限値
 * @param {Number} step カウンタを増分する量
 * @param {Function} fn コールバック関数。引数にカウンタが渡される。
 * @param {Object} [self=this] 関数内で this として参照される値。デフォルトは自分自身。
 */
function step(limit, step, fn, self) {
// Number.prototype.$method("step",  function(limit, step, fn, self) {
  self = self || this;
  for (var i=+this; i<=limit; i+=step) {
    fn.call(self, i, this);
  }
  return this;
}


// ==========
// 以下ライブラリ内では未使用
// ==========

/**
 * @method round
 * 指定した小数の位を四捨五入した値を返します。
 *
 * 負の値を指定すると整数部の位を四捨五入できます。
 *
 * ### Example
 *     (13.87).round(); // => 14
 *     (-1.87).round(); // => -2
 *     (-1.27).round(); // => -1
 *     
 *     (2.345).round(); // => 2
 *     (2.345).round(1); // => 2.3
 *     (2.345).round(2); // => 2.35
 *
 *     (12345.67).round(-3); // => 12000
 *
 * @this Number
 * @param {Number} [figure=0] 四捨五入する位
 * @return {Number} 小数第 figure 位で四捨五入した値
 */
function round(figure) {
// Number.prototype.$method("round", function(figure) {
  figure = figure || 0;
  var base = Math.pow(10, figure);
  var temp = this * base;
  temp = Math.round(temp);
  return temp/base;
}

/**
 * @method ceil
 * 指定した小数の位を切り上げた値を返します。
 *
 * 負の値を指定すると整数部の位を切り上げられます。
 *
 * ### Example
 *     (-1.27).ceil(); // => -1
 *     (-1.87).ceil(); // => -1
 *     
 *     (2.345).ceil(); // => 3
 *     (2.345).ceil(1); // => 2.4
 *     (2.345).ceil(2); // => 2.35
 *
 *     (12345.67).ceil(-3); // => 13000
 *
 * @this Number
 * @param {Number} [figure=0] 切り上げる位
 * @return {Number} 小数第 figure 位で切り上げた値
 */
function ceil(figure) {
// Number.prototype.$method("ceil",  function(figure) {
  figure = figure || 0;
  var base = Math.pow(10, figure);
  var temp = this * base;
  temp = Math.ceil(temp);
  return temp/base;
}

/**
 * @method floor
 * 指定した小数の位を切り下げた値を返します。
 *
 * 負の値を指定すると整数部の位を切り下げられます。
 *
 * ### Example
 *     (-1.27).floor(); // => -2
 *     (-1.87).floor(); // => -2
 *     
 *     (2.345).floor(); // => 2
 *     (2.345).floor(1); // => 2.3
 *     (2.345).floor(2); // => 2.34
 *
 *     (12345.67).floor(-3); // => 12000
 *
 * @this Number
 * @param {Number} [figure=0] 切り下げる位
 * @return {Number} 小数第 figure 位で切り下げた値
 */
function floor(figure) {
// Number.prototype.$method("floor",  function(figure) {
  figure = figure || 0;
  var base = Math.pow(10, figure);
  var temp = this * base;
  temp = Math.floor(temp);
  
  // ~~this
  // this|0
  
  return temp/base;
}

/**
 * @method toInt
 * 数値を整数に変換します。
 *
 * ### Example
 *     (42.195).toInt(); // => 42
 *
 * @this Number
 * @return {Number} 整数値
 */
function toInt() {
// Number.prototype.$method("toInt",  function() {
  return (this | 0);
}

/**
 * @method toHex
 * 数値を16進数表記にした文字列を返します。
 *
 * ### Example
 *     (26).toHex(); // => "1a"
 *     (-26).toHex(); // => "-1a"
 *     (26.25).toHex(); // => "1a.4"
 *
 * @this Number
 * @return {String} 16進数表記の文字列
 */
function toHex() {
// Number.prototype.$method("toHex",  function() {
  return this.toString(16);
}

/**
 * @method toBin
 * 数値を2進数表記にした文字列を返します。
 *
 * ### Example
 *     (6).toBin(); // => "110"
 *     (-6).toBin(); // => "-110"
 *     (0xA3).toBin(); // => "10100011"
 *     (6.25).toHex(); // => "110.01"
 *
 * @this Number
 * @return {String} 2進数表記の文字列
 */
function toBin() {
// Number.prototype.$method("toBin",  function() {
  return this.toString(2);
}


/**
 * @method toUnsigned
 * 数値を unsigned int 型に変換します。
 *
 * 数値を符号無し整数として評価した値を返します。  
 * Javascriptのビット演算では数値を符号付きの32bit整数として扱うため、RGBA を
 * 整数値で表現して演算する場合、期待通りの結果が得られない場合があります。
 * そこで本関数で unsigned int 型に変換することで期待通りの値を得ることができます。
 *
 * ### Example
 *     rgba = 0xfeffffff & 0xff000000; // => -33554432
 *     rgba.toHex(); // => "-2000000"
 *     rgba.toUnsigned().toHex(); // => "fe000000"
 *
 * @this Number
 * @return {Number} unsigned int 型に変換した値
 */
function toUnsigned() {
// Number.prototype.$method("toUnsigned",  function() {
  return this >>> 0;
}

/**
 * @method padding
 * 指定した桁になるように文字を埋めます。
 *
 * ### Example
 *     (123).padding(5); // => "00123"
 *     (123).padding(5, "_"); // => "__123"
 *     (-12).padding(5); // => "-0012"
 *
 * @this Number
 * @param {Number} n 桁数
 * @param {String} [ch="0"] 埋める文字
 * @return {String} 桁数を揃えた文字列
 */
function padding$1(n, ch) {
// Number.prototype.$method("padding",  function(n, ch) {
  var str = this+'';
  n  = n-str.length;
  ch = (ch || '0')[0];
  
  while(n-- > 0) { str = ch + str; }
  
  if (str.indexOf("-") >= 0) {
    str = "-" + str.replace("-", "");
  }

  return str;
}

/**
 * @method upto
 * 自分自身の数から指定した数まで、カウンタをインクリメントしながら関数を繰り返し実行します。
 *
 * 指定した数が自分自身の数より小さい場合は関数は実行されません。
 *
 * ### Example
 *     arr = [];
 *     (6).upto(8, function(i){
 *       arr.push(i);
 *     });
 *     arr; // => [6, 7, 8]
 *
 *     (3).upto(0, function(i){
 *       arr.push(i);
 *     });
 *     arr; // => [6, 7, 8]
 *
 * @this Number
 * @param {Function} fn コールバック関数。引数にカウンタが渡される。
 * @param {Object} [self=this] 関数内で this として参照される値。デフォルトは自分自身。
 */
function upto(t, fn, self) {
// Number.prototype.$method("upto",  function(t, fn, self) {
  self = self || this;
  for (var i=+this; i<=t; ++i) {
    fn.call(self, i, this);
  }
  return this;
}

/**
 * @method downto
 * 自分自身の数から指定した数まで、カウンタをデクリメントしながら関数を繰り返し実行します。
 *
 * 指定した数が自分自身の数より大きい場合は関数は実行されません。
 *
 * ### Example
 *     arr = [];
 *     (7).downto(4, function(i){
 *       arr.push(i);
 *     }); // => [7, 6, 5, 4]
 *
 * @this Number
 * @param {Function} fn コールバック関数。引数にカウンタが渡される。
 * @param {Object} [self=this] 関数内で this として参照される値。デフォルトは自分自身。
 */
function downto(t, fn, self) {
// Number.prototype.$method("downto",  function(t, fn, self) {
  self = self || this;
  for (var i=+this; i>=t; --i) {
    fn.call(self, i, this);
  }
  return this;
}


/**
 * @method map
 * 0から自分自身の値-1までカウンタをインクリメントさせながらコールバック関数を繰り返し実行し、
 * その返り値を要素とする配列を生成します。
 *
 * ### Example
 *     (5).map(function(i) {
 *       return i*i;
 *     }); // => [0, 1, 4, 9, 16]
 *
 * @this Number
 * @param {Function} fn コールバック関数。引数にカウンタが渡される。
 * @param {Object} [self=this] 関数内で this として参照される値。デフォルトは自分自身。
 * @return {Array} 生成した配列
 */
function map(fn, self) {
// Number.prototype.$method("map",  function(fn, self) {
  self = self || this;

  var results = [];
  for (var i=0; i<this; ++i) {
    var r = fn.call(self, i);
    results.push(r);
  }
  return results;
}

/**
 * @method abs
 * 絶対値を返します。
 *
 * ### Example
 *     (-5).abs(); // => 5
 *     (+5).abs(); // => 5
 *
 * @this Number
 * @return {Number} 絶対値
 */
function abs() { return Math.abs(this) }
// Number.prototype.$method("abs", function() { return Math.abs(this) });

/**
 * @method acos
 * アークコサイン（ラジアン単位）を返します。
 *
 * ### Example
 *     (0).asin(); // => 0
 *     (1).asin(); // => 1.5707963267948966
 *
 * @this Number
 * @return {Number} アークコサイン
 */
function acos() { return Math.acos(this) }
// Number.prototype.$method("acos", function() { return Math.acos(this) });

/**
 * @method asin
 * アークサイン（ラジアン単位）を返します。
 *
 * ### Example
 *     (1).acos(); // => 0
 *     (-1).acos(); // => 3.141592653589793
 *
 * @this Number
 * @return {Number} アークサイン
 */
function asin() { return Math.asin(this) }
// Number.prototype.$method("asin", function() { return Math.asin(this) });

/**
 * @method atan
 * アークタンジェント（ラジアン単位）を返します。
 *
 * ### Example
 *     (0).atan(); // => 0
 *     (1).atan(); // => 0.7853981633974483
 *
 * @this Number
 * @return {Number} アークタンジェント
 */
function atan() { return Math.atan(this) }
// Number.prototype.$method("atan", function() { return Math.atan(this) });

/**
 * @method cos
 * コサイン（ラジアン単位）を返します。
 *
 * ### Example
 *     (Math.PI/3).cos(); // => 0.5
 *
 * @this Number
 * @return {Number} コサイン
 */
function cos() { return Math.cos(this) }
// Number.prototype.$method("cos", function() { return Math.cos(this) });

/**
 * @method exp
 * e<sup>this</sup> を返します。ここで e は自然対数の底であるネイピア数（オイラー数）です。
 *
 * ### Example
 *     (2).exp(); // => e<sup>2</sup>
 *     (0).exp(); // => 1
 *
 * @this Number
 * @return {Number} e<sup>x</sup>
 */
function exp() { return Math.exp(this) }
// Number.prototype.$method("exp", function() { return Math.exp(this) });

/**
 * @method log
 * 自然対数を返します。
 *
 * ### Example
 *     (Math.E * Math.E * Math.E).log(); // => 3
 *     (1).log(); // => 0
 *     (0).log(); // => -Infinity
 *
 * @this Number
 * @return {Number} 自然対数
 */
function log() { return Math.log(this) }
// Number.prototype.$method("log", function() { return Math.log(this) });

/**
 * @method max
 * 自分自身と引数の値を比べ、大きい方の値を返します。
 *
 * ### Example
 *     (15).max(10); // => 15
 *     (15).max(90); // => 90
 *
 * @this Number
 * @param {Number} value 比較する値
 * @return {Number} 最大値
 */
function max(value) { return Math.max(this, value) }
// Number.prototype.$method("max", function(value) { return Math.max(this, value) });

/**
 * @method min
 * 自分自身と引数の値を比べ、小さい方の値を返します。
 *
 * ### Example
 *     (15).min(10); // => 10
 *     (15).min(90); // => 15
 *
 * @this Number
 * @param {Number} value 比較する値
 * @return {Number} 最小値
 */
function min(value) { return Math.min(this, value) }
// Number.prototype.$method("min", function(value) { return Math.min(this, value) });

/**
 * @method clamp
 * 指定した範囲に収めた値を返します。
 *
 * ### Example
 *     (200).clamp(0, 640); // => 200
 *     (-15).clamp(0, 640); // => 0
 *     (999).clamp(0, 640); // => 640
 *
 * @this Number
 * @param {Number} min 範囲の下限
 * @param {Number} max 範囲の上限
 * @return {Number} 範囲内に収めた値
 */
function clamp$1(min, max) { return clamp(this, min, max) }
// Number.prototype.$method("clamp", function(min, max) { return Math.clamp(this, min, max) });

/**
 * @method pow
 * 自分自身を exponent 乗した値、つまり this<sup>exponent</sup> の値を返します。
 *
 * ### Example
 *     (3).pow(2); // => 9
 *
 * @this Number
 * @param {Number} exponent 累乗する指数
 * @return {Number} 累乗した結果の値
 */
function pow(exponent) { return Math.pow(this, exponent) }
// Number.prototype.$method("pow", function(exponent) { return Math.pow(this, exponent) });

/**
 * @method sin
 * サイン（ラジアン単位）を返します。
 *
 * ### Example
 *     (Math.PI/4).sin(); // => 0.7071067811865476
 *
 * @this Number
 * @return {Number} サイン
 */
function sin() { return Math.sin(this) }
// Number.prototype.$method("sin", function() { return Math.sin(this) });

/**
 * @method sqrt
 * 平方根を返します。
 *
 * ### Example
 *     (49).sqrt(); // => 7
 *
 * @this Number
 * @return {Number} 平方根
 */
function sqrt() { return Math.sqrt(this) }
// Number.prototype.$method("sqrt", function() { return Math.sqrt(this) });

/**
 * @method tan
 * タンジェント（ラジアン単位）を返します。
 *
 * ### Example
 *     (Math.PI/4).tan(); // => 1.0
 *
 * @this Number
 * @return {Number} タンジェント
 */
function tan() { return Math.tan(this) }
// Number.prototype.$method("tan", function() { return Math.tan(this) });

/**
 * @method toDegree
 * ラジアンを度に変換します。
 *
 * ### Example
 *     Math.radToDeg(Math.PI/4); // => 45
 *
 * @this Number
 * @return {Number} 度
 */
function toDegree() { return (this * RAD_TO_DEG); }
// Number.prototype.$method("toDegree", function() { return (this*Math.RAD_TO_DEG); });

/**
 * @method toRadian
 * 度をラジアンに変換します。
 *
 * ### Example
 *     (180).toRadian(); // => 3.141592653589793
 *
 * @this Number
 * @return {Number} ラジアン
 */
function toRadian() { return this * DEG_TO_RAD; }
// Number.prototype.$method("toRadian", function() { return this*Math.DEG_TO_RAD; });

var numberExtensions = /*#__PURE__*/Object.freeze({
  __proto__: null,
  times: times,
  step: step,
  round: round,
  ceil: ceil,
  floor: floor,
  toInt: toInt,
  toHex: toHex,
  toBin: toBin,
  toUnsigned: toUnsigned,
  padding: padding$1,
  upto: upto,
  downto: downto,
  map: map,
  abs: abs,
  acos: acos,
  asin: asin,
  atan: atan,
  cos: cos,
  exp: exp,
  log: log,
  max: max,
  min: min,
  clamp: clamp$1,
  pow: pow,
  sin: sin,
  sqrt: sqrt,
  tan: tan,
  toDegree: toDegree,
  toRadian: toRadian
});

/**
 * @class global.Date
 * # 拡張した Date クラス
 * 日付を扱う Date クラスを拡張しています。
 */

var MONTH = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
];

var WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

/**
 * @method format
 * 指定したフォーマットに従って日付を文字列化します。
 *
 * <table border="1">
 *   <tr><td>変換指定文字列</td><td>意味</td></tr>
 *   <tr><td>yyyy</td><td>西暦年（4桁）</td></tr>
 *   <tr><td>yy</td><td>西暦年（2桁）</td></tr>
 *   <tr><td>y</td><td>西暦年</td></tr>
 *   <tr><td>MMMM</td><td>月（英語名）</td></tr>
 *   <tr><td>MMM</td><td>月（英語省略名）</td></tr>
 *   <tr><td>MM</td><td>月（2桁数字）</td></tr>
 *   <tr><td>M</td><td>月</td></tr>
 *   <tr><td>dd</td><td>日（2桁）</td></tr>
 *   <tr><td>d</td><td>日</td></tr>
 *   <tr><td>EEEE</td><td>曜日（英語名）</td></tr>
 *   <tr><td>EEE</td><td>曜日（英語省略名）</td></tr>
 *   <tr><td>HH</td><td>時（24時間表記・2桁）</td></tr>
 *   <tr><td>H</td><td>時（24時間表記）</td></tr>
 *   <tr><td>mm</td><td>分（2桁）</td></tr>
 *   <tr><td>m</td><td>分</td></tr>
 *   <tr><td>ss</td><td>秒（2桁）</td></tr>
 *   <tr><td>s</td><td>秒</td></tr>
 * </table>
 * 桁数が指定されているものは0パディングされます。
 *
 * ### Example
 *     (new Date()).format("yyyy-MM-dd(EEE)"); // => "2016-04-05(Tue)" など
 *
 * @this Date
 * @param {String} pattern フォーマット文字列
 * @return {String} フォーマット文字列に従って生成された文字列
 */
function format$1(pattern) {
// Date.prototype.$method('format', function(pattern) {
  var year    = this.getFullYear();
  var month   = this.getMonth();
  var date    = this.getDate();
  var day     = this.getDay();
  var hours   = this.getHours();
  var minutes = this.getMinutes();
  var seconds = this.getSeconds();
  var millseconds = this.getMilliseconds();
  
  var patterns = {
    'yyyy': padding.call(String(year), 4, '0'),
    // 'yyyy': String(year).padding(4, '0'),
    'yy': year.toString().substr(2, 2),
    'y': year,

    'MMMM': MONTH[month],
    'MMM': MONTH[month].substr(0, 3),
    'MM': padding.call(String(month+1), 2, '0'),
    // 'MM': String(month+1).padding(2, '0'),
    'M': (month+1),

    'dd': padding.call(String(date), 2, '0'),
    // 'dd': String(date).padding(2, '0'),
    'd': date,

    'EEEE': WEEK[day],
    'EEE': WEEK[day].substr(0, 3),

    'HH': padding.call(String(hours), 2, '0'),
    // 'HH': String(hours).padding(2, '0'),
    'H': hours,

    'mm': padding.call(String(minutes), 2, '0'),
    // 'mm': String(minutes).padding(2, '0'),
    'm': minutes,

    'ss': padding.call(String(seconds), 2, '0'),
    // 'ss': String(seconds).padding(2, '0'),
    's': seconds,
    
    // // date
    // 'd': String('00' + date).slice(-2),
    // 'D': WEEK[day].substr(0, 3),
    // 'j': date,
    // 'l': WEEK[day],
    
    // // month
    // 'm': String('00' + (month+1)).slice(-2),
    // 'M': MONTH[month].substr(0, 3),
    // 'n': (month+1),
    // 'F': MONTH[month],
    
    // // year
    // 'y': year.toString().substr(2, 2),
    // 'Y': year,
    
    // // time
    // 'G': hours,
    // 'H': String('00' + hours).slice(-2),
    // 'i': String('00' + minutes).slice(-2),
    // 's': String('00' + seconds).slice(-2),
    // 'S': String('000' + millseconds).slice(-3),
  };

  var regstr = '(' + Object.keys(patterns).join('|') + ')';
  var re = new RegExp(regstr, 'g');

  return pattern.replace(re, function(str) {
    return patterns[str];
  });
}

var dateExtensions = /*#__PURE__*/Object.freeze({
  __proto__: null,
  format: format$1
});

/**
 * @class global.Date
 * Dateクラスのstatic拡張
 */

/**
 * @method calculateAge
 * @static
 * 指定した誕生日から、現在または指定した日付における年齢を計算します。
 *
 * ###Reference
 * - [Javascriptで誕生日から現在の年齢を算出](http://qiita.com/n0bisuke/items/dd537bd4cbe9ab501ce8)
 *
 * ### Example
 *     Date.calculateAge("1990-01-17"); // => 26 など
 *
 * @param {String|Date} birthday 誕生日
 * @param {String|Date} [when=本日] 基準の日付
 * @return {Number} 年齢
 */
function calculateAge(birthday, when) {
// Date.$method('calculateAge', function(birthday, when) {
  // birthday
  if (typeof birthday === 'string') {
    birthday = new Date(birthday);
  }
  // when
  if (!when) {
    when = new Date();
  }
  else if (typeof when === 'string') {
    when = new Date(when);
  }

  var bn = new Date(birthday.getTime()).setFullYear(256);
  var wn = new Date(when.getTime()).setFullYear(256);
  var step = (wn < bn) ? 1 : 0;

  return (when.getFullYear() - birthday.getFullYear()) - step;
}

var dateStaticExtensions = /*#__PURE__*/Object.freeze({
  __proto__: null,
  calculateAge: calculateAge
});

/**
 * MouseEvent/Touch拡張
 * マウスのX座標.
 */
var pointX = {
  /** @this {MouseEvent|Touch} */
  get: function() {
    return this.clientX - /** @type {HTMLElement} */(this.target).getBoundingClientRect().left;
  }
};

/**
 * MouseEvent/Touch拡張
 * マウスのY座標.
 */
var pointY = {
  /** @this {MouseEvent|Touch} */
  get: function() {
    return this.clientY - /** @type {HTMLElement} */(this.target).getBoundingClientRect().top;
  }
};

/**
 * TouchEvent拡張
 * タッチイベントのX座標.
 */
var touchPointX = {
  /** @this {TouchEvent} */
  get: function() {
    return this.touches[0].clientX - /** @type {HTMLElement} */(this.target).getBoundingClientRect().left;
    // return this.touches[0].pageX - this.target.getBoundingClientRect().left - tm.global.scrollX;
  }
};

/**
 * TouchEvent拡張
 * タッチイベントのY座標.
 */
var touchPointY = {
  /** @this {TouchEvent} */
  get: function() {
    return this.touches[0].clientY - /** @type {HTMLElement} */(this.target).getBoundingClientRect().top;
    // return this.touches[0].pageY - this.target.getBoundingClientRect().top - tm.global.scrollY;
  }
};

/**
 * global.Event
 * 既存のEventオブジェクト拡張
 */

/**
 * @method stop
 * イベントのデフォルト処理 & 伝達を止める
 */
function stop() {
  // イベントキャンセル
  this.preventDefault();
  // イベント伝達を止める
  this.stopPropagation();
}


// ;(function() {

  // if (!phina.global.Event) return ;

  /**
   * @class global.Event
   * 既存のEventオブジェクト拡張
   */
    
  // /**
  //  * @method stop
  //  * イベントのデフォルト処理 & 伝達を止める
  //  */
  // Event.prototype.stop = function() {
  //   // イベントキャンセル
  //   this.preventDefault();
  //   // イベント伝達を止める
  //   this.stopPropagation();
  // };

// })();


// (function() {

//   if (!phina.global.MouseEvent) return ;

//   /**
//    * @class global.MouseEvent
//    * MouseEvent クラス
//    */
  
//   /**
//    * @method    pointX
//    * マウスのX座標.
//    */
//   MouseEvent.prototype.getter("pointX", function() {
//     return this.clientX - this.target.getBoundingClientRect().left;
//     // return this.pageX - this.target.getBoundingClientRect().left - window.scrollX;
//   });
  
//   /**
//    * @method    pointY
//    * マウスのY座標.
//    */
//   MouseEvent.prototype.getter("pointY", function() {
//     return this.clientY - this.target.getBoundingClientRect().top;
//     // return this.pageY - this.target.getBoundingClientRect().top - window.scrollY;
//   });
    
// })();


// (function() {
    
//   if (!phina.global.TouchEvent) return ;
  
  
//   /**
//    * @class global.TouchEvent
//    * TouchEvent クラス
//    */
  
//   /**
//    * @method    pointX
//    * タッチイベント.
//    */
//   TouchEvent.prototype.getter("pointX", function() {
//       return this.touches[0].clientX - this.target.getBoundingClientRect().left;
//       // return this.touches[0].pageX - this.target.getBoundingClientRect().left - tm.global.scrollX;
//   });
  
//   /**
//    * @method    pointY
//    * タッチイベント.
//    */
//   TouchEvent.prototype.getter("pointY", function() {
//       return this.touches[0].clientY - this.target.getBoundingClientRect().top;
//       // return this.touches[0].pageY - this.target.getBoundingClientRect().top - tm.global.scrollY;
//   });  
    
// })();


// (function() {
    
//   if (!phina.global.Touch) return ;
  
//   /**
//    * @class global.Touch
//    * TouchEvent クラス
//    */
  
//   /**
//    * @method    pointX
//    * タッチイベント.
//    */
//   Touch.prototype.getter("pointX", function() {
//       return this.clientX - this.target.getBoundingClientRect().left;
//   });

//   /**
//    * @method    pointY
//    * タッチイベント.
//    */
//   Touch.prototype.getter("pointY", function() {
//       return this.clientY - this.target.getBoundingClientRect().top;
//   });
    
// })();

/** @typedef {"Object"|"Array"|"ArrayStatic"|"Math"|"String"|"Number"|"Date"|"DateStatic"} ExtendableObjectType */
/** @typedef {{ [key in ExtendableObjectType]: any } } ObjectTypeMapForExtension */
/** @typedef {{ [key in ExtendableObjectType]: Function | import('./phina').AccessorExtendObject | number | string }} ExtensionMethodMap */

/**
 * カスタムメソッドを定義
 * @param {any} obj
 * @param {string} methodName
 * @param {function} func
 */
function _defineMethod(obj, methodName, func) {
  return $method.call(obj, methodName, func);
  // Object.defineProperty(obj, methodName, {
  //   value: func,
  //   enumerable: false,
  //   writable: true
  // })
}

/**
 * カスタムアクセサを定義
 * @param {any} obj
 * @param {string} accessorName
 * @param {import('./phina').AccessorExtendObject} extendObj
 */
function _defineAccessor(obj, accessorName, extendObj) {
  return accessor.call(obj, accessorName, extendObj);
}

/**
 * 汎用オブジェクト拡張関数
 * @param {any} targetObj 対象ビルトインオブジェクト ex) Array.prototype
 * @param {ExtensionMethodMap} extensionMap
 */
function _extend(targetObj, extensionMap) {
  Object.keys(extensionMap).forEach((key) => {
    var value = extensionMap[key];
    if (typeof value === "function") {
      _defineMethod(targetObj, key, value);
    } else if (typeof value === "object" && (value.get || value.set)) {
      _defineAccessor(targetObj, key, value);
    } else {
      // その他static値、Math.DEG_TO_RADなど
      targetObj[key] = value;
    }
  });
}

/**
 * オブジェクト名称 <-> 実際のオブジェクト
 * @type {ObjectTypeMapForExtension}
 */
var ExtendableObjectTypeMap = {
  Object: Object.prototype,
  Array: Array.prototype,
  ArrayStatic: Array,
  Math: Math, // MathはStaticのみ
  String: String.prototype,
  Number: Number.prototype,
  Date: Date.prototype,
  DateStatic: Date,
};

/**
 * オブジェクト名称 <-> 拡張メソッドマップ
 * @type {ObjectTypeMapForExtension}
 * */
var ExtensionTypeMap = {
  Object: objectExtensions,
  Array: arrayExtensions,
  ArrayStatic: arrayStaticExtensions,
  Math: mathExtensions,
  String: stringExtensions,
  Number: numberExtensions,
  Date: dateExtensions,
  DateStatic: dateStaticExtensions,
};

/**
 * Objectなどの標準組み込みオブジェクトの拡張を行う
 * - 引数無指定では全ての拡張を行う
 * - 拡張したいオブジェクト、メソッドを文字列で指定することも可能
 *
 * @example
 * // 全拡張（従来のphina.jsの状態）
 * extendBuiltInObject();
 *
 * // Numberオブジェクトの一部メソッドだけ拡張
 * extendBuiltInObject("Number", ["clamp", "upto"]);
 *
 * @param {ExtendableObjectType} [objectType] "Array"などの対象オブジェクト文字列
 * @param {string[]} [methodNameList] メソッド名文字列
 * @returns {void}
 */
function extendBuiltInObject(objectType, methodNameList) {
  if (!objectType) {
    // 拡張全てを一括で行う
    Object.keys(ExtendableObjectTypeMap).forEach((objType) => {
      _extend(ExtendableObjectTypeMap[objType], ExtensionTypeMap[objType]);
    });
    // _extend(Object.prototype, objectExtensions);
    // _extend(Array.prototype, arrayExtensions);
    // _extend(Array, arrayStaticExtensions);
    // _extend(String.prototype, stringExtensions);
    // _extend(Number.prototype, numberExtensions);
    // _extend(Math, mathExtensions);
    // _extend(Date.prototype, dateExtensions);
    // _extend(Date, dateStaticExtensions);
  } else {
    // 個別拡張
    var targetObject = ExtendableObjectTypeMap[objectType];
    if (!targetObject) {
      // `${objectType}は拡張可能対象ではありません`
      return;
    }
    if (methodNameList) {
      const exts = ExtensionTypeMap[objectType];

      /** @type ExtensionMethodMap */
      const methodMap = Object.create(null);
      methodNameList.forEach((methodName) => {
        if (!exts[methodName]) {
          // TODO: no method error
          return;
        }
        methodMap[methodName] = exts[methodName];
      });

      _extend(targetObject, methodMap);
    } else {
      // targetObjectの拡張全てを行う
      const exts = ExtensionTypeMap[objectType];
      _extend(targetObject, exts);
    }
  }
}

/**
 * dom/Event 一括拡張用メソッド
 */
function extendEventObject() {
  const getter$1 = getter;

  [MouseEvent, Touch].forEach((eventObject) => {
    getter$1.call(eventObject.prototype, "pointX", pointX.get);
    getter$1.call(eventObject.prototype, "pointY", pointY.get);
  });

  getter$1.call(TouchEvent.prototype, "pointX", touchPointX.get);
  getter$1.call(TouchEvent.prototype, "pointY", touchPointY.get);

  _defineMethod(Event.prototype, "stop", stop);
}

/**
 * カスタムイベントの基本パラメータ  
 * @typedef {Object} BasicEventObject
 * @property {string} type イベント名
 * @property {any} [target] イベント対象
 */

/**
 * イベントリスナとなる関数  
 * thisの参照は呼び出したオブジェクト自身となる
 * @callback PhinaEventHandler
 * @param {BasicEventObject & {[key:string]:any}} event BasicEventObjectに加え、自身で付け加えたデータをパラメータとして渡すことができる
 * @typedef {PhinaEventHandler} PhinaEventListener
 */

/**
 * @class phina.util.EventDispatcher
 * 
 * # イベントを扱うためのクラス
 * イベントを扱うためのメソッドやプロパティを定義しているクラスです。
 * phina.js が提供するクラスの多くはこの EventDispatcher クラスのサブクラスとなっているため、
 * ほとんどのクラスで容易にイベントを扱うことができます。
 *
 * 当クラスに`onhoge`のように`on~`という名前でメソッドを定義することで
 * イベントリスナを設定することもできるが、あまり推奨されない。
 * 呼び出される順序は、まずon~関数が呼び出され、その後 `on`メソッド で登録した順番。
 * 
 * @memberof phina
 */
class EventDispatcher {

  constructor() {
    /**
     * @private
     * @type {{[k: string]: PhinaEventHandler[]}}
     */
    this._listeners = {};
  }

  /**
   * イベントリスナを登録します。
   * 登録したイベントリスナは{@link #flare} や {@link #fire}を
   * 介して実行（発火）することができます。
   *
   * １つのイベントに対するイベントリスナはいくつでも登録することができます。
   *
   * いくつかのサブクラスについてはライブラリが特定条件下で発火するイベントがあります。
   * 例えば {@link #Object2D} クラスを継承したクラスではユーザーインタラクションに対して
   * "pointstart"などのイベントが発火されます。
   *
   * @example
   * const myObj = new EventDispatcher();
   * myObj.on("myevent", ()=> {
   *   console.log("Event 1");
   * });
   * myObj.on("myevent", ()=> {
   *   console.log("Event 2");
   * });
   * // イベント発火
   * myObj.flare("myevent"); // "Event 1" "Event 2"
   * 
   * @example
   * // thisはアクティブなSceneクラスのインスタンス
   * const shape = new CircleShape()
   *   .addChildTo(this)
   *   .setInteractive(true) // interactiveプロパティをtrueにする
   *   .setPosition(50, 50);
   * shape.on("pointstart", function(e) {
   *   console.log("Pointed shape");
   * });
   *
   * @chainable
   * 
   * @param {string} type イベントの種類
   * @param {PhinaEventHandler} listener イベントリスナとなる関数
   * @returns {this}
   */
  on(type, listener) {
    if (this._listeners[type] === undefined) {
      this._listeners[type] = [];
    }

    this._listeners[type].push(listener);
    return this;
  }

  /**
   * イベントリスナを削除します。
   * 
   * ある種類のイベントに対するイベントリスナをすべて削除するには {@link #clearEventListener} を使用してください。
   * 
   * @example
   * const myObj = new EventDispatcher();
   * const eventHandler = ()=> {
   *   console.log("Event fired!");
   * })
   * myObj.on("myevent", eventHandler);
   * 
   * // イベント発火
   * myObj.flare("myevent"); // "Event fired!"
   * 
   * // イベント削除
   * myObj.off("myevent", eventHandler);
   * 
   * @chainable
   * 
   * @param {string} type イベントの種類
   * @param {PhinaEventHandler} listener イベントリスナ関数
   * @returns {this}
   */
  off(type, listener) {
    var listeners = this._listeners[type];
    var index = listeners.indexOf(listener);
    if (index != -1) {
      listeners.splice(index,1);
    }
    return this;
  }

  /**
   * イベントパラメータオブジェクトを指定してイベントを発火します。
   * {@link #flare} の内部処理で使用、単独で使用することは稀
   * 
   * @example
   * const myObj = new EventDispatcher();
   * const fireParam = {type: "myevent"}
   * myObj.on("myevent", (e)=> {
   *   console.log(e); // {type: "myevent", target: myObj}
   *   console.log(e === fireParam); // -> true
   * });
   * 
   * myObj.fire(fireParam)
   * 
   * @chainable
   *
   * @param {BasicEventObject} e イベントパラメータオブジェクト
   * @returns {this}
   */
   fire(e) {
    e.target = this;
    var oldEventName = 'on' + e.type;
    if (this[oldEventName]) this[oldEventName](e);

    var listeners = this._listeners[e.type];
    if (listeners) {
      // var temp = listeners.clone();
      var temp = listeners.slice(0);
      for (var i=0,len=temp.length; i<len; ++i) {
          temp[i].call(this, e);
      }
    }

    return this;
  }

  /**
   * イベント名を指定してカスタムイベントを発火します。
   *
   * param 引数を指定することによりカスタムイベントに任意のプロパティを設定することができます。
   * これにより、呼び出し元がイベントリスナに任意の値を渡すことができます。
   * （ただし target プロパティには必ず自分自身が格納されます。）
   *
   * @example
   * const myObj = new EventDispatcher();
   * myObj.on("myevent", (e)=> {
   *   console.log(e); // {type: "myevent", target: myObj, foo: "foo"}
   * });
   * 
   * myObj.flare("myevent", {foo: "foo"});
   * 
   * @chainable
   *
   * @param {string} type カスタムイベントの名前
   * @param {any} [param] カスタムイベントにプロパティを設定するためのオブジェクト
   * @returns {this}
  */
  flare(type, param) {
    var e = {type:type};
    if (param) {
      forIn.call(param, function(key, val) {
      // param.forIn(function(key, val) {
        e[key] = val;
      });
    }
    this.fire(e);

    return this;
  }

  /**
   * 一度だけ実行されるイベントリスナを登録します。
   * 指定したイベントリスナが一度実行されると、そのイベントリスナは削除されます。
   * それ以外の挙動は {@link #on} と同じです。
   * 
   * @example
   * const myObj = new EventDispatcher();
   * myObj.one("fireonce", (e)=> {
   *   console.log("Event fired!");
   * });
   * 
   * myObj.flare("fireonce"); // "Event fired!"
   * myObj.flare("fireonce"); // イベントリスナは削除されているため、何も起きません
   * 
   * @chainable
   *
   * @param {string} type イベントの種類
   * @param {PhinaEventHandler} listener イベントリスナとなる関数
   * @returns {this}
   */
  one(type, listener) {
    var self = this;

    var func = function() {
      var result = listener.apply(self, arguments);
      self.off(type, func);
      return result;
    };

    this.on(type, func);

    return this;
  }

  /**
   * イベントリスナが登録されているかどうかを調べます。
   * 
   * 指定したイベントの種類に対するイベントリスナが登録されている場合は true、
   * そうでない場合は false を返します。
   *
   * @example
   * const myObj = new EventDispatcher();
   * myObj.on("myevent", (e)=> {
   *   console.log("Event fired!");
   * });
   * 
   * myObj.has("myevent"); // true
   * myObj.has("otherevent"); // false
   * 
   * @param {string} type イベントの種類
   * @return {boolean} 指定したイベントのイベントリスナが登録されているかどうか
   */
  has(type) {
    return (this._listeners[type] !== undefined && this._listeners[type].length !== 0) || !!this['on' + type];
  }

  /**
   * ある種類のイベントに対するイベントリスナをすべて削除します。
   *
   * 特定のイベントリスナのみを削除するには {@link #off} を使用してください。
   * 
   * @example
   * const myObj = new EventDispatcher();
   * myObj.on("myevent", (e)=> {
   *   console.log("Event fired!");
   * });
   * 
   * myObj.clearEventListener("myevent");
   * myObj.flare("myevent"); // イベントリスナは削除されているため、何も起きません
   * 
   * @chainable
   * 
   * @param {string} type イベントの種類
   * @returns {this}
   */
  clearEventListener(type) {
    var oldEventName = 'on' + type;
    if (this[oldEventName]) delete this[oldEventName];
    this._listeners[type] = [];
    return this;
  }
}

/**
 * 従来のclearメソッドも追加定義
 * サブクラス（Tweenerクラス等）でclearがオーバーライドされる場合、clearListenersを使用する
 */
$method.call(EventDispatcher.prototype, "clear", function(type) {
  // deprecatedメッセージ表示？
  return this.clearEventListener(type);
});

/**
 * @method addEventListener
 * {@link #on} のエイリアスです。
 */
/**
 * @method removeEventListener
 * {@link #off} のエイリアスです。
 */
/**
 * @method clearEventListener
 * {@link #clear} のエイリアスです。
 */
/**
 * @method hasEventListener
 * {@link #has} のエイリアスです。
 */
/**
 * @method dispatchEvent
 * {@link #fire} のエイリアスです。
 */
/**
 * @method dispatchEventByType
 * {@link #flare} のエイリアスです。
 */
const methodMap = {
  addEventListener: 'on',
  removeEventListener: 'off',
  hasEventListener: 'has',
  dispatchEvent: 'fire',
  dispatchEventByType: 'flare',
};
// methodMap.forIn(function(old, name) {
forIn.call(methodMap, function(old, name) {
  // EventDispatcher.prototype.$method(old, phina.util.EventDispatcher.prototype[name]);
  $method.call(EventDispatcher.prototype, old, EventDispatcher.prototype[name]);
});

/**
 * @class phina.util.Flow
 * tick management class
 * _extends phina.util.EventDispatcher
 */
class Flow extends EventDispatcher {

  /**
   * @constructor
   * @param {{ (resolve: Function, reject: Function): void; }} func
   * @param {boolean} [wait]
   */
  constructor(func, wait) {
    super();

    /** @type {"pending" | "resolved" | "rejected"} */
    this.status = 'pending';

    /** @type {any} */
    this.resultValue = null;

    /** @type {Function[]} */
    this._queue = [];

    this.func = func;

    if (wait !== true) {
      var self = this;
      var resolve = function() {
        self.resolve.apply(self, arguments);
        self.status = 'resolved';
      };
      var reject = function() {
        self.reject.apply(self, arguments);
        self.status = 'rejected';
      };

      this.func(resolve, reject);
    }
  }

  /**
   * @private おそらく
   * 成功
   */
  resolve(arg) {
    this.resultValue = arg;

    // キューに積まれた関数を実行
    this._queue.forEach(function(func) {
      func(this.resultValue);
    }, this);
    // this._queue.clear();
    clear.call(this._queue);
  }

  /**
   * @private おそらく
   * 失敗
   */
  reject() {

  }

  /**
   * 非同期終了時の処理を登録
   * @param {{(result: any): any}} func
   * @returns {Flow}
   */
  then(func) {
    // 成功ステータスだった場合は即実行
    if (this.status === 'resolved') {
      var value = func(this.resultValue);
      return Flow.resolve(value);
    }
    else {
      var flow = new Flow(function(resolve) {
        resolve();
      }, true);

      this._queue.push(function(arg) {
        var resultValue = func(arg);

        if (resultValue instanceof Flow) {
          resultValue.then(function(value) {
            flow.resolve(value);
          });
        }
        else {
          flow.resolve(resultValue);
        }
      });

      return flow;
    }
  }

  /**
   * @param {Flow | any} value
   * @returns {Flow}
   */
  static resolve(value) {
    if (value instanceof Flow) {
      return value;
    }
    else {
      var flow = new Flow(function(resolve) {
        resolve(value);
      });
      return flow;
    }
  }

  /**
   * @param {Flow[]} flows
   * @returns {Flow}
   */
  static all(flows) {
    return new Flow(function(resolve) {
      var count = 0;

      var args = [];

      flows.forEach(function(flow) {
        flow.then(function(d) {
          ++count;
          args.push(d);

          if (count >= flows.length) {
            resolve(args);
          }
        });
      });
    });
  }

}

/**
 * @class phina.util.Ticker
 * tick management class
 * _extends phina.util.EventDispatcher
 */
class Ticker extends EventDispatcher {

  // /** 経過フレーム数 */
  // frame = null

  // /** 1フレームの経過時間 */
  // deltaTime = null
  
  // /** 全体の経過時間 */
  // elapsedTime = null

  /**
   * @constructor
   */
  constructor() {
    super();

    /**
     * @private
     * @type {number}
     */
    this._fps;

    this.fps = 30;
    this.frame = 0;
    this.deltaTime = 0;
    this.elapsedTime = 0;
    this.isPlaying = true;
    this.runner = Ticker.runner;
  }

  /**
   * ティック処理毎に実行されるイベントハンドラを設定
   * @param {import("./eventdispatcher").PhinaEventListener} func 
   */
  tick(func) {
    this.on('tick', func);
  }

  /**
   * イベントハンドラを解除
   * @param {import("./eventdispatcher").PhinaEventListener} func 
   */
  untick(func) {
    this.off('tick', func);
  }

  /**
   * 経過時間を計測・記録しながらティック処理（アプリ更新処理）を行う
   * @returns {number} 次の更新処理までの待ち時間
   */
  run() {
    var now = (new Date()).getTime();
    // 1フレームに掛かった時間
    this.deltaTime = now - this.currentTime;
    // 全体の経過時間
    this.elapsedTime = now - this.startTime;

    var start = this.currentTime = now;
    this.flare('tick');
    var end = (new Date()).getTime();

    // フレームを更新
    this.frame += 1;

    // calculate elapsed time
    var elapsed = end-start;

    // calculate next waiting time
    var delay = Math.max(this.frameTime-elapsed, 0);

    return delay;
  }

  start() {
    var self = this;
    this.isPlaying = true;
    this.startTime = this.currentTime = (new Date()).getTime();
    var fn = function() {
      if (self.isPlaying) {
        var delay = self.run();
        self.runner(fn, delay);
      }
    };
    fn();

    return this;
  }

  resume() {
    // TODO: 
  }

  stop() {
    this.isPlaying = false;
    return this;
  }

  rewind() {
    // TODO: 
  }

  get fps() { return this._fps; }
  set fps(v) {
    this._fps = v;
    this.frameTime = 1000/this._fps;
  }

  /**
   * @param {TimerHandler} run
   * @param {number} delay
   */
  static runner(run, delay) {
    setTimeout(run, delay);
  }
  
}

/**
 * @class phina.util.Random
 * # 乱数を扱うためのクラス
 * 乱数を扱うためのメソッドやプロパティを定義しているクラスです。
 */
class Random {

  /**
   * @constructor
   * コンストラクタです。引数で {@link #seed} を設定できます。
   * 
   * @param {Number} [seed = (Date.now()) || 1] シード
   */
  constructor(seed) {
    /**
     * @private
     * @type {number}
     */
    this._seed;

    /**
     * @property {Number} [seed = 1]
     * 乱数のシードです。
     */
    this.seed = seed || (Date.now()) || 1;
  }

  /**
   * @method random
   * 0~1の乱数を返します。実行すると {@link #seed} は変わってしまいます。
   * 
   * @return {Number} 0~1 の乱数
   */
  random() {
    var seed = this.seed;
    seed = seed ^ (seed << 13);
    seed = seed ^ (seed >>> 17);
    seed = (seed ^ (seed << 5));

    this.seed = seed;

    return (seed >>> 0) / Random.MAX;
  }

  /**
   * @method randint
   * 指定された範囲内でランダムな整数値を返します。実行すると {@link #seed} は変わってしまいます。
   * 
   * @param {Number} min 範囲の最小値
   * @param {Number} max 範囲の最大値
   * @return {Number} ランダムな整数値
   */
  randint(min, max) {
    return Math.floor( this.random()*(max-min+1) ) + min;
  }

  /**
   * @method randfloat
   * 指定された範囲内でランダムな数値を返します。実行すると {@link #seed} は変わってしまいます。
   * 
   * @param {Number} min 範囲の最小値
   * @param {Number} max 範囲の最大値
   * @return {Number} ランダムな数値
   */
  randfloat(min, max) {
    return this.random()*(max-min)+min;
  }

  /**
   * @method randbool
   * ランダムな真偽値を返します。引数で百分率を指定できます。実行すると {@link #seed} は変わってしまいます。
   * 
   * @param {Number} [percent = 50] 真になる百分率
   * @return {Boolean} ランダムな真偽値
   */
  randbool(percent) {
    return this.random() < (percent === undefined ? 50 : percent) / 100;
  }

  /**
   * @method randarray
   * 任意の範囲でランダムな整数値を格納した任意の長さの配列を返します。実行すると {@link #seed} は変わってしまいます。
   * 
   * @param {Number} [len = 100] 配列の長さ
   * @param {Number} [min = 0] 範囲の最小値
   * @param {Number} [max = 100] 範囲の最大値
   * @return {Number} ランダムな整数値の入った配列
   */
  randarray(len, min, max) {
    len = len || 100;
    min = min || 0;
    max = max || 100;

    return map.call(len, function() {
    // return (len).map(function() {
      return this.randint(min, max);
    }, this);
  }

  get seed() { return this._seed; }
  set seed(v) { this._seed = (v >>> 0) || 1; }

  /**
   * @method getSeed 
   * {@link #seed} の値を取得します。
   * 
   * @return {Number} シード
   * @static
   */
  static getSeed() {
    return this.seed;
  }

  /**
   * @method setSeed
   * {@link #seed} の値をセットします。
   * 
   * @param {Number} [seed = 1] シード
   * @static
   * @chainable
   */
  static setSeed(seed) {
    this.seed = (seed >>> 0) || 1;
    return this;
  }

  /**
   * @method random
   * 0~1の乱数を返します。実行すると {@link #seed} は変わってしまいます。
   * インスタンスメソッドの {@link #random} と同じです。
   * 
   * @return {Number} 0~1 の乱数
   * @static
   */
  static random() {
    this.seed = this.xor32(this.seed);
    return (this.seed >>> 0) / this.MAX;
  }

  /**
   * @method randint
   * 指定された範囲内でランダムな整数値を返します。実行すると {@link #seed} は変わってしまいます。
   * インスタンスメソッドの {@link #randint} と同じです。
   * 
   * @param {Number} min 範囲の最小値
   * @param {Number} max 範囲の最大値
   * @return {Number} ランダムな整数値
   * @static
   */
  static randint(min, max) {
    return phina.global.Math.floor( this.random()*(max-min+1) ) + min;
  }

  /**
   * @method randfloat
   * 指定された範囲内でランダムな数値を返します。実行すると {@link #seed} は変わってしまいます。
   * インスタンスメソッドの {@link #randfloat} と同じです。
   * 
   * @param {Number} min 範囲の最小値
   * @param {Number} max 範囲の最大値
   * @return {Number} ランダムな数値
   * @static
   */
  static randfloat(min, max) {
    return this.random()*(max-min)+min;
  }

  /**
   * @method randbool
   * ランダムな真偽値を返します。引数で百分率を指定できます。実行すると {@link #seed} は変わってしまいます。
   * インスタンスメソッドの {@link #randbool} と同じです。
   * 
   * @param {Number} [percent = 50] 真になる百分率
   * @return {Boolean} ランダムな真偽値
   * @static
   */
  static randbool(percent) {
    return this.randint(0, 99) < (percent || 50);
  }

  /**
   * @method randarray
   * 任意の範囲でランダムな整数値を格納した任意の長さの配列を返します。実行すると {@link #seed} は変わってしまいます。
   * インスタンスメソッドの {@link #randarray} と同じです。
   * 
   * @param {Number} [len = 100] 配列の長さ
   * @param {Number} [min = 0] 範囲の最小値
   * @param {Number} [max = 100] 範囲の最大値
   * @return {Number} ランダムな整数値の入った配列
   * @static
   */
  static randarray(len, min, max) {
    len = len || 100;
    min = min || 0;
    max = max || 100;

    return map.call(len, function() {
    // return (len).map(function() {
      return this.randint(min, max);
    }, this);
  }


  /**
   * @method xor32
   * xorshift を用いて疑似乱数列を生成します。
   * 
   * @param {Number} seed
   * @return {Number} 疑似乱数列
   * @static
   */
  static xor32(seed) {
    seed = seed ^ (seed << 13);
    seed = seed ^ (seed >>> 17);
    seed = (seed ^ (seed << 5));

    return seed;
  }

  /**
   * @method uuid
   * uuid を生成して返します。
   * 
   * @return {String} uuid
   * @static
   */
  //http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
  static uuid() {
    var d = new Date().getTime();
    if(phina.global.performance && typeof phina.global.performance.now === 'function'){
      d += performance.now(); //use high-precision timer if available
    }
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random()*16)%16 | 0;
      d = Math.floor(d/16);
      return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
  }

}

/**
 * @property {Number} MAX
 * 内部的に使用される定数です。
 * 
 * @static
 */
Random.MAX = 4294967295;

/**
 * @property {Number} [seed = (Date.now())] シード
 * static メソッドの乱数のシードです。
 * 
 * @static
 */
Random.seed = (Date.now());


// prototype拡張はしない
// Math.$method("randint", function(min, max) {
//   return phina.util.Random.randint(min, max);
// });

// Math.$method("randfloat", function(min, max) {
//   return phina.util.Random.randfloat(min, max);
// });

/**
 * @class phina.util.Support
 * 
 */
class Support {}Support.canvas = !!phina.global.CanvasRenderingContext2D;
Support.webGL = (function() {
  return !!phina.global.CanvasRenderingContext2D && !!document.createElement('canvas').getContext('webgl');
})();
Support.webAudio = !!phina.global.AudioContext || !!phina.global['webkitAudioContext'] || !!phina.global['mozAudioContext'];

/**
 * @typedef {{
 *  width?: number;
 *  columns?: number;
 *  loop?: boolean;
 *  offset?: number;
 * }} GridOptions
 */

/**
 * @class phina.util.Grid
 */
class Grid {

  /**
   * @constructor
   * @param {GridOptions | number} _optionsOrWidth
   * @param {number} [_col]
   * @param {boolean} [_loop]
   * @param {number} [_offset]
   */
  constructor(_optionsOrWidth, _col, _loop, _offset) {
    var width, columns, loop, offset;
    if (typeof arguments[0] === 'object') {
      /** @type {GridOptions} */
      var param = arguments[0];
      width = param.width || 640;
      columns = param.columns || 12;
      loop = param.loop || false;
      offset = param.offset || 0;
    }
    else {
      width   = arguments[0] || 640;
      columns = arguments[1] || 12;
      loop    = arguments[2] || false;
      offset = arguments[3] || 0;
    }

    /** @type {number} 幅 */
    this.width = width;

    /** @type {number} 列数 */
    this.columns = columns;

    /** @type {boolean} span指定時にループするかどうか */
    this.loop = loop;

    /** @type {number} オフセット値 */
    this.offset = offset;

    /** @type {number} グリッド単位値 */
    this.unitWidth = this.width/this.columns;
  }

  /**
   * スパン指定で値を取得(負数もok)
   * @param {number} index
   * @returns {number}
   */
  span(index) {
    if (this.loop) {
      index += this.columns;
      index %= this.columns;
    }
    return this.unitWidth * index + this.offset;
  }

  /**
   * グリッド単位を返す
   * @returns {number}
   */
  unit() {
    return this.unitWidth;
  }

  /**
   * @param {number} [offset] 中心からのずれを単位数で指定
   * @returns {number}
   */
  center(offset) {
    var index = offset || 0;
    return (this.width/2) + (this.unitWidth * index);
  }

}

/**
 * @typedef {keyof Tween.EASING} TweenEasingType イージングの種類を表す文字列
 */

/**
 * @class phina.util.Tween
 * _extends phina.util.EventDispatcher
 * 
 */
class Tween extends EventDispatcher {

  /**
   * @constructor
   */
  constructor() {
    super();

    /**
     * @type {number}
     * tween経過時間
     */
    this.time = 0;

    /**
     * @private
     * @type {function|string}
     * 内部イージング関数
     * easingアクセサを介して使用  
     * setterがstring型を受け付けるのに対し、
     * getterはfunction型を返すため、とりあえず共用体とする
     */
    this._easing;
  }

  /**
   * @param {any} target
   * @param {{ [k: string]: any; }} beginProps
   * @param {{ [k: string]: any; }} finishProps
   * @param {number} duration
   * @param {TweenEasingType} easing
   * @returns {this}
   */
  fromTo(target, beginProps, finishProps, duration, easing) {
    this.target = target;
    this.beginProps = beginProps;
    this.finishProps = finishProps;
    this.duration = duration || 1000;
    this.easing = easing;

    // setup
    this.changeProps = {};
    for (var key in beginProps) {
        this.changeProps[key] = finishProps[key] - beginProps[key];
    }

    return this;
  }

  /**
   * @param {any} target
   * @param {{ [k: string]: any; }} finishProps
   * @param {number} duration
   * @param {TweenEasingType} easing
   * @returns {this}
   */
  to(target, finishProps, duration, easing) {
    var beginProps = {};

    for (var key in finishProps) {
      beginProps[key] = target[key];
    }

    this.fromTo(target, beginProps, finishProps, duration, easing);

    return this;
  }

  /**
   * @param {any} target
   * @param {{ [k: string]: any; }} beginProps
   * @param {number} duration
   * @param {TweenEasingType} easing
   * @returns {this}
   */
  from(target, beginProps, duration, easing) {
      var finishProps = {};

      for (var key in beginProps) {
        finishProps[key] = target[key];
        target[key] = beginProps[key];
      }

      this.fromTo(target, beginProps, finishProps, duration, easing);

      return this;
  }

  /**
   * @param {any} target
   * @param {{ [k: string]: any; }} props
   * @param {number} duration
   * @param {TweenEasingType} easing
   * @returns {this}
   */
  by(target, props, duration, easing) {
    var beginProps = {};
    var finishProps = {};

    for (var key in props) {
      beginProps[key] = target[key];
      finishProps[key] = target[key] + props[key];
    }

    this.fromTo(target, beginProps, finishProps, duration, easing);

    return this;
  }

  /**
   * TODO
   */
  yoyo() {
    var temp = this.beginProps;
    this.beginProps = this.finishProps;
    this.finishProps = temp;
    // this.changeProps.forIn(function(key, value, index) {
    forIn.call(this.changeProps, function(key, value, _index) {
      this.changeProps[key] = -value;
      this.target[key] = this.beginProps[key];
    }, this);
    // TODO: easing も反転させる
    // this.easing = easing;
    return this;
  }

  /**
   * 指定値分、時間を進める
   * @alias forward
   * @param {number} time
   */
  gain(time) {
    this.seek(this.time + time);
  }

  /**
   * 指定値分、時間を進める
   * @alias gain
   * @param {number} time
   */
  forward(time) {
    this.seek(this.time + time);
  }

  /**
   * 指定値分、時間を戻す
   * @param {number} time
   */
  backward(time) {
    this.seek(this.time - time);
  }

  /**
   * 時間に応じてパラメータを更新
   * @param {number} time
   * @returns {this}
   */
  seek(time) {
    // this.time = Math.clamp(time, 0, this.duration);
    this.time = clamp(time, 0, this.duration);

    // this.beginProps.forIn(
    forIn.call(this.beginProps, 
    /** @this Tween */
    function(key, value) {
      var v = /** @type function */(this.easing)(this.time, value, this.changeProps[key], this.duration);
      this.target[key] = v;
    }, this);

    return this;
  }

  get easing() { return this._easing; }
  set easing(v) {
    this._easing = Tween.EASING[/**@type {string}*/(v)] || Tween.EASING.default;
  }

}

/**
 * @static
 * イージング
 * ### Reference
 * - <http://coderepos.org/share/wiki/JSTweener>
 * - <http://coderepos.org/share/browser/lang/javascript/jstweener/trunk/src/JSTweener.js>
 * - <http://gsgd.co.uk/sandbox/jquery/easing/jquery.easing.1.3.js>
 * - <http://hosted.zeh.com.br/tweener/docs/en-us/misc/transitions.html>
 */
Tween.EASING = {

  /** default */
  "default": function(t, b, c, d) {
    return c*t/d + b;
  },
  /** linear */
  linear: function(t, b, c, d) {
    return c*t/d + b;
  },
  /** swing */
  swing: function(t, b, c, d) {
    return -c *(t/=d)*(t-2) + b;
  },
  /** easeInQuad */
  easeInQuad: function(t, b, c, d) {
    return c*(t/=d)*t + b;
  },
  /** easeOutQuad */
  easeOutQuad: function(t, b, c, d) {
    return -c *(t/=d)*(t-2) + b;
  },
  /** easeInOutQuad */
  easeInOutQuad: function(t, b, c, d) {
    if((t/=d/2) < 1) return c/2*t*t + b;
    return -c/2 *((--t)*(t-2) - 1) + b;
  },
  /** defeInCubic */
  easeInCubic: function(t, b, c, d) {
    return c*(t/=d)*t*t + b;
  },
  /** easeOutCubic */
  easeOutCubic: function(t, b, c, d) {
    return c*((t=t/d-1)*t*t + 1) + b;
  },
  /** easeInOutCubic */
  easeInOutCubic: function(t, b, c, d) {
    if((t/=d/2) < 1) return c/2*t*t*t + b;
    return c/2*((t-=2)*t*t + 2) + b;
  },
  /** easeOutInCubic */
  easeOutInCubic: function(t, b, c, d) {
    if(t < d/2) return Tween.EASING.easeOutCubic(t*2, b, c/2, d);
    return Tween.EASING.easeInCubic((t*2)-d, b+c/2, c/2, d);
  },
  /** easeInQuart */
  easeInQuart: function(t, b, c, d) {
    return c*(t/=d)*t*t*t + b;
  },
  /** easeOutQuart */
  easeOutQuart: function(t, b, c, d) {
    return -c *((t=t/d-1)*t*t*t - 1) + b;
  },
  /** easeInOutQuart */
  easeInOutQuart: function(t, b, c, d) {
    if((t/=d/2) < 1) return c/2*t*t*t*t + b;
    return -c/2 *((t-=2)*t*t*t - 2) + b;
  },
  /** easeOutInQuart */
  easeOutInQuart: function(t, b, c, d) {
    if(t < d/2) return Tween.EASING.easeOutQuart(t*2, b, c/2, d);
    return Tween.EASING.easeInQuart((t*2)-d, b+c/2, c/2, d);
  },
  /** easeInQuint */
  easeInQuint: function(t, b, c, d) {
    return c*(t/=d)*t*t*t*t + b;
  },
  /** easeOutQuint */
  easeOutQuint: function(t, b, c, d) {
    return c*((t=t/d-1)*t*t*t*t + 1) + b;
  },
  /** easeInOutQuint */
  easeInOutQuint: function(t, b, c, d) {
    if((t/=d/2) < 1) return c/2*t*t*t*t*t + b;
    return c/2*((t-=2)*t*t*t*t + 2) + b;
  },
  /** easeOutInQuint */
  easeOutInQuint: function(t, b, c, d) {
    if(t < d/2) return Tween.EASING.easeOutQuint(t*2, b, c/2, d);
    return Tween.EASING.easeInQuint((t*2)-d, b+c/2, c/2, d);
  },
  /** easeInSine */
  easeInSine: function(t, b, c, d) {
    return -c * Math.cos(t/d *(Math.PI/2)) + c + b;
  },
  /** easeOutSine */
  easeOutSine: function(t, b, c, d) {
    return c * Math.sin(t/d *(Math.PI/2)) + b;
  },
  /** easeInOutSine */
  easeInOutSine: function(t, b, c, d) {
    return -c/2 *(Math.cos(Math.PI*t/d) - 1) + b;
  },
  /** easeOutInSine */
  easeOutInSine: function(t, b, c, d) {
    if(t < d/2) return Tween.EASING.easeOutSine(t*2, b, c/2, d);
    return Tween.EASING.easeInSine((t*2)-d, b+c/2, c/2, d);
  },
  /** easeInExpo */
  easeInExpo: function(t, b, c, d) {
    return (t==0) ? b : c * Math.pow(2, 10 *(t/d - 1)) + b - c * 0.001;
  },
  /** easeOutExpo */
  easeOutExpo: function(t, b, c, d) {
    return (t==d) ? b+c : c * 1.001 *(-Math.pow(2, -10 * t/d) + 1) + b;
  },
  /** easeInOutExpo */
  easeInOutExpo: function(t, b, c, d) {
    if(t==0) return b;
    if(t==d) return b+c;
    if((t/=d/2) < 1) return c/2 * Math.pow(2, 10 *(t - 1)) + b - c * 0.0005;
    return c/2 * 1.0005 *(-Math.pow(2, -10 * --t) + 2) + b;
  },
  /** easeOutInExpo */
  easeOutInExpo: function(t, b, c, d) {
    if(t < d/2) return Tween.EASING.easeOutExpo(t*2, b, c/2, d);
    return Tween.EASING.easeInExpo((t*2)-d, b+c/2, c/2, d);
  },
  /** easeInCirc */
  easeInCirc: function(t, b, c, d) {
    return -c *(Math.sqrt(1 -(t/=d)*t) - 1) + b;
  },
  /** easeOutCirc */
  easeOutCirc: function(t, b, c, d) {
    return c * Math.sqrt(1 -(t=t/d-1)*t) + b;
  },
  /** easeInOutCirc */
  easeInOutCirc: function(t, b, c, d) {
    if((t/=d/2) < 1) return -c/2 *(Math.sqrt(1 - t*t) - 1) + b;
    return c/2 *(Math.sqrt(1 -(t-=2)*t) + 1) + b;
  },
  /** easeOutInCirc */
  easeOutInCirc: function(t, b, c, d) {
    if(t < d/2) return Tween.EASING.easeOutCirc(t*2, b, c/2, d);
    return Tween.EASING.easeInCirc((t*2)-d, b+c/2, c/2, d);
  },
  /** easeInElastic */
  easeInElastic: function(t, b, c, d, a, p) {
    var s;
    if(t==0) return b;  if((t/=d)==1) return b+c;  if(!p) p=d*.3;
    if(!a || a < Math.abs(c)) { a=c; s=p/4; } else s = p/(2*Math.PI) * Math.asin(c/a);
    return -(a*Math.pow(2,10*(t-=1)) * Math.sin((t*d-s)*(2*Math.PI)/p )) + b;
  },
  /** easeOutElastic */
  easeOutElastic: function(t, b, c, d, a, p) {
    var s;
    if(t==0) return b;  if((t/=d)==1) return b+c;  if(!p) p=d*.3;
    if(!a || a < Math.abs(c)) { a=c; s=p/4; } else s = p/(2*Math.PI) * Math.asin(c/a);
    return(a*Math.pow(2,-10*t) * Math.sin((t*d-s)*(2*Math.PI)/p ) + c + b);
  },
  /** easeInOutElastic */
  easeInOutElastic: function(t, b, c, d, a, p) {
    var s;
    if(t==0) return b;  if((t/=d/2)==2) return b+c;  if(!p) p=d*(.3*1.5);
    if(!a || a < Math.abs(c)) { a=c; s=p/4; }       else s = p/(2*Math.PI) * Math.asin(c/a);
    if(t < 1) return -.5*(a*Math.pow(2,10*(t-=1)) * Math.sin((t*d-s)*(2*Math.PI)/p )) + b;
    return a*Math.pow(2,-10*(t-=1)) * Math.sin((t*d-s)*(2*Math.PI)/p )*.5 + c + b;
  },
  /** easeOutInElastic */
  easeOutInElastic: function(t, b, c, d, a, p) {
    if(t < d/2) return Tween.EASING.easeOutElastic(t*2, b, c/2, d, a, p);
    return Tween.EASING.easeInElastic((t*2)-d, b+c/2, c/2, d, a, p);
  },
  /** easeInBack */
  easeInBack: function(t, b, c, d, s) {
    if(s == undefined) s = 1.70158;
    return c*(t/=d)*t*((s+1)*t - s) + b;
  },
  /** easeOutBack */
  easeOutBack: function(t, b, c, d, s) {
    if(s == undefined) s = 1.70158;
    return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;
  },
  /** easeInOutBack */
  easeInOutBack: function(t, b, c, d, s) {
    if(s == undefined) s = 1.70158;
    if((t/=d/2) < 1) return c/2*(t*t*(((s*=(1.525))+1)*t - s)) + b;
    return c/2*((t-=2)*t*(((s*=(1.525))+1)*t + s) + 2) + b;
  },
  /** easeOutInBack */
  easeOutInBack: function(t, b, c, d, s) {
    if(t < d/2) return Tween.EASING.easeOutBack(t*2, b, c/2, d, s);
    return Tween.EASING.easeInBack((t*2)-d, b+c/2, c/2, d, s);
  },
  /** easeInBounce */
  easeInBounce: function(t, b, c, d) {
    return c - Tween.EASING.easeOutBounce(d-t, 0, c, d) + b;
  },
  /** easeOutBounce */
  easeOutBounce: function(t, b, c, d) {
    if((t/=d) <(1/2.75)) {
      return c*(7.5625*t*t) + b;
    } else if(t <(2/2.75)) {
      return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b;
    } else if(t <(2.5/2.75)) {
      return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b;
    } else {
      return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b;
    }
  },
  /** easeInOutBounce */
  easeInOutBounce: function(t, b, c, d) {
    if(t < d/2) return Tween.EASING.easeInBounce(t*2, 0, c, d) * .5 + b;
    else return Tween.EASING.easeOutBounce(t*2-d, 0, c, d) * .5 + c*.5 + b;
  },
  /** easeOutInBounce */
  easeOutInBounce: function(t, b, c, d) {
    if(t < d/2) return Tween.EASING.easeOutBounce(t*2, b, c/2, d);
    return Tween.EASING.easeInBounce((t*2)-d, b+c/2, c/2, d);
  }

};

/**
 * @class phina.util.QueryString
 * 
 */
class QueryString {

  /**
   * @param {string} [text] 無指定のときは現在ページのURLを対象とする
   * @param {string} [sep="&"] セパレータ
   * @param {string} [eq="="] 
   * @param {boolean} [isDecode] decodeURIComponentによるデコードを行うかどうか
   * @returns {Object}
   */
  static parse(text, sep, eq, isDecode) {
    text = text || location.search.substr(1);
    sep = sep || '&';
    eq = eq || '=';
    var decode = (isDecode) ? decodeURIComponent : function(a) { return a; };
    return text.split(sep).reduce(function(obj, v) {
      var pair = v.split(eq);
      obj[pair[0]] = decode(pair[1]);
      return obj;
    }, {});
  }

  /**
   * @param {Object} value
   * @param {string} [sep="&"]
   * @param {string} [eq="="]
   * @param {boolean} [isEncode] encodeURIComponentによるエンコードを行うかどうか
   * @returns {string}
   */
  static stringify(value, sep, eq, isEncode) {
    sep = sep || '&';
    eq = eq || '=';
    var encode = (isEncode) ? encodeURIComponent : function(a) { return a; };
    return Object.keys(value).map(function(key) {
      return key + eq + encode(value[key]);
    }).join(sep);
  }
  
}

/**
 * @class phina.util.Color
 * カラークラス
 */
class Color {

  /**
   * @param {number} _r
   * @param {number} _g
   * @param {number} _b
   * @param {number} _a
   */
  constructor(_r, _g, _b, _a) {
    /** @type {number} R値 */
    this.r = 255;

    /** @type {number} G値 */
    this.g = 255;

    /** @type {number} B値 */
    this.b = 255;

    /** @type {number} A値 */
    this.a = 1.0;

    this.set.apply(this, arguments);
  }

  /**
   * セッター.
   * @param {number} r
   * @param {number} g
   * @param {number} b
   * @param {number} a
   * @returns {this}
   */
  set(r, g, b, a) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = (a !== undefined) ? a : 1.0;
    return this;
  }

  /**
   * 数値によるセッター.
   * @param {number} r
   * @param {number} g
   * @param {number} b
   * @param {number} a
   * @returns {this}
   */
  setFromNumber(r, g, b, a) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = (a !== undefined) ? a : 1.0;
    return this;
  }

  /**
   * 配列によるセッター
   * @param {number[]} arr
   * @returns {this}
   */
  setFromArray(arr) {
    return this.set.apply(this, arr);
  }

  /**
   * オブジェクトによるセッター
   * @param {{ r: number; g: number; b: number; a: number; }} obj
   * @returns {this}
   */
  setFromObject(obj) {
    return this.set(obj.r, obj.g, obj.b, obj.a);
  }

  /**
   * 文字列によるセッター
   * @param {string} str
   * @returns {this}
   */
  setFromString(str) {
    var color = Color.stringToNumber(str);
    return this.set(color[0], color[1], color[2], color[3]);
  }

  /**
   * 賢いセッター
   * @returns {this}
   */
  setSmart() {
    var arg = arguments[0];
    if (arguments.length >= 3) {
      this.set(arguments[0], arguments[1], arguments[2], arguments[3]);
    } else if (arg instanceof Array) {
      this.setFromArray(arg);
    } else if (arg instanceof Object) {
      this.setFromObject(arg);
    } else if (typeof(arg) == "string") {
      this.setFromString(arg);
    }
    return this;
  }

  /**
   * CSS 用 16進数文字列に変換
   * @returns {string}
   */
  toStyleAsHex() {
    return format.call("#{0}{1}{2}",
    // return "#{0}{1}{2}".format(
      padding.call(this.r.toString(16), 2, '0'),
      padding.call(this.g.toString(16), 2, '0'),
      padding.call(this.b.toString(16), 2, '0')
      // this.r.toString(16).padding(2, '0'),
      // this.g.toString(16).padding(2, '0'),
      // this.b.toString(16).padding(2, '0')
    );
  }

  /**
   * CSS 用 RGB文字列に変換
   * @returns {string}
   */
  toStyleAsRGB() {
    return format.call("rgb({r},{g},{b})", {
    // return "rgb({r},{g},{b})".format({
      r: ~~this.r,
      g: ~~this.g,
      b: ~~this.b
    });
  }


  /**
   * CSS 用 RGBA文字列に変換
   * @returns {string}
   */
  toStyleAsRGBA() {
    return format.call("rgba({r},{g},{b},{a})", {
    // return "rgba({r},{g},{b},{a})".format({
      r: ~~this.r,
      g: ~~this.g,
      b: ~~this.b,
      a: this.a
    });
  }

  /**
   * CSS 用 RGBA 文字列に変換
   * @returns {string}
   */
  toStyle() {
    return format.call("rgba({r},{g},{b},{a})", {
    // return "rgba({r},{g},{b},{a})".format({
      r: ~~this.r,
      g: ~~this.g,
      b: ~~this.b,
      a: this.a
    });
  }

  /**
   * @static
   * @member phina.util.Color
   * @method strToNum
   * @param {string} str
   * @returns {number[]}
   */
  static strToNum(str) {
    return this.stringToNumber(str);
  }

  /**
   * @param {string} str
   * @returns {number[]}
   */
  static stringToNumber(str) {
    var value = null;
    var type = null;

    if (str[0] === '#') {
      type = (str.length == 4) ? "hex111" : "hex222";
    } else if (str[0] === 'r' && str[1] === 'g' && str[2] === 'b') {
      type = (str[3] == 'a') ? "rgba" : "rgb";
    } else if (str[0] === 'h' && str[1] === 's' && str[2] === 'l') {
      type = (str[3] == 'a') ? "hsla" : "hsl";
    }

    if (type) {
      var match_set = MATCH_SET_LIST[type];
      var m = str.match(match_set.reg);
      value = match_set.exec(m);
    } else if (Color.COLOR_LIST[str]) {
      value = Color.COLOR_LIST[str];
    }

    return value;
  }

  /**
   * @static
   * @method
   * hsl を rgb に変換
   * 
   * @param {number} h
   * @param {number} s
   * @param {number} l
   * @returns {number[]} rgb数値配列
   */
  static HSLtoRGB(h, s, l) {
    var r, g, b;

    h %= 360;
    h += 360;
    h %= 360;
    s *= 0.01;
    l *= 0.01;

    if (s === 0) {
      l = Math.round(l * 255);
      return [l, l, l];
    }
    var m2 = (l < 0.5) ? l * (1 + s) : l + s - l * s;
    var m1 = l * 2 - m2;

    // red
    var temp = (h + 120) % 360;
    if (temp < 60) {
      r = m1 + (m2 - m1) * temp / 60;
    } else if (temp < 180) {
      r = m2;
    } else {
      r = m1;
    }

    // green
    temp = h;
    if (temp < 60) {
      g = m1 + (m2 - m1) * temp / 60;
    } else if (temp < 180) {
      g = m2;
    } else if (temp < 240) {
      g = m1 + (m2 - m1) * (240 - temp) / 60;
    } else {
      g = m1;
    }

    // blue
    temp = ((h - 120) + 360) % 360;
    if (temp < 60) {
      b = m1 + (m2 - m1) * temp / 60;
    } else if (temp < 180) {
      b = m2;
    } else if (temp < 240) {
      b = m1 + (m2 - m1) * (240 - temp) / 60;
    } else {
      b = m1;
    }

    return [
      Math.floor(r * 255),
      Math.floor(g * 255),
      Math.floor(b * 255)
    ];
  }

  /**
   * @static
   * @method
   * hsla を rgba に変換
   * 
   * @param {number} h
   * @param {number} s
   * @param {number} l
   * @param {number} a
   * @returns {number[]} rgba数値配列
   */
  static HSLAtoRGBA(h, s, l, a) {
    var temp = Color.HSLtoRGB(h, s, l);
    temp[3] = a;
    return temp;
  }

  /**
   * @static
   * @method
   * rgb 値からCSS colorデータ型準拠の文字列を生成
   * 
   * @param {number} r
   * @param {number} g
   * @param {number} b
   * @returns {string}
   */
  static createStyleRGB(r, g, b) {
    return "rgba(" + r + "," + g + "," + b + ")";
  }

  /**
   * @static
   * @method
   * rgba 値からCSS colorデータ型準拠の文字列を生成
   * 
   * @param {number} r
   * @param {number} g
   * @param {number} b
   * @param {number} a
   * @returns {string}
   */
  static createStyleRGBA(r, g, b, a) {
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  /**
   * @static
   * @method
   * hsl 値からCSS colorデータ型準拠の文字列を生成
   * 
   * @param {number} h
   * @param {number} s
   * @param {number} l
   * @returns {string}
   */
  static createStyleHSL(h, s, l) {
    return "hsl(" + h + "," + s + "%," + l + "%)";
  }

  /**
   * @static
   * @method
   * hsla 値からCSS colorデータ型準拠の文字列を生成
   * 
   * @param {number} h
   * @param {number} s
   * @param {number} l
   * @param {number} a
   * @returns {string}
   */
  static createStyleHSLA(h, s, l, a) {
    return "hsla(" + h + "," + s + "%," + l + "%," + a + ")";
  }

}

/**
 * @static
 * @enum {number[]}
 * カラーリスト
 */
Color.COLOR_LIST = {
  /** @property black */
  "black": [0x00, 0x00, 0x00],
  /** @property silver */
  "silver": [0xc0, 0xc0, 0xc0],
  /** @property gray */
  "gray": [0x80, 0x80, 0x80],
  /** @property white */
  "white": [0xff, 0xff, 0xff],
  /** @property maroon */
  "maroon": [0x80, 0x00, 0x00],
  /** @property red */
  "red": [0xff, 0x00, 0x00],
  /** @property purple */
  "purple": [0x80, 0x00, 0x80],
  /** @property fuchsia */
  "fuchsia": [0xff, 0x00, 0xff],
  /** @property green */
  "green": [0x00, 0x80, 0x00],
  /** @property lime */
  "lime": [0x00, 0xff, 0x00],
  /** @property olive */
  "olive": [0x80, 0x80, 0x00],
  /** @property yellow */
  "yellow": [0xff, 0xff, 0x00],
  /** @property navy */
  "navy": [0x00, 0x00, 0x80],
  /** @property blue */
  "blue": [0x00, 0x00, 0xff],
  /** @property teal */
  "teal": [0x00, 0x80, 0x80],
  /** @property aqua */
  "aqua": [0x00, 0xff, 0xff],
};

/**
 * 色文字列をnumber型配列に変換するための正規表現と関数のセット
 * @enum {{reg: RegExp, exec: (m:number[])=> number[]}}
 */
var MATCH_SET_LIST = {
  "hex111": {
    reg: /^#(\w{1})(\w{1})(\w{1})$/,
    exec: function(m) {
      return [
        parseInt(m[1] + m[1], 16),
        parseInt(m[2] + m[2], 16),
        parseInt(m[3] + m[3], 16)
      ];
    }
  },
  "hex222": {
    reg: /^#(\w{2})(\w{2})(\w{2})$/,
    exec: function(m) {
      return [
        parseInt(m[1], 16),
        parseInt(m[2], 16),
        parseInt(m[3], 16)
      ];
    }
  },
  "rgb": {
    reg: /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/,
    exec: function(m) {
      return [
        parseInt(m[1]),
        parseInt(m[2]),
        parseInt(m[3])
      ];
    }
  },
  "rgba": {
    reg: /^rgba\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1}(\.{1}\d+)?)\)$/,
    exec: function(m) {
      return [
        parseInt(m[1]),
        parseInt(m[2]),
        parseInt(m[3]),
        parseFloat(m[4])
      ];
    }
  },
  "hsl": {
    reg: /^hsl\((\d{1,3}),\s*(\d{1,3})%,\s*(\d{1,3})%\)$/,
    exec: function(m) {
      return Color.HSLtoRGB(m[1], m[2], m[3]);
    }
  },
  "hsla": {
    reg: /^rgba\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1}(\.{1}\d+)?)\)$/,
    exec: function(m) {
      return Color.HSLAtoRGBA(m[1], m[2], m[3], m[4]);
    }
  }
};

// 監視オブジェクト
// register で key を登録 (デフォルト値も一緒に？)
// event dispatcher を継承
// event dispatcher って util じゃね？
// register で登録した値を変更したら change イベントが走る


// 名前候補
//  middleman(仲立人)


/**
 * @class phina.util.ChangeDispatcher
 * _extends phina.util.EventDispatcher
 */
class ChangeDispatcher extends EventDispatcher {

  constructor() {
    super();

    this._observe = true;
  }

  /**
   * @param {string} key
   * @param {any} defaultValue
   */
  register(key, defaultValue) {
    if (arguments.length === 1) {
      var obj = arguments[0];
      forIn.call(obj, function(key, value) {
      // obj.forIn(function(key, value) {
        this.register(key, value);
      }, this);
    }
    else {
      var tempKey = '__' + key;
      this[tempKey] = defaultValue;
      accessor.call(this, key, {
      // this.accessor(key, {
        get: function() {
          return this[tempKey];
        },
        set: function(v) {
          this[tempKey] = v;
          if (this._observe) {
            this.flare('change');
          }
        },
      });
    }
    return this;
  }

  observe() {
    this._observe = true;
  }
  unobserve() {
    this._observe = false;
  }
}

/**
 * @typedef {Object} AjaxRequestOptions Ajaxクラス初期化オプション
 * @property {'GET'|'POST'|'PUT'|'DELETE'} type 
 * @property {string} url 
 * @property {string} [contentType] 
 * @property {string} [responseType] 
 * @property {any} [data] 未使用？
 */

 /**
 * @class phina.util.Ajax
 * 
 */
class Ajax {

  /**
   * @param {AjaxRequestOptions} options
   */
  static request(options) {
    var data = $safe.call({}, options, Ajax.defaults);
    // var data = ({}).$safe(options, this.defaults);

    var xhr = new XMLHttpRequest();
    var flow = new Flow(function(resolve) {
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if ([200, 201, 0].indexOf(xhr.status) !== -1) {
            resolve(xhr.response);
          }
        }
      };

      xhr.open(data.type, data.url);
      xhr.responseType = data.responseType;
      xhr.send(null);
    });

    return flow;
  }
  static get(url) {
    return Ajax.request({
      type: 'GET',
      url: url,
    });
  }
  static post(url) {
    return Ajax.request({
      type: 'POST',
      url: url,
    });
  }
  static put(url) {
    return Ajax.request({
      type: 'PUT',
      url: url,
    });
  }
  static del(url) {
    return Ajax.request({
      type: 'DELETE',
      url: url,
    });
  }

}

/** 
 * @static
 * @type {AjaxRequestOptions}
 */
Ajax.defaults = {
  type: 'GET',
  contentType: 'application/x-www-form-urlencoded',
  responseType: 'json',
  data: null,
  url: '',
};

/**
 * @typedef {Object} PrimitiveVector2 x,yプロパティのみの原始的なVector2
 * @property {number} x
 * @property {number} y
 */

/**
 * @class phina.geom.Vector2
 * @extends PrimitiveVector2
 * # 2次元ベクトルクラス
 * 2次元のベクトルや座標を表すクラスです。
 * 
 * @example
 * v = phina.geom.Vector2(3, 4);
 *
 */
class Vector2 {

  /**
   * @param {Number} [x=0] ベクトルの x 座標
   * @param {Number} [y=0] ベクトルの y 座標
   */
  constructor(x=0, y=0) {

    /**
     * x座標
     * @type {Number}
     */
    this.x = x;

    /**
     * y座標
     * @type {Number}
     */
    this.y = y;
  }

  /**
   * @method clone
   * this のコピーを生成して返します。
   *
   * @example
   * v = phina.geom.Vector2(3, 4);
   * v2 = v.clone();
   * v2.x == v.x; // => true
   *
   * @returns {Vector2} 生成したベクトル
   */
  clone() {
    return new Vector2(this.x, this.y);
  }

  /**
   * @method equals
   * this の各要素がすべて other と等しいかどうかを返します。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 4);
   * v2 = phina.geom.Vector2(5, 6);
   * v1.equals(v2); // => false
   *
   * @param {PrimitiveVector2} v 比較する対象のベクトル
   * @return {Boolean} 等しいかどうか
   */
  equals(v) {
    return (this.x === v.x && this.y === v.y);
  }

  /**
   * @method set
   * this の各要素の値を再設定します。
   *
   * @example
   * v = phina.geom.Vector2(3, 4);
   * v.set(5, 6);
   *
   * @chainable
   * @param {Number} x ベクトルの x 座標
   * @param {Number} y ベクトルの y 座標
   */
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * @method add
   * @chainable
   * this に other を加えます。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 4);
   * v2 = phina.geom.Vector2(5, 6);
   * v1.add(v2); // => phina.geom.Vector(8, 10)
   *
   * @param {PrimitiveVector2} v ベクトル
   */
  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  /**
   * @method sub
   * @chainable
   * this から other を減じます。
   *
   * ベクトルが座標を表す場合は、指定した座標から自分自身へと向かうベクトルが得られます。
   * 
   * @example
   * v1 = phina.geom.Vector2(3, 4);
   * v2 = phina.geom.Vector2(1, 5);
   * v1.sub(v2); // => phina.geom.Vector(2, -1)
   *
   * @param {PrimitiveVector2} v ベクトル
   */
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  /**
   * @method mul
   * @chainable
   * this の各要素に数値 n を乗じます。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 4);
   * v1.mul(3) // => phina.geom.Vector(9, 12)
   *
   * @param {Number} n 乗じる値
   */
  mul(n) {
    this.x *= n;
    this.y *= n;
    return this;
  }

  /**
   * @method div
   * @chainable
   * this の各要素を数値 n で割ります。
   *
   * @example
   * v1 = phina.geom.Vector2(8, 16);
   * v1.div(2) // => phina.geom.Vector(4, 8)
   *
   * @param {Number} n 割る値
   */
  div(n) {
    //console.assert(n != 0, "0 division!!");
    n = n || 0.01;
    this.x /= n;
    this.y /= n;
    return this;
  }
  /**
   * @method negate
   * @chainable
   * this の各要素の正負を反転します。
   *
   * this と同じ大きさで方向が逆のベクトルが得られます。
   *
   * @example
   * v1 = phina.geom.Vector2(3, -4);
   * v1.negate() // => phina.geom.Vector(-3, 4)
   *
   */
  negate() {
    this.x = -this.x;
    this.y = -this.y;
    
    return this;
  }

  /**
   * @method dot
   * other との内積を返します。
   *
   * 投影ベクトルを求めたり、類似度の計算に利用することができます。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 4);
   * v2 = phina.geom.Vector2(-2, 2);
   * v1.dot(v2) // => 2
   *
   * @param {PrimitiveVector2} v ベクトル
   * @return {Number} 内積
   */
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  /**
   * @method cross
   * other との外積（クロス積）を返します。
   *
   * 2次元ベクトルでの外積はベクトルでなく数値を返すことに注意してください。
   * other より this 時計回りにあるときは正の値になり、反時計回りにあるときは負の値になります。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 4);
   * v2 = phina.geom.Vector2(3, 1);
   * v1.cross(v2) // => -8
   *
   * @param {PrimitiveVector2} v ベクトル
   * @return {Number} 外積
   */
  cross(v) {
    return (this.x*v.y) - (this.y*v.x);
  }

  /**
   * @method length
   * this の大きさを返します。
   *
   * (memo) magnitude って名前の方が良いかも. 検討中.
   *
   * @example
   * v1 = phina.geom.Vector2(3, 4);
   * v1.length(); // => 5
   *
   * @return {Number} ベクトルの大きさ
   */
  length() {
    return Math.sqrt(this.x*this.x + this.y*this.y);
  }
  
  /**
   * @method lengthSquared
   * this の大きさの自乗を返します。
   *
   * C# の名前を引用（or lengthSquare or lengthSqrt）
   *
   * @example
   * v1 = phina.geom.Vector2(3, 4);
   * v1.lengthSquared(); // => 25
   *
   * @return {Number} ベクトルの大きさの自乗
   */
  lengthSquared() {
    return this.x*this.x + this.y*this.y;
  }
  
  /**
   * @method distance
   * this と other を座標とみなしたときの2点間の距離を返します。
   *
   * @example
   * v1 = phina.geom.Vector2(1, 2);
   * v2 = phina.geom.Vector2(4, 6);
   * v1.distance(v2); // => 5
   *
   * @param {PrimitiveVector2} v 座標を表すベクトル
   * @return {Number} 2点間の距離
   */
  distance(v) {
    return Math.sqrt( Math.pow(this.x-v.x, 2) + Math.pow(this.y-v.y, 2) );
  }
  
  /**
   * @method distanceSquared
   * this と other を座標とみなしたときの2点間の距離の自乗を返します。
   *
   * @example
   * v1 = phina.geom.Vector2(1, 2);
   * v2 = phina.geom.Vector2(4, 6);
   * v1.distanceSquared(v2); // => 25
   *
   * @param {PrimitiveVector2} v 座標を表すベクトル
   * @return {Number} 2点間の距離の自乗
   */
  distanceSquared(v) {
    return Math.pow(this.x-v.x, 2) + Math.pow(this.y-v.y, 2);
  }

  /**
   * @method random
   * @chainable
   * 自身を角度が min から max の範囲（度単位）で大きさが len のランダムなベクトルに変換して返します。
   *
   * @example
   * phina.geom.Vector2().random(90, 180, 1); // => phina.geom.Vector2(-0.5, 0.866) など
   *
   * @param {Number} [min=0] 角度（度単位）の下限値
   * @param {Number} [max=360] 角度（度単位）の上限値
   * @param {Number} [len=1] 大きさ
   * @returns {this}
   */
  random(min, max, len) {
    var degree = Random.randfloat(min || 0, max || 360);
    var rad = degree*DEG_TO_RAD;
    var len = len || 1;

    this.x = Math.cos(rad)*len;
    this.y = Math.sin(rad)*len;

    return this;
  }
  
  /**
   * @method normalize
   * @chainable
   * this を正規化します。すなわち、this と同じ方向で大きさが1のベクトルを返します。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 4);
   * v1.normalize(); // => phina.geom.Vector2(0.6, 0.8)
   *
   * @returns {this}
   */
  normalize() {
    this.div(this.length());
    return this;
  }

  /**
   * @method toString
   * this を JSON 形式で表現した文字列を返します。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 4);
   * v1.toString(); // => "{x:3, y:4}"
   *
   * @return {String} JSON 文字列
   */
  toString() {
    return format.call("{x:{x}, y:{y}}", this);
    // return "{x:{x}, y:{y}}".format(this);
  }

  /**
   * @method getDirection
   * this のおおよその方向を示した文字列を返します。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 4);
   * v1.getDirection(); // => "up"
   *
   * @return {String} 方向を表す文字列（"up", "right", "down", "left"）
   */
  getDirection() {
    var angle = this.toDegree();
    if (angle < 45) {
      return "right";
    } else if (angle < 135) {
      return "down";
    } else if (angle < 225) {
      return "left"
    } else if (angle < 315) {
      return "up";
    } else {
      return "right";
    }
  }

  /**
   * @method toAngle
   * this と x 軸との角度（ラジアン単位）を返します。
   *
   * @example
   * v1 = phina.geom.Vector2(-2, 0);
   * v1.toAngle(); // => 3.14159
   *
   * @return {Number} ベクトルの角度（ラジアン単位）
   */
  toAngle() {
    var rad = Math.atan2(this.y, this.x);
    return (rad + Math.PI*2)%(Math.PI*2);
  }
  
  /**
   * @method fromAngle
   * @chainable
   * 角度（ラジアン単位）と大きさを指定してベクトルを設定します。
   *
   * @example
   * phina.geom.Vector2().fromAngle(Math.PI/4, 2); // => phina.geom.Vector2(1.4142, 1.4142)
   *
   * @param {Number} rad 角度（ラジアン単位）
   * @param {Number} [len=1] 大きさ
   * @returns {this}
   */
  fromAngle(rad, len) {
    len = len || 1;
    this.x = Math.cos(rad)*len;
    this.y = Math.sin(rad)*len;
    
    return this;
  }

  /**
   * @method toDegree
   * this と x 軸との角度（度単位）を返します。
   *
   * @example
   * v1 = phina.geom.Vector2(-2, 2);
   * v1.toAngle(); // => 135
   *
   * @return {Number} ベクトルの角度（度単位）
   */
  toDegree() {
    return toDegree.call(this.toAngle());
    // return this.toAngle().toDegree();
  }
  
  /**
   * @method fromDegree
   * @chainable
   * 角度（度単位）と大きさを指定してベクトルを設定します。
   *
   * @example
   * phina.geom.Vector2().fromDegree(60, 2); // => phina.geom.Vector2(1, 1.732)
   *
   * @param {Number} deg 角度（度単位）
   * @param {Number} [len=1] 大きさ
   * @returns {this}
   */
  fromDegree(deg, len) {
    // return this.fromAngle(deg.toRadian(), len);
    return this.fromAngle(toRadian.call(deg), len);
  }

  /**
   * @method rotate
   * @chainable
   * this を回転します。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 1);
   * v1.rotate(Math.PI/2); // => phina.geom.Vector2(-1, 3);
   *
   * @param {Number} rad 角度（ラジアン単位）
   * @param {PrimitiveVector2} [center=Vector2(0, 0)] 回転の中心座標
   * @returns {this}
   */
  rotate(rad, center) {
    center = center || new Vector2(0, 0);

    var x1 = this.x - center.x;
    var y1 = this.y - center.y;
    var x2 = x1 * Math.cos(rad) - y1 * Math.sin(rad);
    var y2 = x1 * Math.sin(rad) + y1 * Math.cos(rad);
    this.set( center.x + x2, center.y + y2 );

    return this;
  }

  /**
   * @method min
   * @static
   * v1 と v2 の各要素に対し、より小さい方を要素とする新しいベクトルを生成して返します。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 1);
   * v2 = phina.geom.Vector2(-3, 2);
   * phina.geom.Vector2.min(v1, v2); // phina.geom.Vector2(-3, 1);
   *
   * @param {PrimitiveVector2} a ベクトル
   * @param {PrimitiveVector2} b ベクトル
   * @return {Vector2} 生成したベクトル
   */
  static min(a, b) {
    return new Vector2(
      (a.x < b.x) ? a.x : b.x,
      (a.y < b.y) ? a.y : b.y
    );
  }

  /**
   * @method max
   * @static
   * 2次元ベクトル v1 と v2 の各要素に対し、より大きい方を要素とする新しいベクトルを生成して返します。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 1);
   * v2 = phina.geom.Vector2(-3, 2);
   * phina.geom.Vector2.max(v1, v2); // phina.geom.Vector2(3, 2);
   *
   * @param {PrimitiveVector2} a ベクトル
   * @param {PrimitiveVector2} b ベクトル
   * @return {Vector2} 生成したベクトル
   */
  static max(a, b) {
    return new Vector2(
      (a.x > b.x) ? a.x : b.x,
      (a.y > b.y) ? a.y : b.y
    );
  }

  /**
   * @method add
   * @static
   * v1 に v2 を加算した新しいベクトルを生成して返します。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 1);
   * v2 = phina.geom.Vector2(-3, 2);
   * phina.geom.Vector2.add(v1, v2); // phina.geom.Vector2(0, 3);
   *
   * @param {PrimitiveVector2} lhs ベクトル
   * @param {PrimitiveVector2} rhs ベクトル
   * @return {Vector2} 加算した結果
   */
  static add(lhs, rhs) {
    return new Vector2(lhs.x+rhs.x, lhs.y+rhs.y);
  }
  
  /**
   * @method sub
   * @static
   * 2次元ベクトル v1 から v2 を減じた新しいベクトルを生成して返します。
   *
   * ベクトルが座標を表す場合、2つ目の座標から1つ目の座標へと向かうベクトルが得られます。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 1);
   * v2 = phina.geom.Vector2(-3, 2);
   * phina.geom.Vector2.sub(v1, v2); // phina.geom.Vector2(6, -1);
   *
   * @param {PrimitiveVector2} lhs ベクトル
   * @param {PrimitiveVector2} rhs ベクトル
   * @return {Vector2} 減算した結果
   */
  static sub(lhs, rhs) {
    return new Vector2(lhs.x-rhs.x, lhs.y-rhs.y);
  }
  
  /**
   * @method mul
   * @static
   * 2次元ベクトル v の各要素に n を乗じた新しいベクトルを生成して返します。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 1);
   * phina.geom.Vector2.mul(v1, 2); // phina.geom.Vector2(6, 2)
   *
   * @param {PrimitiveVector2} v ベクトル
   * @param {Number} n 乗じる値
   * @return {Vector2} 乗算した結果
   */
  static mul(v, n) {
    return new Vector2(v.x*n, v.y*n);
  }
  
  /**
   * @method div
   * @static
   * 2次元ベクトル v の各要素を n で割った新しいベクトルを生成して返します。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 1);
   * phina.geom.Vector2.div(v1, 2); // phina.geom.Vector2(1.5, 0.5)
   *
   * @param {PrimitiveVector2} v ベクトル
   * @param {Number} n 割る値
   * @return {Vector2} 除算した結果
   */
  static div(v, n) {
    return new Vector2(v.x/n, v.y/n);
  }
  
  /**
   * @method negate
   * @static
   * 2次元ベクトル v を反転した新しいベクトルを生成して返します。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 1);
   * phina.geom.Vector2.negate(); // phina.geom.Vector2(-3, -1)
   *
   * @param {PrimitiveVector2} v ベクトル
   * @return {Vector2} 反転したベクトル
   */
  static negate(v) {
    return new Vector2(-v.x, -v.y);
  }
  
  /**
   * @method dot
   * @static
   * 2次元ベクトル v1 と v2 の内積を返します。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 4);
   * v2 = phina.geom.Vector2(-2, 2);
   * phina.geom.Vector2.dot(v1, v2) // => 2
   *
   * @param {PrimitiveVector2} lhs ベクトル
   * @param {PrimitiveVector2} rhs ベクトル
   * @return {Number} 内積
   */
  static dot(lhs, rhs) {
    return lhs.x * rhs.x + lhs.y * rhs.y;
  }
  
  /**
   * @method cross
   * @static
   * 2次元ベクトル v1 と v2 の外積（クロス積）を返します。
   *
   * 2次元ベクトルでの外積はベクトルでなく数値を返すことに注意してください。
   * 1つ目のベクトルが2つ目のベクトルより時計回りにあるときは正の値になり、反時計回りにあるときは負の値になります。
   *
   * @example
   * v1 = phina.geom.Vector2(3, 4);
   * v2 = phina.geom.Vector2(3, 1);
   * phina.geom.Vector2.cross(v1, v2); // => -8
   *
   * @param {PrimitiveVector2} lhs ベクトル
   * @param {PrimitiveVector2} rhs ベクトル
   * @return {Number} 外積
   */
  static cross(lhs, rhs) {
    return (lhs.x*rhs.y) - (lhs.y*rhs.x);
  }
  
  /**
   * @method distance
   * @static
   * v1 と v2 を座標とみなしたときの2点間の距離を返します。
   *
   * @example
   * v1 = phina.geom.Vector2(1, 2);
   * v2 = phina.geom.Vector2(4, 6);
   * phina.geom.Vector2.distance(v1, v2); // => 5
   *
   * @param {PrimitiveVector2} lhs 座標を表すベクトル
   * @param {PrimitiveVector2} rhs 座標を表すベクトル
   * @return {Number} 2点間の距離
   */
  static distance(lhs, rhs) {
    return Math.sqrt( Math.pow(lhs.x-rhs.x, 2) + Math.pow(lhs.y-rhs.y, 2) );
  }

  /**
   * @method distanceSquared
   * @static
   * v1 と v2 を座標とみなしたときの2点間の距離の自乗を返します。
   *
   * @example
   * v1 = phina.geom.Vector2(1, 2);
   * v2 = phina.geom.Vector2(4, 6);
   * phina.geom.Vector2.distanceSquared(v1, v2); // => 25
   *
   * @param {PrimitiveVector2} lhs 座標を表すベクトル
   * @param {PrimitiveVector2} rhs 座標を表すベクトル
   * @return {Number} 2点間の距離の自乗
   */
  static distanceSquared(lhs, rhs) {
    return Math.pow(lhs.x-rhs.x, 2) + Math.pow(lhs.y-rhs.y, 2);
  }

  /**
   * @method manhattanDistance
   * @static
   * v1 と v2 を座標とみなしたときの2点間のマンハッタン距離（軸に平行に進むときの最短距離）を返します。
   *
   * @example
   * v1 = phina.geom.Vector2(1, 2);
   * v2 = phina.geom.Vector2(4, 6);
   * phina.geom.Vector2.manhattanDistance(v1, v2); // => 7
   *
   * @param {PrimitiveVector2} lhs 座標を表すベクトル
   * @param {PrimitiveVector2} rhs 座標を表すベクトル
   * @return {Number} 2点間のマンハッタン距離
   */
  static manhattanDistance(lhs, rhs) {
    return Math.abs(lhs.x-rhs.x) + Math.abs(lhs.y-rhs.y);
  }
  
  /**
   * @method normal
   * @static
   * v1 と v2 を座標とみなしたときの、v2 から v1 に向かうベクトルに対する法線ベクトルを返します。
   *
   * @example
   * v1 = phina.geom.Vector2(1, 2);
   * v2 = phina.geom.Vector2(4, 6);
   * phina.geom.Vector2.normal(v1, v2); // => phina.geom.Vector2(4, -3)
   *
   * @param {PrimitiveVector2} a 座標を表すベクトル
   * @param {PrimitiveVector2} b 座標を表すベクトル
   * @return {Vector2} 法線ベクトル
   */
  static normal(a, b) {
    var temp = Vector2.sub(a, b);

    return new Vector2(-temp.y, temp.x);
  }

  /**
   * @method reflect
   * @static
   * 2次元ベクトル v を壁への入射ベクトルとして、壁に反射した際のベクトル（反射ベクトル）を返します。
   *
   * 壁の向きは法線ベクトル normal によって表します。
   *
   * @example
   * v1 = phina.geom.Vector2(4, 3);
   * normal = phina.geom.Vector2(-1, 1);
   * phina.geom.Vector2.reflect(v1, normal); // => phina.geom.Vector2(2, 5)
   *
   * @param {PrimitiveVector2} v 入射ベクトル
   * @param {PrimitiveVector2} normal 壁の法線ベクトル
   * @return {Vector2} 反射ベクトル
   */
  static reflect(v, normal) {
    var len = Vector2.dot(v, normal);
    var temp= Vector2.mul(normal, 2*len);
    
    return Vector2.sub(v, temp);
  }
  
  /**
   * @method wall
   * @static
   * 2次元ベクトル v を壁への入射ベクトルとして、壁に沿ったベクトル（壁ずりクトル）を返します。
   *
   * 壁の向きは法線ベクトル normal によって表します。
   *
   * @example
   * v1 = phina.geom.Vector2(4, 3);
   * normal = phina.geom.Vector2(-1, 1);
   * phina.geom.Vector2.wall(v1, normal); // => phina.geom.Vector2(3, 4)
   *
   * @param {PrimitiveVector2} v 入射ベクトル
   * @param {PrimitiveVector2} normal 壁の法線ベクトル
   * @return {Vector2} 壁ずりベクトル
   */
  static wall(v, normal) {
    var len = Vector2.dot(v, normal);
    var temp= Vector2.mul(normal, len);
    
    return Vector2.sub(v, temp);
  }
  
  /**
   * @method lerp
   * @static
   * v1 と v2 を媒介変数 t で線形補間します。
   * t=0.5 で v1 と v2 の中間ベクトルを求めることができます。
   *
   * @example
   * v1 = phina.geom.Vector2(1, 2);
   * v2 = phina.geom.Vector2(4, 6);
   * phina.geom.Vector2.lerp(v1, v2, 0.5); // => (2.5, 4)
   * phina.geom.Vector2.lerp(v1, v2, 0); // => (1, 2)
   * phina.geom.Vector2.lerp(v1, v2, 1); // => (4, 6)
   * 
   * @param {PrimitiveVector2} a ベクトル
   * @param {PrimitiveVector2} b ベクトル
   * @param {Number} t 媒介変数
   * @return {Vector2} 線形補間の結果
   */
  static lerp(a, b, t) {
    return new Vector2(
      a.x + (b.x-a.x)*t,
      a.y + (b.y-a.y)*t
    );
  }
  
  /**
   * @method slerp
   * @static
   * @todo
   * 補間（未実装）
   */
  static slerp(lhs, rhs, t) {
      // TODO:
      // cos...
  }

  /**
   * @method random
   * @static
   * 角度が min から max の範囲（度単位）で大きさが len のランダムなベクトルを生成して返します。
   *
   * @example
   * phina.geom.Vector2.random(90, 180, 1); // => phina.geom.Vector2(-0.5, 0.866) など
   *
   * @param {Number} [min=0] 角度（度単位）の下限値
   * @param {Number} [max=360] 角度（度単位）の上限値
   * @param {Number} [len=1] 大きさ
   * @return {Vector2} 生成したベクトル
   */
  static random(min, max, len) {
    return new Vector2().random(min, max).mul(len||1);
  }

  /**
   * @property {Vector2} ZERO ゼロベクトル
   */
  static get ZERO() { return ZERO; }

  /**
   * @property {Vector2} LEFT 左方向の単位ベクトル
   */
  static get LEFT() { return LEFT; }

  /**
   * @property {Vector2} RIGHT 右方向の単位ベクトル
   */
  static get RIGHT() { return RIGHT; }

  /**
   * @property {Vector2} UP 上方向の単位ベクトル
   */
  static get UP() { return UP; }

  /**
   * @property {Vector2} DOWN 下方向の単位ベクトル
   */
  static get DOWN() { return DOWN; }
}

var ZERO = new Vector2(0, 0);
var LEFT = new Vector2(-1, 0);
var RIGHT = new Vector2(1, 0);
var UP = new Vector2(0, -1);
var DOWN = new Vector2(0, 1);

// import { Rect } from "./rect";

/**
 * @class phina.geom.Circle
 * # 円領域を表すクラス
 * キャンバス上の円領域を扱うクラスです。
 * 
 */
class Circle {

  /**
   * @property {Number} x
   * 円の中心の x 座標
   */
  // x: 0,
  /**
   * @property {Number} y
   * 円の中心の y 座標
   */
  // y: 0,
  /**
   * @property {Number} radius
   * 円の半径
   */
  // radius: 32,

  /**
   * @method init
   * 円領域のコンストラクタです。
   *
   * ### Example
   *     circle = phina.geom.Circle(32, 64, 128);
   *
   * @param {Number} x 円の中心の x 座標
   * @param {Number} y 円の中心の y 座標
   * @param {Number} radius 半径
   */
  constructor(x, y, radius) {
    this.x = 0;
    this.y = 0;
    this.radius = 32;
    this.set(x, y, radius);
  }

  /**
   * @method set
   * @chainable
   * this の各値を再設定します。
   *
   * ### Example
   *     circle = phina.geom.Circle(32, 64, 128);
   *     circle.set(100, 200, 32);
   *
   * @param {Number} x 円を囲う矩形の左上頂点の x 座標
   * @param {Number} y 円を囲う矩形の左上頂点の x 座標
   * @param {Number} radius 半径
   * @returns {this}
   */
  set(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;

    return this;
  }

  /**
   * @method moveTo
   * @chainable
   * 円領域を座標 (x, y) に移動します。(x, y) は円の中心を表します。
   *
   * ### Example
   *     circle = phina.geom.Circle(300, 300, 40);
   *     circle.left; // => 260
   *     circle.moveTo(100, 100);
   *     circle.left; // => 60
   *
   * @param {Number} x 移動先の x 座標
   * @param {Number} y 移動先の y 座標
   * @returns {this}
   */
  moveTo(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * @method moveBy
   * @chainable
   * 円領域を (x, y) だけ移動します。
   *
   * ### Example
   *     circle = phina.geom.Circle(300, 300, 40);
   *     circle.left; // => 260
   *     circle.moveBy(100, 100);
   *     circle.left; // => 460
   *
   * @param {Number} x 移動量の x 座標
   * @param {Number} y 移動量の y 座標
   * @returns {this}
   */
  moveBy(x, y) {
    this.x += x;
    this.y += y;
    return this;
  }

  /**
   * @method contains
   * 座標 (x, y) が円領域の中に含まれるかどうかを返します。
   *
   * ### Example
   *     circle = phina.geom.Circle(300, 300, 100);
   *     circle.contains(350, 350); // =>  true
   *     circle.contains(350, 400); // => false
   *
   * @param {Number} x 判定する対象の x 座標
   * @param {Number} y 判定する対象の y 座標
   * @return {Boolean} 指定した座標が円領域の中に含まれるかどうか
   */
  contains(x, y) {
    var lenX = this.x-x;
    var lenY = this.y-y;
    var lenSquared = (lenX*lenX)+(lenY*lenY);

    return lenSquared <= this.radius*this.radius;
  }

  /**
   * @method clone
   * this のコピーを生成して返します。
   *
   * ### Example
   *     circle = phina.geom.Circle(50, 100, 40);
   *     circle2 = circle.clone();
   *     circle2.x == circle.x; // => true
   *
   * @return {Circle} 生成した円領域
   */
  clone() {
    return new Circle(this.x, this.y, this.radius);
  }

  /**
   * @method toRect
   * 円に外接する正方形を表す矩形領域を生成して返します。
   *
   * ### Example
   *     circle = phina.geom.Circle(50, 100, 40);
   *     rect = circle.toRect();
   *     rect.x; // => 10
   *     rect.y; // => 60
   *     rect.width; // => 80
   * 
   * @return {Object} 生成した矩形領域
   */
  toRect() {
    // 循環参照回避のため、Rect側で定義
    // var size = this.size;
    // return new Rect(this.x - this.radius, this.y - this.radius, size, size);
  }

  /**
   * @method toArray
   * this の各値を要素とする配列を生成して返します。
   *
   * ### Example
   *     circle = phina.geom.Circle(50, 100, 40);
   *     rect.toArray(); // => [50, 100, 40]
   *
   * @return {Number[]} 生成した配列
   */
  toArray() {
    return [this.x, this.y, this.radius];
  }

  /**
   * @property {Number} left
   * キャンバス左端から円の左端までの距離
   *
   * 現時点では読み取り専用です。
   *
   * ### Example
   *     circle = phina.geom.Circle(200, 300, 100);
   *     circle.left; // => 100
   *     circle.top; // => 200
   *     circle.right; // => 300
   *     circle.bottom; // => 400
   */
  get left()   { return this.x - this.radius; }
  set left(v)  {
    // TODO: 
  }

  /**
   * @property {Number} top
   * キャンバス上端から円の上端までの距離
   *
   * 現時点では読み取り専用です。
   */
  get top()   { return this.y - this.radius; }
  set top(v)  {
    // TODO: 
  }

  /**
   * @property {Number} right
   * キャンバス右端から円の右端までの距離
   *
   * 現時点では読み取り専用です。
   */
  get right()   { return this.x + this.radius; }
  set right(v)  {
    // TODO: 
  }

  /**
   * @property {Number} bottom
   * キャンバス下端から円の下端までの距離
   *
   * 現時点では読み取り専用です。
   */
  get bottom()   { return this.y + this.radius; }
  set bottom(v)  {
    // TODO: 
  }
    
  /**
   * @property {Number} size
   * 円の直径
   *
   * 現時点では読み取り専用です。
   */
  get size()   { return this.radius*2; }
  set size(v)  {
    // TODO: 検討中
  }
}

/**
 * @class phina.geom.Rect
 * # 矩形領域を表すクラス
 * キャンバス上の矩形領域を扱うクラスです。
 * 
 * ### Example
 *     rect = phina.geom.Rect(8, 16, 32, 64);
 */
class Rect {

  /**
   * @param {Number} [x] 矩形の左上頂点の x 座標
   * @param {Number} [y] 矩形の左上頂点の y 座標
   * @param {Number} [width] 幅
   * @param {Number} [height] 高さ
   */
  constructor(x, y, width, height) {
    /**
     * @property {Number} x
     * 矩形の左上頂点の x 座標
     */
    this.x = 0;
    
    /**
     * @property {Number} y
     * 矩形の左上頂点の y 座標
     */
    this.y = 0;

    /**
     * @property {Number} width
     * 矩形の幅
     */
    this.width = 32;

    /**
     * @property {Number} hight
     * 矩形の高さ
     */
    this.height = 32;

    this.set(x, y, width, height);
  }

  /**
   * @method set
   * @chainable
   * this の各値を再設定します。
   *
   * ### Example
   *     rect = phina.geom.Rect(8, 16, 32, 64);
   *     rect.set(0, 16, 32, 64);
   *
   * @param {Number} x 矩形の左上頂点の x 座標
   * @param {Number} y 矩形の左上頂点の y 座標
   * @param {Number} width 幅
   * @param {Number} height 高さ
   * @returns {this}
   */
  set(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    return this;
  }

  /**
   * @method moveTo
   * @chainable
   * 矩形領域を座標 (x, y) に移動します。
   *
   * ### Example
   *     rect = phina.geom.Rect(8, 16, 32, 64);
   *     rect.centerX; // => 24
   *     rect.moveTo(0, 0);
   *     rect.centerX; // => 16
   *
   * @param {Number} x 移動先の x 座標
   * @param {Number} y 移動先の y 座標
   * @returns {this}
   */
  moveTo(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * @method moveBy
   * @chainable
   * 矩形領域を (x, y) だけ移動します。
   *
   * ### Example
   *     rect = phina.geom.Rect(8, 16, 32, 64);
   *     rect.moveBy(10, -10);
   *     rect.x; // => 18
   *     rect.y; // => 6
   *
   * @param {Number} x 移動量の x 座標
   * @param {Number} y 移動量の y 座標
   * @returns {this}
   */
  moveBy(x, y) {
    this.x += x;
    this.y += y;
    return this;
  }

  /**
   * @method setSizse
   * @chainable
   * 矩形領域の幅と高さを変更します。
   *
   * ### Example
   *     rect = phina.geom.Rect(8, 16, 32, 64);
   *     rect.setSize(10, 20);
   *     rect.width; // => 10
   *     rect.height; // => 20
   *
   * @param {Number} w 幅
   * @param {Number} h 高さ
   * @returns {this}
   */
  setSize(w, h) {
    this.width = w;
    this.height = h;
    return this;
  }

  /**
   * @method padding
   * @chainable
   * 矩形領域の中にパディング領域を設定します。
   *
   * 矩形領域自体のサイズはパディング領域の分だけ小さくなります。  
   * 幅の指定方法は CSS の padding 指定と同じように時計回りです。  
   * 引数が1つの場合は上下左右の値、引数が2つの場合は上下と左右の値、引数が３つの場合は上、左右、下の値と解釈します。
   *
   * ### Example
   *     rect = phina.geom.Rect(50, 100, 150, 200);
   *     rect.padding(10);
   *     rect.x; // => 60
   *     rect.y; // => 110
   *     rect.width; // => 130
   *     rect.height; // => 180
   *
   * @param {Number} top 上辺のパディング幅
   * @param {Number} right 右辺のパディング幅
   * @param {Number} bottom 下辺のパディング幅
   * @param {Number} left 左辺のパディング幅
   * @returns {this}
   */
  padding(top, right, bottom, left) {
    // css の padding に合わせて時計回りにパラメータ調整
    switch (arguments.length) {
      case 1:
        top = right = bottom = left = arguments[0];
        break;
      case 2:
        top     = bottom = arguments[0];
        right   = left   = arguments[1];
        break;
      case 3:
        top     = arguments[0];
        right   = left = arguments[1];
        bottom  = arguments[2];
        break;
    }
    
    this.x += left;
    this.y += top;
    this.width -= left+right;
    this.height-= top +bottom;
    
    return this;
  }

  /**
   * @method contains
   * 座標 (x, y) が 矩形領域の中に含まれるかどうかを返します。
   *
   * ### Example
   *     rect = phina.geom.Rect(50, 100, 150, 200);
   *     rect.contains(35, 68); // =>  true
   *     rect.contains(200, 68); // => false
   *
   * @param {Number} x 判定する対象の x 座標
   * @param {Number} y 判定する対象の y 座標
   * @return {Boolean} 指定した座標が矩形領域の中に含まれるかどうか
   */
  contains(x, y) {
    return this.left <= x && x <= this.right && this.top <= y && y <= this.bottom;
  }

  /**
   * @method clone
   * this のコピーを生成して返します。
   *
   * ### Example
   *     rect = phina.geom.Rect(50, 100, 150, 200);
   *     rect2 = rect.clone();
   *     rect2.x == rect.x; // => true
   *
   * @return {Rect} 生成した矩形領域
   */
  clone() {
    return new Rect(this.x, this.y, this.width, this.height);
  }

  /**
   * @method toCircle
   * 矩形領域内に収まる最大の円領域を生成して返します。
   *
   * ### Example
   *     rect = phina.geom.Rect(32, 64, 100, 200);
   *     circle = rect.toCircle();
   *     circle.x; // => 82
   *     circle.y; // => 164
   *     circle.radius; // => 50
   *
   * @return {Circle} 生成した円領域
   */
  toCircle() {
    var radius = ((this.width < this.height) ? this.width : this.height)/2;
    return new Circle(this.centerX, this.centerY, radius);
  }

  /**
   * @method toArray
   * this の各値を要素とする配列を生成して返します。
   *
   * ### Example
   *     rect = phina.geom.Rect(32, 64, 100, 200);
   *     rect.toArray(); // => [32, 64, 100, 200]
   *
   * @return {Number[]} 生成した配列
   */
  toArray() {
    return [this.x, this.y, this.width, this.height];
  }

  /**
   * @property {Number} left
   * キャンバス左端から矩形領域の左辺までの距離
   *
   * left を変更すると矩形領域の幅（width）が自動的に調整されます。
   *
   * ### Example
   *     rect = phina.geom.Rect(32, 64, 100, 200);
   *     rect.left; // => 32
   *     rect.width; // => 100
   *     rect.right; // => 132
   *     
   *     rect.left = 42;
   *     rect.width; // => 90
   */
  get left()   { return this.x; }
  set left(v)  { this.width -= v-this.x; this.x = v; }

  /**
   * @property {Number} top
   * キャンバス上端から矩形領域の上辺までの位置
   *
   * top を変更すると矩形領域の高さ（height）が自動的に調整されます。
   */
  get top()   { return this.y; }
  set top(v)  { this.height -= v-this.y; this.y = v; }

  /**
   * @property {Number} right
   * キャンバス左端から矩形領域の右辺までの距離
   *
   * right を変更すると矩形領域の幅（width）が自動的に調整されます。
   */
  get right()   { return this.x + this.width; }
  set right(v)  { this.width += v-this.right; }

  /**
   * @property {Number} bottom
   * キャンバス上端から矩形領域の下辺までの位置
   *
   * bottom を変更すると矩形領域の高さ（height）が自動的に調整されます。
   */
  get bottom()   { return this.y + this.height; }
  set bottom(v)  { this.height += v-this.bottom; }
  
  /**
   * @property {Number} centerX
   * 矩形領域の x 座標
   *
   * 現時点では読み取り専用です。
   */
  get centerX()   { return this.x + this.width/2; }
  set centerX(v)  {
    // TODO: 検討中
  }
  /**
   * @property {Number} centerY
   * 矩形領域の y 座標
   *
   * 現時点では読み取り専用です。
   */
  get centerY()   { return this.y + this.height/2; }
  set centerY(v)  {
    // TODO: 検討中
  }

}

/**
 * Circle.toRect
 * 循環参照を回避するため、ここで定義
 */
Circle.prototype.toRect = function() {
  var size = this.size;
  return new Rect(this.x - this.radius, this.y - this.radius, size, size);
};

/**
 * @class phina.geom.Matrix33
 * # 行列クラス
 * 3x3の行列を表すクラスです。
 * 
 * <pre>
 * | m00 m01 m02 |
 * | m10 m11 m12 |
 * | m20 m21 m22 |
 * </pre>
 */
class Matrix33 {

  /**
   * @method init
   * マトリックスクラスのコンストラクタです。
   *
   * 引数は m00, m01, m02, m10, m11, m12, m20, m21, m22 の順に指定します。
   * 引数が9個に満たない場合は単位行列を生成します。
   *
   * ### Example
   *     mat1 = phina.geom.Matrix33(1, 2, 3, 4, 5, 6, 7, 8, 9);
   *     mat2 = phina.geom.Matrix33();
   *     mat1.m00 + mat2.m00; // => 2
   *     mat1.m01 - mat2.m01; // => 2
   *
   * @param {...number} m00, m01,... 各要素の値
   */
  constructor() {
    /** @type {number} */
    this.m00;
    /** @type {number} */
    this.m01;
    /** @type {number} */
    this.m02;

    /** @type {number} */
    this.m10;
    /** @type {number} */
    this.m11;
    /** @type {number} */
    this.m12;

    /** @type {number} */
    this.m20;
    /** @type {number} */
    this.m21;
    /** @type {number} */
    this.m22;

    if (arguments.length >= 9) {
      this.set.apply(this, arguments);
    }
    else {
      this.identity();
    }
  }

  /**
   * @method set
   * @chainable this の各要素の値を再設定します。
   * 
   * ### Example
   *   mat1 = phina.geom.Matrix33(1, 2, 3, 4, 5, 6, 7, 8, 9);
   *   mat2 = phina.geom.Matrix33();
   *   mat2.set(1, 2, 3, 4, 5, 6, 7, 8, 9);
   *   mat1.toString() == mat2.toString(); // => true
   * 
   * @param {number} m00
   * @param {number} m01
   * @param {number} m02
   * @param {number} m10
   * @param {number} m11
   * @param {number} m12
   * @param {number} m20
   * @param {number} m21
   * @param {number} m22
   * @returns {this}
   */
  set(m00, m01, m02, m10, m11, m12, m20, m21, m22) {
    this.m00 = m00; this.m01 = m01; this.m02 = m02;
    this.m10 = m10; this.m11 = m11; this.m12 = m12;
    this.m20 = m20; this.m21 = m21; this.m22 = m22;

    return this;
  }

  /**
   * @method identity
   * @chainable
   * 自身を単位行列にして返します。
   *
   * ### Example
   *     mat1 = phina.geom.Matrix33(1, 2, 3, 4, 5, 6, 7, 8, 9);
   *     mat2 = phina.geom.Matrix33();
   *     mat1.identity().toString() == mat2.toString(); // => true
   *
   * @returns {this}
   */
  identity() {
    this.m00 = 1; this.m01 = 0; this.m02 = 0;
    this.m10 = 0; this.m11 = 1; this.m12 = 0;
    this.m20 = 0; this.m21 = 0; this.m22 = 1;
    return this;
  }

  /**
   * @method clone
   * 自身のコピーを生成して返します。
   *
   * ### Example
   *     mat1 = phina.geom.Matrix33(1, 2, 3, 4, 5, 6, 7, 8, 9);
   *     mat2 = mat1.clone();
   *     mat1.toString() == mat2.toString(); // => true
   *     mat1 == mat2; // => false
   *
   * @return {Matrix33} 行列オブジェクト
   */
  clone() {
    return new Matrix33(
      this.m00, this.m01, this.m02,
      this.m10, this.m11, this.m12,
      this.m20, this.m21, this.m22
    );
  }

  /**
   * @method determinant
   * 行列式を返します
   *
   * ### Example
   *     mat1 = phina.geom.Matrix33(0, -2, 0, -1, 3, 1, 4, 2, 1);
   *     mat1.determinant(); // => -10
   *     mat1.identity().determinant(); // => 1
   *
   * @return {Number} 行列式
   */
  determinant() {
    var m00 = this.m00; var m01 = this.m01; var m02 = this.m02;
    var m10 = this.m10; var m11 = this.m11; var m12 = this.m12;
    var m20 = this.m20; var m21 = this.m21; var m22 = this.m22;
    
    return m00*m11*m22 + m10*m21*m02 + m01*m12*m20 - m02*m11*m20 - m01*m10*m22 - m12*m21*m00;
  }

  /**
   * @method transpose
   * @chainable
   * 自身を転置行列にして返します。
   *
   * ### Example
   *     mat1 = phina.geom.Matrix33(1, 2, 3, 4, 5, 6, 7, 8, 9);
   *     mat2 = phina.geom.Matrix33(1, 4, 7, 2, 5, 8, 3, 6, 9);
   *     mat1.transpose().toString() == mat2.toString(); // => true
   *
   * @returns {this}
   */
  transpose() {
    var swap = function(a, b) {
      var temp = this[a];
      this[a] = this[b];
      this[b] = temp;
    }.bind(this);

    swap('m01', 'm10');
    swap('m02', 'm20');
    swap('m12', 'm21');
    
    return this;
  }

  /**
   * @method invert
   * @chainable
   * 自身を逆行列にして返します。
   *
   * ### Example
   *     mat1 = phina.geom.Matrix33(0, -1, 1, -1, 4, -2, 1, 1, 1);
   *     mat2 = mat1.clone().invert();
   *     mat3 = mat1.clone().multiply(mat2);
   *     mat3.toString() == phina.geom.Matrix33.IDENTITY.toString(); // => true
   *
   * @returns {this}
   */
  invert() {
    var m00 = this.m00; var m01 = this.m01; var m02 = this.m02;
    var m10 = this.m10; var m11 = this.m11; var m12 = this.m12;
    var m20 = this.m20; var m21 = this.m21; var m22 = this.m22;

    var det = this.determinant();

    // |m00, m01, m02|
    // |m10, m11, m12|
    // |m20, m21, m22|
    this.m00 = (m11*m22-m12*m21)/det;
    this.m01 = (m10*m22-m12*m20)/det*-1;
    this.m02 = (m10*m21-m11*m20)/det;
    
    this.m10 = (m01*m22-m02*m21)/det*-1;
    this.m11 = (m00*m22-m02*m20)/det;
    this.m12 = (m00*m21-m01*m20)/det*-1;
    
    this.m20 = (m01*m12-m02*m11)/det;
    this.m21 = (m00*m12-m02*m10)/det*-1;
    this.m22 = (m00*m11-m01*m10)/det;
    
    this.transpose();
    
    return this;

  }

  /**
   * @method multiply
   * @chainable
   * 自身に別の行列を乗じます。
   *
   * ### Example
   *     mat1 = phina.geom.Matrix33(0, -1, 1, -1, 4, -2, 1, 1, 1);
   *     mat2 = mat1.clone().invert();
   *     mat3 = mat1.clone().multiply(mat2);
   *     mat3.toString() == phina.geom.Matrix33.IDENTITY.toString(); // => true
   *
   * @param {Matrix33} mat 乗じる行列
   * @returns {this}
   */
  multiply(mat) {
    var a00 = this.m00, a01 = this.m01, a02 = this.m02;
    var a10 = this.m10, a11 = this.m11, a12 = this.m12;
    var a20 = this.m20, a21 = this.m21, a22 = this.m22;
    var b00 = mat.m00, b01 = mat.m01, b02 = mat.m02;
    var b10 = mat.m10, b11 = mat.m11, b12 = mat.m12;
    var b20 = mat.m20, b21 = mat.m21, b22 = mat.m22;

    this.m00 = a00*b00 + a01*b10 + a02*b20;
    this.m01 = a00*b01 + a01*b11 + a02*b21;
    this.m02 = a00*b02 + a01*b12 + a02*b22;

    this.m10 = a10*b00 + a11*b10 + a12*b20;
    this.m11 = a10*b01 + a11*b11 + a12*b21;
    this.m12 = a10*b02 + a11*b12 + a12*b22;

    this.m20 = a20*b00 + a21*b10 + a22*b20;
    this.m21 = a20*b01 + a21*b11 + a22*b21;
    this.m22 = a20*b02 + a21*b12 + a22*b22;
    
    return this;
  }

  /**
   * @method multiplyVector2
   * 自身に2次元ベクトル v を乗じます。
   * 2次元ベクトルは (x, y, 1) として乗算します。
   *
   * ### Example
   *     mat = phina.geom.Matrix33(0, -1, 1, -1, 4, -2, 1, 1, 1);
   *     v = phina.geom.Vector2(2, 4)
   *     mat.multiplyVector2(v) // => {x: -3, y: 12}
   *
   * @param {import("./vector2").PrimitiveVector2} v 乗じるベクトル
   * @return {Vector2} 乗算結果のベクトル
   */
  multiplyVector2(v) {
    var vx = this.m00*v.x + this.m01*v.y + this.m02;
    var vy = this.m10*v.x + this.m11*v.y + this.m12;
    
    // return phina.geom.Vector2(vx, vy);
    return new Vector2(vx, vy);
  }

  // 行
  /**
   * @method getRow
   * row 番目の行を配列で返します。row が 0、1、2 のいずれかでなければ null を返します。
   *
   * ### Example
   *     mat1 = phina.geom.Matrix33(1, 2, 3, 4, 5, 6, 7, 8, 9);
   *     mat1.getRow(0); // [1, 2, 3]
   *     mat1.getRow(1); // [4, 5, 6]
   *     mat1.getRow(9); // null
   *
   * @param {0|1|2} row 行番号
   * @return {Number[]|null} 行を表す配列
   */
  getRow(row) {
    if ( row === 0 ) {
      return [ this.m00, this.m01, this.m02 ];
    }
    else if ( row === 1 ) {
      return [ this.m10, this.m11, this.m12 ];
    }
    else if ( row === 2 ) {
      return [ this.m20, this.m21, this.m22 ];
    }
    else {
      return null;
    }
  }

  /**
   * @method getCol
   * col 番目の列を配列で返します。col が 0、1、2 のいずれかでなければ null を返します。
   *
   * ### Example
   *     mat1 = phina.geom.Matrix33(1, 2, 3, 4, 5, 6, 7, 8, 9);
   *     mat1.getCol(0); // [1, 4, 7]
   *     mat1.getCol(1); // [2, 5, 8]
   *     mat1.getRow(-1); // null
   *
   * @param {0|1|2} col 列番号
   * @return {Number[]|null} 列を表す配列
   */
  getCol(col) {
    if ( col === 0 ) {
      return [ this.m00, this.m10, this.m20 ];
    }
    else if ( col === 1 ) {
      return [ this.m01, this.m11, this.m21 ];
    }
    else if ( col === 2 ) {
      return [ this.m02, this.m12, this.m22 ];
    }
    else {
      return null;
    }
  }

  /**
   * @method toString
   * 行列を JSON 形式で表現した文字列を返します。
   *
   * ### Example
   *     v = phina.geom.Vector2(3, 4);
   *     v2 = v.clone();
   *     v2.x == v.x; // => true
   *
   * @return {String} JSON 文字列
   */
  toString() {
    return format.call("|{m00}, {m01}, {m02}|\n|{m10}, {m11}, {m12}|\n|{m20}, {m21}, {m22}|", this);
    // return "|{m00}, {m01}, {m02}|\n|{m10}, {m11}, {m12}|\n|{m20}, {m21}, {m22}|".format(this);
  }

  /**
   * デフォルト単位行列を返す
   */
  static get IDENTITY() {
    return IDENTITY
  }
}

var IDENTITY = new Matrix33().identity();

/**
* @class phina.geom.Collision
* # 衝突判定用クラス
* 衝突判定のためのクラスです。すべてのメソッドがスタティックメソッドです。
* 
*/
class Collision {

  /**
   * @method testCircleCircle
   * @static
   * 2つの円領域が重なっているかどうかを判定します
   *
   * ### Example
   *     circle1 = phina.geom.Circle(100, 100, 30);
   *     circle2 = phina.geom.Circle(130, 140, 30);
   * phina.geom.Collision.testCircleCircle(circle1, circle2); // => true
   *
   * @param {Circle} circle0 円領域オブジェクト
   * @param {Circle} circle1 円領域オブジェクト
   * @return {Boolean} 領域が重なっているかどうか
   */
  static testCircleCircle(circle0, circle1) {
    var distanceSquared = Vector2.distanceSquared(circle0, circle1);
    return distanceSquared <= Math.pow(circle0.radius + circle1.radius, 2);
  }
  /**
   * @method testRectRect
   * @static
   * 2つの矩形領域が重なっているかどうかを判定します
   *
   * ### Example
   *     rect1 = phina.geom.Rect(100, 100, 30, 40);
   *     rect2 = phina.geom.Rect(200, 200, 10, 10);
   *     phina.geom.Collision.testRectRect(rect1, rect2); // => false
   *
   * @param {Rect} rect0 矩形領域オブジェクト
   * @param {Rect} rect1 矩形領域オブジェクト
   * @return {Boolean} 領域が重なっているかどうか
   */
  static testRectRect(rect0, rect1) {
    return (rect0.left < rect1.right) && (rect0.right > rect1.left) &&
      (rect0.top < rect1.bottom) && (rect0.bottom > rect1.top);
  }
  /**
   * @method testCircleRect
   * @static
   * 円領域と矩形領域が重なっているかどうかかを判定します
   *
   * ### Example
   *     circle = phina.geom.Circle(100, 100, 30);
   *     rect = phina.geom.Rect(100, 100, 30, 40);
   *     phina.geom.Collision.testCircleRect(circle, rect); // => true
   *
   * @param {Circle} circle 円領域オブジェクト
   * @param {Rect} rect 矩形領域オブジェクト
   * @return {Boolean} 領域が重なっているかどうか
   */
  static testCircleRect(circle, rect) {
    // まずは大きな矩形で判定(高速化)
    var bigRect = new Rect(rect.left-circle.radius, rect.top-circle.radius, rect.width+circle.radius*2, rect.height+circle.radius*2);
    if (bigRect.contains(circle.x, circle.y) === false) {
      return false;
    }
    
    // 2種類の矩形と衝突判定
    var r = new Rect(rect.left-circle.radius, rect.top, rect.width+circle.radius*2, rect.height);
    if (r.contains(circle.x, circle.y)) {
      return true;
    }
    r.set(rect.left, rect.top-circle.radius, rect.width, rect.height+circle.radius*2);
    if (r.contains(circle.x, circle.y)) {
      return true;
    }
    
    // 円と矩形の４点の判定
    var c = new Circle(circle.x, circle.y, circle.radius);
    // left top
    if (c.contains(rect.left, rect.top)) {
      return true;
    }
    // right top
    if (c.contains(rect.right, rect.top)) {
      return true;
    }
    // right bottom
    if (c.contains(rect.right, rect.bottom)) {
      return true;
    }
    // left bottom
    if (c.contains(rect.left, rect.bottom)) {
      return true;
    }
    
    return false;
  }
  /**
   * @method testCircleLine
   * @static
   * 円領域と線分が重なっているかどうかを判定します
   *
   * ### Example
   *     circle = phina.geom.Circle(100, 100, 20);
   *     p1 = phina.geom.Vector2(0, 0);
   *     p2 = phina.geom.Vector2(300, 400);
   *     phina.geom.Collision.testCircleLine(circle, p1, p2); // => true
   *
   * @param {Circle} circle 円領域オブジェクト
   * @param {import("./vector2").PrimitiveVector2} p1 線分の端の座標
   * @param {import("./vector2").PrimitiveVector2} p2 線分の端の座標
   * @return {Boolean} 円領域と線分が重なっているかどうか
   */
  static testCircleLine (circle, p1, p2) {
    // 先に線分端との判定
    if (circle.contains(p1.x, p1.y) || circle.contains(p2.x, p2.y)) return true;
    // 半径の2乗
    var r2 = circle.radius * circle.radius;
    // 円の中心座標
    var p3 = new Vector2(circle.x, circle.y);
    // 各ベクトル
    var p1p2 = Vector2.sub(p1, p2);
    var p1p3 = Vector2.sub(p1, p3);
    var p2p3 = Vector2.sub(p2, p3);
    // 外積
    var cross = Vector2.cross(p1p2, p1p3);
    // 外積の絶対値の2乗
    var cross2 = cross * cross;
    // p1p2の長さの2乗
    var length2 = p1p2.lengthSquared();
    // 円の中心から線分までの垂線の距離の2乗
    var d2 = cross2 / length2;
    // 円の半径の2乗より小さいなら重複
    if (d2 <= r2) {
      var dot1 = Vector2.dot(p1p3, p1p2);
      var dot2 = Vector2.dot(p2p3, p1p2);
      // 通常は内積の乗算
      if (dot1 * dot2 <= 0) return true;
    }
    return false;
  }
  /**
   * @method testLineLine
   * @static
   * 2つの線分が重なっているかどうかを判定します
   * 参考：http://www5d.biglobe.ne.jp/~tomoya03/shtml/algorithm/Intersection.htm
   *
   * ### Example
   *     p1 = phina.geom.Vector2(100, 100);
   *     p2 = phina.geom.Vector2(200, 200);
   *     p3 = phina.geom.Vector2(150, 240);
   *     p4 = phina.geom.Vector2(200, 100);
   * phina.geom.Collision.testLineLine(p1, p2, p3, p4); // => true
   *
   * @param {import("./vector2").PrimitiveVector2} p1 線分1の端の座標
   * @param {import("./vector2").PrimitiveVector2} p2 線分1の端の座標
   * @param {import("./vector2").PrimitiveVector2} p3 線分2の端の座標
   * @param {import("./vector2").PrimitiveVector2} p4 線分2の端の座標
   * @return {Boolean} 線分1と線分2が重なっているかどうか
   */
  static testLineLine (p1, p2, p3, p4) {
    //同一ＸＹ軸上に乗ってる場合の誤判定回避
    if (p1.x == p2.x && p1.x == p3.x && p1.x == p4.x) {
      var min = Math.min(p1.y, p2.y);
      var max = Math.max(p1.y, p2.y);
      if (min <= p3.y && p3.y <= max || min <= p4.y && p4.y <= max) return true;
      return false;
    }
    if (p1.y == p2.y && p1.y == p3.y && p1.y == p4.y) {
      var min = Math.min(p1.x, p2.x);
      var max = Math.max(p1.x, p2.x);
      if (min <= p3.x && p3.x <= max || min <= p4.x && p4.x <= max) return true;
      return false;
    }
    //通常判定
    var a = (p1.x - p2.x) * (p3.y - p1.y) + (p1.y - p2.y) * (p1.x - p3.x);
    var b = (p1.x - p2.x) * (p4.y - p1.y) + (p1.y - p2.y) * (p1.x - p4.x);
    var c = (p3.x - p4.x) * (p1.y - p3.y) + (p3.y - p4.y) * (p3.x - p1.x);
    var d = (p3.x - p4.x) * (p2.y - p3.y) + (p3.y - p4.y) * (p3.x - p2.x);
    return a * b <= 0 && c * d <= 0;
  }
  /**
   * @method testRectLine
   * @static
   * 矩形と線分が重なっているかどうかを判定します
   *
   * ### Example
   *     rect = phina.geom.Rect(120, 130, 40, 50);
   *     p1 = phina.geom.Vector2(100, 100);
   *     p2 = phina.geom.Vector2(200, 200);
   * phina.geom.Collision.testRectLine(rect, p1, p2); // => true
   *
   * @param {Rect} rect 矩形領域オブジェクト
   * @param {import("./vector2").PrimitiveVector2} p1 線分の端の座標
   * @param {import("./vector2").PrimitiveVector2} p2 線分の端の座標
   * @return {Boolean} 矩形と線分が重なっているかどうか
   */
  static testRectLine (rect, p1, p2) {
      //包含判定(p1が含まれてれば良いのでp2の判定はしない）
      if (rect.left <= p1.x && p1.x <= rect.right && rect.top <= p1.y && p1.y <= rect.bottom ) return true;

      //矩形の４点
      var r1 = new Vector2(rect.left, rect.top);     //左上
      var r2 = new Vector2(rect.right, rect.top);    //右上
      var r3 = new Vector2(rect.right, rect.bottom); //右下
      var r4 = new Vector2(rect.left, rect.bottom);  //左下

      //矩形の４辺をなす線分との接触判定
      if (Collision.testLineLine(p1, p2, r1, r2)) return true;
      if (Collision.testLineLine(p1, p2, r2, r3)) return true;
      if (Collision.testLineLine(p1, p2, r3, r4)) return true;
      if (Collision.testLineLine(p1, p2, r1, r4)) return true;
      return false;
  }

}

/**
 * @class phina.geom.Vector3
 * # 3次元ベクトルクラス（未実装）
 * 3次元のベクトルや座標を表すクラスです。
 */
class Vector3 {

  /**
   * @param {number} [x=0]
   * @param {number} [y=0]
   * @param {number} [z=0]
   */
  constructor(x, y, z) {
    /**
     * x座標
     * @type {number}
     */
    this.x = x || 0;

    /**
     * y座標
     * @type {number}
     */
    this.y = y || 0;

    /**
     * z座標
     * @type {number}
     */
    this.z = z || 0;

    /**
     * z軸回転角度
     */
    this.alpha = 0;

    /**
     * x軸回転角度
     */
    this.beta = 0;

    /**
     * y軸回転角度
     */
    this.gamma = 0;
  }

}

/**
 * Canvasのfillstyle/strokeStyleの値として使用できる型。文字列の場合、CSS colorデータ型に準拠するもの
 * @typedef {string | CanvasGradient | CanvasPattern} CanvasStyle
 */

/**
 * @class phina.graphics.Canvas
 * キャンバス拡張クラス
 */
class Canvas {

  /**
   * @param {string | HTMLCanvasElement} [canvas] ベースとなるcanvas要素。文字列で指定するときは`#phina`のようにセレクタ形式にする。指定しなかった場合は新規作成される
   */
  constructor(canvas) {
    /** @type HTMLCanvasElement */
    this.canvas;
    if (typeof canvas === 'string') {
      this.canvas = document.querySelector(canvas);
    } else {
      this.canvas = canvas || document.createElement('canvas');
    }

    /** @type HTMLCanvasElement */
    this.domElement = this.canvas;

    /** @type CanvasRenderingContext2D */
    this.context = this.canvas.getContext('2d');
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';
  }

  /**
   * サイズをセット
   * @param {number} width
   * @param {number} height
   * @returns {this}
   */
  setSize(width, height) {
    this.canvas.width   = width;
    this.canvas.height  = height;
    return this;
  }

  /**
   * サイズを画面（ウィンドウサイズ）に合わせてリセット
   * @returns {this}
   */
  setSizeToScreen() {
    this.canvas.style.position  = "fixed";
    this.canvas.style.margin    = "0px";
    this.canvas.style.padding   = "0px";
    this.canvas.style.left      = "0px";
    this.canvas.style.top       = "0px";
    return this.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * 比率を維持しながらサイズを画面（ウィンドウサイズ）に合わせる
   * @param {boolean} [isEver=true] ウィンドウリサイズで変更が必要になるたびにリサイズ処理をするかどうか
   * @returns {void}
   */
  fitScreen(isEver) {
    isEver = isEver === undefined ? true : isEver;

    var _fitFunc = function() {
      var e = this.domElement;
      var s = e.style;
      
      s.position = "absolute";
      s.margin = "auto";
      s.left = "0px";
      s.top  = "0px";
      s.bottom = "0px";
      s.right = "0px";

      var rateWidth = e.width/window.innerWidth;
      var rateHeight= e.height/window.innerHeight;
      var rate = e.height/e.width;
      
      if (rateWidth > rateHeight) {
        s.width  = Math.floor(innerWidth)+"px";
        s.height = Math.floor(innerWidth*rate)+"px";
      }
      else {
        s.width  = Math.floor(innerHeight/rate)+"px";
        s.height = Math.floor(innerHeight)+"px";
      }
    }.bind(this);
    
    // 一度実行しておく
    _fitFunc();

    // リサイズ時のリスナとして登録しておく
    if (isEver) {
      phina.global.addEventListener("resize", _fitFunc, false);
    }
  }

  /**
   * クリア
   * @param {number} [x=0]
   * @param {number} [y=0]
   * @param {number} [width]
   * @param {number} [height]
   * @returns {this}
   */
  clear(x, y, width, height) {
    x = x || 0;
    y = y || 0;
    width = width || this.width;
    height= height|| this.height;
    this.context.clearRect(x, y, width, height);
    return this;
  }

  /**
   * @param {CanvasStyle} fillStyle
   * @param {number} [x]
   * @param {number} [y]
   * @param {number} [width]
   * @param {number} [height]
   * @returns {this}
   */
  clearColor(fillStyle, x, y, width, height) {
    x = x || 0;
    y = y || 0;
    width = width || this.width;
    height= height|| this.height;

    var context = this.context;

    context.save();
    context.setTransform(1.0, 0.0, 0.0, 1.0, 0.0, 0.0); // 行列初期化
    context.fillStyle = fillStyle;     // 塗りつぶしスタイルセット
    context.fillRect(x, y, width, height);
    context.restore();

    return this;
  }


  /**
   * パスを開始(リセット)
   * @returns {this}
   */
  beginPath() {
    this.context.beginPath();
    return this;
  }

  /**
   * パスを閉じる
   * @returns {this}
   */
  closePath() {
    this.context.closePath();
    return this;
  }


  /**
   * 新規パス生成
   * @param {number} x
   * @param {number} y
   * @returns {this}
   */
  moveTo(x, y) {
    this.context.moveTo(x, y);
    return this;
  }

  /**
   * パスに追加
   * @param {number} x
   * @param {number} y
   * @returns {this}
   */
  lineTo(x, y) {
    this.context.lineTo(x, y);
    return this;
  }

  /**
   * 
   * @returns {this}
   */
  quadraticCurveTo() {
    this.context.quadraticCurveTo.apply(this.context, arguments);
    return this;
  }

  /**
   * 
   * @returns {this}
   */
  bezierCurveTo() {
    this.context.bezierCurveTo.apply(this.context, arguments);
    return this;
  }

  /**
   * パス内を塗りつぶす
   * @returns {this}
   */
  fill() {
    this.context.fill();
    return this;
  }

  /**
   * パス上にラインを引く
   * @returns {this}
   */
  stroke() {
    this.context.stroke();
    return this;
  }

  /**
   * クリップ
   * @returns {this}
   */
  clip() {
    this.context.clip();
    return this;
  }

      
  /**
   * 点描画
   * @param {number} x
   * @param {number} y
   * @returns {this}
   */
  drawPoint(x, y) {
    return this.strokeRect(x, y, 1, 1);
  }

  /**
   * ラインパスを作成
   * @param {number} x0
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   * @returns {this}
   */
  line(x0, y0, x1, y1) {
    return this.moveTo(x0, y0).lineTo(x1, y1);
  }
  
  /**
   * ラインを描画
   * @param {number} x0
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   * @returns {this}
   */
  drawLine(x0, y0, x1, y1) {
    return this.beginPath().line(x0, y0, x1, y1).stroke();
  }

  /**
   * ダッシュラインを描画
   * @param {number} x0
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   * @param {string|number} pattern
   * @returns {this}
   */
  drawDashLine(x0, y0, x1, y1, pattern) {
    var patternTable = null;
    if (typeof(pattern) == "string") {
      patternTable = pattern;
    }
    else {
      pattern = pattern || 0xf0f0;
      patternTable = pattern.toString(2);
    }
    // patternTable = patternTable.padding(16, '1');
    patternTable = padding.call(patternTable, 16, '1');
    
    var vx = x1-x0;
    var vy = y1-y0;
    var len = Math.sqrt(vx*vx + vy*vy);
    vx/=len; vy/=len;
    
    var x = x0;
    var y = y0;
    for (var i=0; i<len; ++i) {
      if (patternTable[i%16] == '1') {
        this.drawPoint(x, y);
        // this.fillRect(x, y, this.context.lineWidth, this.context.lineWidth);
      }
      x += vx;
      y += vy;
    }
    
    return this;
  }

  /**
   * v0(x0, y0), v1(x1, y1) から角度を求めて矢印を描画
   * http://hakuhin.jp/as/rotation.html
   * @param {number} x0
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   * @param {number} arrowRadius
   * @returns {this}
   */
  drawArrow(x0, y0, x1, y1, arrowRadius) {
    var vx = x1-x0;
    var vy = y1-y0;
    var angle = Math.atan2(vy, vx)*180/Math.PI;
    
    this.drawLine(x0, y0, x1, y1);
    this.fillPolygon(x1, y1, arrowRadius || 5, 3, angle);
    
    return this;
  }


  /**
   * lines
   * @returns {this}
   */
  lines() {
    this.moveTo(arguments[0], arguments[1]);
    for (var i=1,len=arguments.length/2; i<len; ++i) {
      this.lineTo(arguments[i*2], arguments[i*2+1]);
    }
    return this;
  }

  /**
   * ラインストローク描画
   * @returns {this}
   */
  strokeLines() {
    this.beginPath();
    this.lines.apply(this, arguments);
    this.stroke();
    return this;
  }

  /**
   * ライン塗りつぶし描画
   * @returns {this}
   */
  fillLines() {
    this.beginPath();
    this.lines.apply(this, arguments);
    this.fill();
    return this;
  }
  
  /**
   * 四角形パスを作成する
   * @param {number} _x
   * @param {number} _y
   * @param {number} _width
   * @param {number} _height
   * @returns {this}
   */
  rect(_x, _y, _width, _height) {
    this.context.rect.apply(this.context, arguments);
    return this;
  }
  
  /**
   * 四角形塗りつぶし描画
   * @returns {this}
   */
  fillRect() {
    this.context.fillRect.apply(this.context, arguments);
    return this;
  }
  
  /**
   * 四角形ライン描画
   * @returns {this}
   */
  strokeRect() {
    this.context.strokeRect.apply(this.context, arguments);
    return this;
  }
  
  /**
   * 角丸四角形パス
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @param {number} radius
   * @returns {this}
   */
  roundRect(x, y, width, height, radius) {
    var l = x + radius;
    var r = x + width - radius;
    var t = y + radius;
    var b = y + height - radius;
    
    /*
    var ctx = this.context;
    ctx.moveTo(l, y);
    ctx.lineTo(r, y);
    ctx.quadraticCurveTo(x+width, y, x+width, t);
    ctx.lineTo(x+width, b);
    ctx.quadraticCurveTo(x+width, y+height, r, y+height);
    ctx.lineTo(l, y+height);
    ctx.quadraticCurveTo(x, y+height, x, b);
    ctx.lineTo(x, t);
    ctx.quadraticCurveTo(x, y, l, y);
    /**/
    
    this.context.arc(l, t, radius,     -Math.PI, -Math.PI*0.5, false);  // 左上
    this.context.arc(r, t, radius, -Math.PI*0.5,            0, false);  // 右上
    this.context.arc(r, b, radius,            0,  Math.PI*0.5, false);  // 右下
    this.context.arc(l, b, radius,  Math.PI*0.5,      Math.PI, false);  // 左下
    this.closePath();
    
    return this;
  }

  /**
   * 角丸四角形塗りつぶし
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @param {number} radius
   * @returns {this}
   */
  fillRoundRect(x, y, width, height, radius) {
    return this.beginPath().roundRect(x, y, width, height, radius).fill();
  }

  /**
   * 角丸四角形ストローク描画
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @param {number} radius
   * @returns {this}
   */
  strokeRoundRect(x, y, width, height, radius) {
    return this.beginPath().roundRect(x, y, width, height, radius).stroke();
  }

  /**
   * 円のパスを設定
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @returns {this}
   */
  circle(x, y, radius) {
    this.context.arc(x, y, radius, 0, Math.PI*2, false);
    return this;
  }
  
  /**
   * 塗りつぶし円を描画
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @returns {this}
   */
  fillCircle(x, y, radius) {
    var c = this.context;
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI*2, false);
    c.closePath();
    c.fill();
    return this;
  }
  
  /**
   * ストローク円を描画
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @returns {this}
   */
  strokeCircle(x, y, radius) {
    var c = this.context;
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI*2, false);
    c.closePath();
    c.stroke();
    return this;
  }

  /**
   * 円弧のパスを設定
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {number} startAngle
   * @param {number} endAngle
   * @param {boolean} [anticlockwise]
   * @returns {this}
   */
  arc(x, y, radius, startAngle, endAngle, anticlockwise) {
    this.context.arc(x, y, radius, startAngle, endAngle, anticlockwise);
    return this;
  }
  
  /**
   * 塗りつぶし円弧を描画
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {number} startAngle
   * @param {number} endAngle
   * @param {boolean} [anticlockwise]
   * @returns {this}
   */
  fillArc(x, y, radius, startAngle, endAngle, anticlockwise) {
    return this.beginPath().arc(x, y, radius, startAngle, endAngle, anticlockwise).fill();
  }
  
  /**
   * ストローク円弧を描画
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {number} startAngle
   * @param {number} endAngle
   * @param {boolean} [anticlockwise]
   * @returns {this}
   */
  strokeArc(x, y, radius, startAngle, endAngle, anticlockwise) {
    return this.beginPath().arc(x, y, radius, startAngle, endAngle, anticlockwise).stroke();
  }


  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {number} startAngle
   * @param {number} endAngle
   * @param {boolean} [anticlockwise]
   * @returns {this}
   */
  pie(x, y, radius, startAngle, endAngle, anticlockwise) {
    var context = this.context;
    context.beginPath();
    context.moveTo(0, 0);
    context.arc(x, y, radius, startAngle, endAngle, anticlockwise);
    context.closePath();
    return this;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {number} startAngle
   * @param {number} endAngle
   * @param {boolean} [anticlockwise]
   * @returns {this}
   */
  fillPie(x, y, radius, startAngle, endAngle, anticlockwise) {
    return this.beginPath().pie(x, y, radius, startAngle, endAngle, anticlockwise).fill();
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {number} startAngle
   * @param {number} endAngle
   * @param {boolean} [anticlockwise]
   * @returns {this}
   */
  strokePie(x, y, radius, startAngle, endAngle, anticlockwise) {
    return this.beginPath().pie(x, y, radius, startAngle, endAngle, anticlockwise).stroke();
  }

  
  /**
   * ポリゴンパス
   * @param {number} x
   * @param {number} y
   * @param {number} size
   * @param {number} sides
   * @param {number} [offsetAngle]
   * @returns {this}
   */
  polygon(x, y, size, sides, offsetAngle) {
    var radDiv = (Math.PI*2)/sides;
    var radOffset = (offsetAngle!==undefined) ? offsetAngle*Math.PI/180 : -Math.PI/2;
    
    this.moveTo(x + Math.cos(radOffset)*size, y + Math.sin(radOffset)*size);
    for (var i=1; i<sides; ++i) {
      var rad = radDiv*i+radOffset;
      this.lineTo(
        x + Math.cos(rad)*size,
        y + Math.sin(rad)*size
      );
    }
    this.closePath();
    return this;
  }

  /**
   * ポリゴン塗りつぶし
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {number} sides
   * @param {number} [offsetAngle]
   * @returns {this}
   */
  fillPolygon(x, y, radius, sides, offsetAngle) {
    return this.beginPath().polygon(x, y, radius, sides, offsetAngle).fill();
  }

  /**
   * ポリゴンストローク描画
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {number} sides
   * @param {number} [offsetAngle]
   * @returns {this}
   */
  strokePolygon(x, y, radius, sides, offsetAngle) {
    return this.beginPath().polygon(x, y, radius, sides, offsetAngle).stroke();
  }
  
  /**
   * star
   * @param {number} [x=0]
   * @param {number} [y=0]
   * @param {number} [radius=64]
   * @param {number} [sides=5]
   * @param {any} [sideIndent=0.38]
   * @param {number} [offsetAngle]
   */
  star(x, y, radius, sides, sideIndent, offsetAngle) {
    x = x || 0;
    y = y || 0;
    radius = radius || 64;
    sides = sides || 5;
    var sideIndentRadius = radius * (sideIndent || 0.38);
    var radOffset = (offsetAngle) ? offsetAngle*Math.PI/180 : -Math.PI/2;
    var radDiv = (Math.PI*2)/sides/2;

    this.moveTo(
      x + Math.cos(radOffset)*radius,
      y + Math.sin(radOffset)*radius
    );
    for (var i=1; i<sides*2; ++i) {
      var rad = radDiv*i + radOffset;
      var len = (i%2) ? sideIndentRadius : radius;
      this.lineTo(
        x + Math.cos(rad)*len,
        y + Math.sin(rad)*len
      );
    }
    this.closePath();

    return this;
  }

  /**
   * 星を塗りつぶし描画
   * @param {number} [x]
   * @param {number} [y]
   * @param {number} [radius]
   * @param {number} [sides]
   * @param {any} [sideIndent]
   * @param {number} [offsetAngle]
   * @returns {this}
   */
  fillStar(x, y, radius, sides, sideIndent, offsetAngle) {
    this.beginPath().star(x, y, radius, sides, sideIndent, offsetAngle).fill();
    return this;
  }

  /**
   * 星をストローク描画
   * @param {number} [x]
   * @param {number} [y]
   * @param {number} [radius]
   * @param {number} [sides]
   * @param {any} [sideIndent]
   * @param {number} [offsetAngle]
   * @returns {this}
   */
  strokeStar(x, y, radius, sides, sideIndent, offsetAngle) {
    this.beginPath().star(x, y, radius, sides, sideIndent, offsetAngle).stroke();
    return this;
  }

  /**
   * heart
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {number} angle
   * @returns {this}
   */
  heart(x, y, radius, angle) {
    var half_radius = radius*0.5;
    // var rad = (angle === undefined) ? Math.PI/4 : Math.degToRad(angle);
    var rad = (angle === undefined) ? Math.PI/4 : degToRad(angle);

    // 半径 half_radius の角度 angle 上の点との接線を求める
    var p = Math.cos(rad)*half_radius;
    var q = Math.sin(rad)*half_radius;

    // 円の接線の方程式 px + qy = r^2 より y = (r^2-px)/q
    var x2 = -half_radius;
    var y2 = (half_radius*half_radius-p*x2)/q;

    // 中心位置調整
    var height = y2 + half_radius;
    var offsetY = half_radius-height/2;

    // パスをセット
    this.moveTo(0+x, y2+y+offsetY);

    this.arc(-half_radius+x, 0+y+offsetY, half_radius, Math.PI-rad, Math.PI*2);
    this.arc(half_radius+x, 0+y+offsetY, half_radius, Math.PI, rad);
    this.closePath();

    return this;
  }

  /**
   * fill heart
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {number} angle
   * @returns {this}
   */
  fillHeart(x, y, radius, angle) {
    return this.beginPath().heart(x, y, radius, angle).fill();
  }

  /**
   * stroke heart
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {number} angle
   * @returns {this}
   */
  strokeHeart(x, y, radius, angle) {
    return this.beginPath().heart(x, y, radius, angle).stroke();
  }

 /**
  * http://stackoverflow.com/questions/14169234/the-relation-of-the-bezier-curve-and-ellipse
  * @param {number} x
  * @param {number} y
  * @param {number} w
  * @param {number} h
  * @returns {this}
  */
  ellipse(x, y, w, h) {
    var ctx = this.context;
    var kappa = 0.5522848;

    var ox = (w / 2) * kappa; // control point offset horizontal
    var oy = (h / 2) * kappa; // control point offset vertical
    var xe = x + w;           // x-end
    var ye = y + h;           // y-end
    var xm = x + w / 2;       // x-middle
    var ym = y + h / 2;       // y-middle

    ctx.moveTo(x, ym);
    ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
    ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
    ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
    ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
    // ctx.closePath();

    return this;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @returns {this}
   */
  fillEllipse(x, y, width, height) {
    return this.beginPath().ellipse(x, y, width, height).fill();
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @returns {this}
   */
  strokeEllipse(x, y, width, height) {
    return this.beginPath().ellipse(x, y, width, height).stroke();
  }

  /**
   * 
   * @returns {this}
   */
  fillText() {
    this.context.fillText.apply(this.context, arguments);
    return this;
  }

  /**
   * 
   * @returns {this}
   */
  strokeText() {
    this.context.strokeText.apply(this.context, arguments);
    return this;
  }

  /**
   * 画像を描画
   * @returns {void} this返し忘れ？
   */
  drawImage() {
    this.context.drawImage.apply(this.context, arguments);
  }

  /**
   * 行列をセット
   * @param {number} m11
   * @param {number} m12
   * @param {number} m21
   * @param {number} m22
   * @param {number} dx
   * @param {number} dy
   * @returns {this}
   */
  setTransform(m11, m12, m21, m22, dx, dy) {
    this.context.setTransform(m11, m12, m21, m22, dx, dy);
    return this;
  }

  /**
   * 行列をリセット
   * @returns {this}
   */
  resetTransform() {
    this.setTransform(1.0, 0.0, 0.0, 1.0, 0.0, 0.0);
    return this;
  }
  /**
   * 中心に移動
   * @returns {this}
   */
  transformCenter() {
    this.context.setTransform(1, 0, 0, 1, this.width/2, this.height/2);
    return this;
  }

  /**
   * 移動
   * @param {number} x
   * @param {number} y
   * @returns {this}
   */
  translate(x, y) {
    this.context.translate(x, y);
    return this;
  }
  
  /**
   * 回転
   * @param {number} rotation
   * @returns {this}
   */
  rotate(rotation) {
    this.context.rotate(rotation);
    return this;
  }
  
  /**
   * スケール
   * @param {number} scaleX
   * @param {number} scaleY
   * @returns {this}
   */
  scale(scaleX, scaleY) {
    this.context.scale(scaleX, scaleY);
    return this;
  }

  /**
   * 状態を保存
   * @returns {this}
   */
  save() {
    this.context.save();
    return this;
  }

  /**
   * 状態を復元
   * @returns {this}
   */
  restore() {
    this.context.restore();
    return this;
  }

  /**
   * 画像として保存
   * @param {string} [mime_type="image/png"]
   * @returns {void}
   */
  saveAsImage(mime_type) {
    mime_type = mime_type || "image/png";
    var data_url = this.canvas.toDataURL(mime_type);
    // data_url = data_url.replace(mime_type, "image/octet-stream");
    window.open(data_url, "save");
    
    // toDataURL を使えば下記のようなツールが作れるかも!!
    // TODO: プログラムで絵をかいて保存できるツール
  }

  /**
   * 幅
   */
  get width()   { return this.canvas.width; }
  set width(v)  { this.canvas.width = v; }

  /**
   * 高さ
   */
  get height()   { return this.canvas.height; }
  set height(v)  { this.canvas.height = v; }

  get fillStyle()   { return this.context.fillStyle; }
  set fillStyle(v)  { this.context.fillStyle = v; }

  get strokeStyle()   { return this.context.strokeStyle; }
  set strokeStyle(v)  { this.context.strokeStyle = v; }

  get globalAlpha()   { return this.context.globalAlpha; }
  set globalAlpha(v)  { this.context.globalAlpha = v; }

  get globalCompositeOperation()   { return this.context.globalCompositeOperation; }
  set globalCompositeOperation(v)  { this.context.globalCompositeOperation = v; }

  get shadowBlur()   { return this.context.shadowBlur; }
  set shadowBlur(v)  { this.context.shadowBlur = v; }

  get shadowColor()   { return this.context.shadowColor; }
  set shadowColor(v)  { this.context.shadowColor = v; }

  get shadowOffsetX()   { return this.context.shadowOffsetX; }
  set shadowOffsetX(v)  { this.context.shadowOffsetX = v; }

  get shadowOffsetY()   { return this.context.shadowOffsetY; }
  set shadowOffsetY(v)  { this.context.shadowOffsetY = v; }

  get lineCap()   { return this.context.lineCap; }
  set lineCap(v)  { this.context.lineCap = v; }

  get lineJoin()   { return this.context.lineJoin; }
  set lineJoin(v)  { this.context.lineJoin = v; }

  get miterLimit()   { return this.context.miterLimit; }
  set miterLimit(v)  { this.context.miterLimit = v; }

  get lineWidth()   { return this.context.lineWidth; }
  set lineWidth(v)  { this.context.lineWidth = v; }

  get font()   { return this.context.font; }
  set font(v)  { this.context.font = v; }

  get textAlign()   { return this.context.textAlign; }
  set textAlign(v)  { this.context.textAlign = v; }

  get textBaseline()   { return this.context.textBaseline; }
  set textBaseline(v)  { this.context.textBaseline = v; }

  get imageSmoothingEnabled()   { return this.context.imageSmoothingEnabled; }
  set imageSmoothingEnabled(v)  {
    this.context.imageSmoothingEnabled = v;
    this.context['webkitImageSmoothingEnabled'] = v;
    this.context['mozImageSmoothingEnabled'] = v;
  }

  /**
   * テキストの長さを計測
   * @param {string} font
   * @param {string} text
   * @returns {TextMetrics}
   */
  static measureText(font, text) {
    this._context.font = font;
    return this._context.measureText(text);
  }

  /**
   * 線形グラデーションを生成
   * @returns {CanvasGradient}
   */
  static createLinearGradient() {
    return this._context.createLinearGradient.apply(this._context, arguments);
  }

  /**
   * 円形グラデーションを生成
   * @returns {CanvasGradient}
   */
  static createRadialGradient() {
    return this._context.createRadialGradient.apply(this._context, arguments);
  }

}

/**
 * デフォルトのプライベートCanvasコンテキスト  
 * Staticメソッド用
 */
Canvas._context = (function() {
  if (Support.canvas) {
    return document.createElement('canvas').getContext('2d');
  }
  else {
    return null;
  }
})();

// import { first, last, clear } from "../core/array"

/**
 * @class phina.input.Input
 * _extends phina.util.EventDispatcher
 */
class Input extends EventDispatcher {

  /**
   * @constructor
   * @param {HTMLCanvasElement | HTMLDocument} domElement KeyBoardサブクラスではHTMLDocument、それ以外のサブクラスではHTMLCanvasElement
   */
  constructor(domElement) {
    super();

    this.domElement = domElement || window.document;

    this.position = new Vector2(0, 0);
    this.startPosition = new Vector2(0, 0);
    this.deltaPosition = new Vector2(0, 0);
    this.prevPosition = new Vector2(0, 0);
    this._tempPosition = new Vector2(0, 0);

    this.maxCacheNum = Input.defaults.maxCacheNum;
    this.minDistance = Input.defaults.minDistance;
    this.maxDistance = Input.defaults.maxDistance;
    this.cachePositions = [];
    this.flickVelocity = new Vector2(0, 0);

    this.flags = 0;
    
    /**
     * KeyBoardクラス拡張時の型エラー対策のためunion型とするが、本クラスではnumberとして使用
     * @type {number | {[k: string]: number}}
     */
    this.last;
  }

  /**
   * 更新
   * @returns {void}
   */
  update() {
    this.last = this.now;
    this.now = this.flags;
    this.start = (this.now ^ this.last) & this.now;
    this.end   = (this.now ^ this.last) & this.last;

    // 変化値を更新
    this.deltaPosition.x = this._tempPosition.x - this.position.x;
    this.deltaPosition.y = this._tempPosition.y - this.position.y;

    if (this.deltaPosition.x === 0 && this.deltaPosition.y === 0) {
      this._moveFlag = false;
    }
    else {
      this._moveFlag = true;
    }

    if (this.start) {
      this.startPosition.set(this.position.x, this.position.y);
    }

    // 前回の座標を更新
    this.prevPosition.set(this.position.x, this.position.y);

    // 現在の位置を更新
    this.position.set(this._tempPosition.x, this._tempPosition.y);

    if (this.cachePositions.length > this.maxCacheNum) {
      this.cachePositions.shift();
    }
    this.cachePositions.push(this.position.clone());
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} [flag=1] デフォルトは1(true)
   * @returns {void}
   */
  _start(x, y, flag) {
    flag = (flag !== undefined) ? flag : 1;
    // console.log('start', x, y);
    this._move(x, y);

    this.flags |= flag;

    x = this._tempPosition.x;
    y = this._tempPosition.y;
    this.position.set(x, y);
    this.prevPosition.set(x, y);

    this.flickVelocity.set(0, 0);
    // this.cachePositions.clear();
    this.cachePositions.length = 0;
  }

  /**
   * @param {number} [flag=1]
   * @returns {void}
   */
  _end(flag) {
    flag = (flag !== undefined) ? flag : 1;
    this.flags &= ~(flag);

    if (this.cachePositions.length < 2) return;

    // var first = this.cachePositions.first;
    // var last = this.cachePositions.last;
    var first = this.cachePositions[0];
    var last = this.cachePositions[this.cachePositions.length-1];

    var v = Vector2.sub(last, first);

    var len = v.length();

    if (len > this.minDistance) {
      // var normalLen = len.clamp(this.minDistance, this.maxDistance);
      var normalLen = clamp(len, this.minDistance, this.maxDistance);
      v.div(len).mul(normalLen);
      this.flickVelocity.set(v.x, v.y);
    }

    // this.cachePositions.clear();
    this.cachePositions.length = 0;
  }

  /**
   * スケールを考慮して位置を移動
   * @param {number} x
   * @param {number} y
   * @returns {void}
   */
  _move(x, y) {
    this._tempPosition.x = x;
    this._tempPosition.y = y;

    // adjust scale
    var elm = /** @type {HTMLCanvasElement} */(this.domElement);
    var rect = elm.getBoundingClientRect();
    if (rect.width) {
      this._tempPosition.x *= elm.width / rect.width;
    }
    if (rect.height) {
      this._tempPosition.y *= elm.height / rect.height;
    }
  }

  /**
   * @property    x
   * x座標値
   */
  get x() { return this.position.x; }
  set x(v) { this.position.x = v; }

  /**
   * @property    y
   * y座標値
   */
  get y() { return this.position.y; }
  set y(v) { this.position.y = v; }

  /**
   * @property    dx
   * dx値
   */
  get dx() { return this.deltaPosition.x; }
  set dx(v) { this.deltaPosition.x = v; }

  /**
   * @property    dy
   * dy値
   */
  get dy() { return this.deltaPosition.y; }
  set dy(v) { this.deltaPosition.y = v; }

  /**
   * @property    fx
   * fx値
   */
  get fx() { return this.flickVelocity.x; }
  set fx(v) { this.flickVelocity.x = v; }

  /**
   * @property    fy
   * fy値
   */
  get fy() { return this.flickVelocity.y; }
  set fy(v) { this.flickVelocity.y = v; }

}

Input.defaults = {
  maxCacheNum: 3,
  minDistance: 10,
  maxDistance: 100,
};

/**
 * @class phina.input.Keyboard
 * _extends phina.input.Input
 */
class Keyboard extends Input {

  /**
   * @constructor
   * @param {Document} domElement
   */
  constructor(domElement) {
    super(domElement);

    /** @type {HTMLDocument} */
    this.domElement;

    /** @type {{[k: number]: boolean}} */
    this.key = {};
    /** @type {{[k: number]: any}} true|false or 1|0 */
    this.press  = {};
    /** @type {{[k: number]: any}} */
    this.down   = {};
    /** @type {{[k: number]: any}} */
    this.up     = {};
    /** @type {{[k: number]: any}} */
    this.last   = {};

    /** @type {number | null} */
    this._keydown = null;
    /** @type {number | null} */
    this._keyup = null;
    /** @type {number | null} */
    this._keypress = null;

    var self = this;
    this.domElement.addEventListener('keydown', function(e) {
      self.key[e.keyCode] = true;
      self._keydown = e.keyCode;
    });

    this.domElement.addEventListener('keyup', function(e) {
      self.key[e.keyCode] = false;
      self._keyup = e.keyCode;
    });
    this.domElement.addEventListener('keypress', function(e) {
      self._keypress = e.keyCode;
    });
  }

  /**
   * 情報更新処理
   * 毎フレーム呼んで下さい.
   * @returns {this}
   */
  update() {
    // TODO: 一括ビット演算で行うよう修正する
    for (var k in this.key) {
      this.last[k]    = this.press[k];
      this.press[k]   = this.key[k];
      
      this.down[k] = (this.press[k] ^ this.last[k]) & this.press[k];
      this.up[k] = (this.press[k] ^ this.last[k]) & this.last[k];
    }

    if (this._keydown) {
      this.flare('keydown', { keyCode: this._keydown });
      this._keydown = null;
    }
    if (this._keyup) {
      this.flare('keyup', { keyCode: this._keyup });
      this._keyup = null;
    }
    if (this._keypress) {
      this.flare('keypress', { keyCode: this._keypress });
      this._keypress = null;
    }
    
    return this;
  }

  /**
   * キーを押しているかをチェック
   * @param   {number|keyof typeof Keyboard.KEY_CODE} key keyCode or keyName
   * @returns {Boolean}   チェック結果
   */
  getKey(key) {
    if (typeof(key) === "string") {
      key = Keyboard.KEY_CODE[key];
    }
    return !!this.press[key] === true;
  }
  
  /**
   * キーを押したかをチェック
   * @param   {number|keyof typeof Keyboard.KEY_CODE} key keyCode or keyName
   * @returns {Boolean}   チェック結果
   */
  getKeyDown(key) {
    if (typeof(key) == "string") {
      key = Keyboard.KEY_CODE[key];
    }
    return this.down[key] == true;
  }
  
  /**
   * キーを離したかをチェック
   * @param   {number|keyof typeof Keyboard.KEY_CODE} key keyCode or keyName
   * @returns {Boolean}   チェック結果
   */
  getKeyUp(key) {
    if (typeof(key) == "string") {
      key = Keyboard.KEY_CODE[key];
    }
    return this.up[key] == true;
  }
  
  /**
   * キーの方向を Angle(Degree) で取得
   * @returns {Boolean}   角度(Degree)
   */
  getKeyAngle() {
    var angle = null;
    var arrowBit =
      // (this.getKey("left")   << 3) | // 1000
      // (this.getKey("up")     << 2) | // 0100
      // (this.getKey("right")  << 1) | // 0010
      // (this.getKey("down"));         // 0001
      (this.getKey("left") ? 1 : 0   << 3) | // 1000
      (this.getKey("up") ? 1 : 0     << 2) | // 0100
      (this.getKey("right") ? 1 : 0  << 1) | // 0010
      (this.getKey("down") ? 1 : 0);         // 0001
    
    if (arrowBit !== 0 && Keyboard.ARROW_BIT_TO_ANGLE_TABLE.hasOwnProperty(arrowBit)) {
      angle = Keyboard.ARROW_BIT_TO_ANGLE_TABLE[arrowBit];
    }
    
    return angle;
  }

  /**
   * キーの押している向きを取得
   * 正規化されている
   * @returns {Vector2}
   */
  getKeyDirection() {
    var direction = new Vector2(0, 0);

    if (this.getKey("left")) {
      direction.x = -1;
    }
    else if (this.getKey("right")) {
      direction.x = 1;
    }
    if (this.getKey("up")) {
      direction.y = -1;
    }
    else if (this.getKey("down")) {
      direction.y = 1;
    }

    if (direction.x && direction.y) {
      direction.div(Math.SQRT2);
    }

    return direction;
  }
  
  /**
   * キーの状態を設定する
   * @param {string | number} key
   * @param {boolean} flag
   * @returns {this}
   */
  setKey(key, flag) {
    if (typeof(key) == "string") {
      key = Keyboard.KEY_CODE[key];
    }
    this.key[key] = flag;
    
    return this;
  }

  /**
   * キーを全て離したことにする
   * @returns {this}
   */
  clearKey() {
    this.key = {};
    
    return this;
  }

}


/**
 * @static
 * @enum {number}
 * 方向のアングル jsduckでは数字をプロパティに指定できない？
 */
Keyboard.ARROW_BIT_TO_ANGLE_TABLE = {
  /* @property 下 */
  0x01: 270,
  /* @property 右 */
  0x02:   0,
  /* @property 上 */
  0x04:  90,
  /* @property 左 */
  0x08: 180,

  /* @property 右上 */
  0x06:  45,
  /* @property 右下 */
  0x03: 315,
  /* @property 左上 */
  0x0c: 135,
  /* @property 左下 */
  0x09: 225,

  // 三方向同時押し対応
  // 想定外の操作だが対応しといたほうが無難
  /* @property 右上左 */
  0x0e:  90,
  /* @property 上左下 */
  0x0d: 180,
  /* @property 左下右 */
  0x0b: 270,
  /* @property 下右上 */
  0x07:   0,
};

/**
 * @static
 * @enum {number}
 * キー番号
 */
Keyboard.KEY_CODE = {
  /* @property */
  "backspace" : 8,
  /* @property */
  "tab"       : 9,
  /* @property */
  "enter"     : 13,
  /* @property */
  "return"    : 13,
  /* @property */
  "shift"     : 16,
  /* @property */
  "ctrl"      : 17,
  /* @property */
  "alt"       : 18,
  /* @property */
  "pause"     : 19,
  /* @property */
  "capslock"  : 20,
  /* @property */
  "escape"    : 27,
  /* @property */
  "pageup"    : 33,
  /* @property */
  "pagedown"  : 34,
  /* @property */
  "end"       : 35,
  /* @property */
  "home"      : 36,
  /* @property */
  "left"      : 37,
  /* @property */
  "up"        : 38,
  /* @property */
  "right"     : 39,
  /* @property */
  "down"      : 40,
  /* @property */
  "insert"    : 45,
  /* @property */
  "delete"    : 46,
  
  /* @property */
  "0" : 48,
  /* @property */
  "1" : 49,
  /* @property */
  "2" : 50,
  /* @property */
  "3" : 51,
  /* @property */
  "4" : 52,
  /* @property */
  "5" : 53,
  /* @property */
  "6" : 54,
  /* @property */
  "7" : 55,
  /* @property */
  "8" : 56,
  /* @property */
  "9" : 57,
  /* @property */
  
  "a" : 65,
  /* @property */
  "A" : 65,
  /* @property */
  "b" : 66,
  /* @property */
  "B" : 66,
  /* @property */
  "c" : 67,
  /* @property */
  "C" : 67,
  /* @property */
  "d" : 68,
  /* @property */
  "D" : 68,
  /* @property */
  "e" : 69,
  /* @property */
  "E" : 69,
  /* @property */
  "f" : 70,
  /* @property */
  "F" : 70,
  /* @property */
  "g" : 71,
  /* @property */
  "G" : 71,
  /* @property */
  "h" : 72,
  /* @property */
  "H" : 72,
  /* @property */
  "i" : 73,
  /* @property */
  "I" : 73,
  /* @property */
  "j" : 74,
  /* @property */
  "J" : 74,
  /* @property */
  "k" : 75,
  /* @property */
  "K" : 75,
  /* @property */
  "l" : 76,
  /* @property */
  "L" : 76,
  /* @property */
  "m" : 77,
  /* @property */
  "M" : 77,
  /* @property */
  "n" : 78,
  /* @property */
  "N" : 78,
  /* @property */
  "o" : 79,
  /* @property */
  "O" : 79,
  /* @property */
  "p" : 80,
  /* @property */
  "P" : 80,
  /* @property */
  "q" : 81,
  /* @property */
  "Q" : 81,
  /* @property */
  "r" : 82,
  /* @property */
  "R" : 82,
  /* @property */
  "s" : 83,
  /* @property */
  "S" : 83,
  /* @property */
  "t" : 84,
  /* @property */
  "T" : 84,
  /* @property */
  "u" : 85,
  /* @property */
  "U" : 85,
  /* @property */
  "v" : 86,
  /* @property */
  "V" : 86,
  /* @property */
  "w" : 87,
  /* @property */
  "W" : 87,
  /* @property */
  "x" : 88,
  /* @property */
  "X" : 88,
  /* @property */
  "y" : 89,
  /* @property */
  "Y" : 89,
  /* @property */
  "z" : 90,
  /* @property */
  "Z" : 90,
  
  /* @property */
  "numpad0" : 96,
  /* @property */
  "numpad1" : 97,
  /* @property */
  "numpad2" : 98,
  /* @property */
  "numpad3" : 99,
  /* @property */
  "numpad4" : 100,
  /* @property */
  "numpad5" : 101,
  /* @property */
  "numpad6" : 102,
  /* @property */
  "numpad7" : 103,
  /* @property */
  "numpad8" : 104,
  /* @property */
  "numpad9" : 105,
  /* @property */
  "multiply"      : 106,
  /* @property */
  "add"           : 107,
  /* @property */
  "subtract"      : 109,
  /* @property */
  "decimalpoint"  : 110,
  /* @property */
  "divide"        : 111,

  /* @property */
  "f1"    : 112,
  /* @property */
  "f2"    : 113,
  /* @property */
  "f3"    : 114,
  /* @property */
  "f4"    : 115,
  /* @property */
  "f5"    : 116,
  /* @property */
  "f6"    : 117,
  /* @property */
  "f7"    : 118,
  /* @property */
  "f8"    : 119,
  /* @property */
  "f9"    : 120,
  /* @property */
  "f10"   : 121,
  /* @property */
  "f11"   : 122,
  /* @property */
  "f12"   : 123,
  
  /* @property */
  "numlock"   : 144,
  /* @property */
  "scrolllock": 145,
  /* @property */
  "semicolon" : 186,
  /* @property */
  "equalsign" : 187,
  /* @property */
  "comma"     : 188,
  /* @property */
  "dash"      : 189,
  /* @property */
  "period"    : 190,
  /* @property */
  "forward slash" : 191,
  /* @property */
  "/": 191,
  /* @property */
  "grave accent"  : 192,
  /* @property */
  "open bracket"  : 219,
  /* @property */
  "back slash"    : 220,
  /* @property */
  "close bracket"  : 221,
  /* @property */
  "single quote"  : 222,
  /* @property */
  "space"         : 32

};

/**
 * @class phina.input.Mouse
 * _extends phina.input.Input
 */
class Mouse extends Input {

  /**
   * @constructor
   * @param {HTMLCanvasElement} domElement
   */
  constructor(domElement) {
    super(domElement);

    this.id = 0;

    /** @type {HTMLCanvasElement} */
    this.domElement;

    var self = this;
    this.domElement.addEventListener('mousedown', function(e) {
      self._start(pointX.get.call(e), pointY.get.call(e), 1<<e.button);
      // self._start(e.pointX, e.pointY, 1<<e.button);
    });

    this.domElement.addEventListener('mouseup', function(e) {
      self._end(1<<e.button);
    });
    this.domElement.addEventListener('mousemove', function(e) {
      self._move(pointX.get.call(e), pointY.get.call(e));
      // self._move(e.pointX, e.pointY);
    });

    // マウスがキャンバス要素の外に出た場合の対応
    this.domElement.addEventListener('mouseout', function(e)  {
      self._end(1);
    });
  }

  /**
   * ボタン取得
   * @param {string | number} button
   * @returns {boolean}
   */
  getButton(button) {
    if (typeof(button) == "string") {
      button = BUTTON_MAP[button];
    }
    
    return (this.now & button) != 0;
  }

  /**
   * ボタンダウン取得
   * @param {string | number} button
   * @returns {boolean}
   */
  getButtonDown(button) {
    if (typeof(button) === 'string') {
      button = BUTTON_MAP[button];
    }

    return (this.start & button) != 0;
  }
      
  /**
   * ボタンアップ取得
   * @param {string | number} button
   * @returns {boolean}
   */
  getButtonUp(button) {
    if (typeof(button) == "string") {
      button = BUTTON_MAP[button];
    }
    
    return (this.end & button) != 0;
  }

}

/** @static @property */
Mouse.BUTTON_LEFT = 0x1;
/** @static @property */
Mouse.BUTTON_MIDDLE = 0x2;
/** @static @property */
Mouse.BUTTON_RIGHT = 0x4;

/**
 * @type {{[k: string]: number}}
 */
var BUTTON_MAP = {
  "left"  : Mouse.BUTTON_LEFT,
  "middle": Mouse.BUTTON_MIDDLE,
  "right" : Mouse.BUTTON_RIGHT
};

Mouse.prototype.getPointing = function() { return this.getButton("left"); };
Mouse.prototype.getPointingStart = function() { return this.getButtonDown("left"); };
Mouse.prototype.getPointingEnd = function() { return this.getButtonUp("left"); };

/**
 * @class phina.input.Touch
 * _extends phina.input.Input
 */
class Touch$1 extends Input {

  /**
   * @constructor
   * @param {HTMLCanvasElement} domElement
   * @param {boolean} [isMulti]
   */
  constructor(domElement, isMulti) {
    super(domElement);

    this.id = null;

    /** @type {boolean} */
    this.released = undefined;

    if (isMulti === true) {
      return ;
    }

    var self = this;
    this.domElement.addEventListener('touchstart', function(e) {
      self._start(touchPointX.get.call(e), touchPointY.get.call(e));
      // self._start(e.pointX, e.pointY, true);
    });

    this.domElement.addEventListener('touchend', function(e) {
      self._end();
    });
    this.domElement.addEventListener('touchmove', function(e) {
      self._move(touchPointX.get.call(e), touchPointY.get.call(e));
      // self._move(e.pointX, e.pointY);
    });
  }

  /**
   * タッチしているかを判定
   * @returns {boolean}
   */
  getTouch() {
    return this.now != 0;
  }
  
  /**
   * タッチ開始時に true
   * @returns {boolean}
   */
  getTouchStart() {
    return this.start != 0;
  }
  
  /**
   * タッチ終了時に true
   * @returns {boolean}
   */
  getTouchEnd() {
    return this.end != 0;
  }

}

/**
 * @method
 * ポインティング状態取得(mouse との差異対策)
 */
Touch$1.prototype.getPointing        = Touch$1.prototype.getTouch;
/**
 * @method
 * ポインティングを開始したかを取得(mouse との差異対策)
 */
Touch$1.prototype.getPointingStart   = Touch$1.prototype.getTouchStart;
/**
 * @method
 * ポインティングを終了したかを取得(mouse との差異対策)
 */
Touch$1.prototype.getPointingEnd     = Touch$1.prototype.getTouchEnd;


/**
 * @class phina.input.TouchList
 */
class TouchList {

  /**
   * @param {HTMLCanvasElement} domElement
   */
  constructor(domElement) {
    this.domElement = domElement;

    /** @type {Touch[]} */
    this.touches = [];

    /** @type {{[id:number]: Touch}} */
    var touchMap = this.touchMap = {};

    // 32bit 周期でIDをループさせる
    this._id = new Uint32Array(1);

    var self = this;
    var each = Array.prototype.forEach;
    this.domElement.addEventListener('touchstart', function(e) {
      each.call(e.changedTouches, function(t) {
        var touch = self.getEmpty();
        touchMap[t.identifier] = touch;
        touch._start(pointX.get.call(t), pointY.get.call(t));
        // touch._start(t.pointX, t.pointY);
      });
    });

    this.domElement.addEventListener('touchend', function(e) {
      each.call(e.changedTouches, function(t) {
        var id = t.identifier;
        var touch = touchMap[id];
        touch._end();
        delete touchMap[id];
      });
    });
    this.domElement.addEventListener('touchmove', function(e) {
      each.call(e.changedTouches, function(t) {
        var touch = touchMap[t.identifier];
        touch._move(pointX.get.call(t), pointY.get.call(t));
        // touch._move(t.pointX, t.pointY);
      });
      stop.call(e);
    });

    // iPhone では 6本指以上タッチすると強制的にすべてのタッチが解除される
    this.domElement.addEventListener('touchcancel', function(e) {
      console.warn('この端末での同時タッチ数の制限を超えました。');
      each.call(e.changedTouches, function(t) {
        var id = t.identifier;
        var touch = touchMap[id];
        touch._end();
        delete touchMap[id];
      });
      stop.call(e);
    });
  }

  /**
   * 空のTouchクラスを生成して追加、返す
   * @returns {Touch}
   */
  getEmpty() {
    var touch = new Touch$1(this.domElement, true);
  
    touch.id = this.id;
    this.touches.push(touch);

    return touch;
  }

  /**
   * @param {string | number} id
   * @returns {Touch}
   */
  getTouch(id) {
    return this.touchMap[id];
  }

  /**
   * @param {Touch} touch
   * @returns {void}
   */
  removeTouch(touch) {
    var i = this.touches.indexOf(touch);
    this.touches.splice(i, 1);
  }

  /**
   * @returns {void}
   */
  update() {
    this.touches.forEach(function(touch) {
      if (!touch.released) {
        touch.update();

        if (touch.flags === 0) {
          touch.released = true;
        }
      }
      else {
        touch.released = false;
        this.removeTouch(touch);
      }

    }, this);
  }

  get id() { return this._id[0]++; }

}

/**
 * Gamepad API指定インターフェイス：https://developer.mozilla.org/en-US/docs/Web/API/Gamepad
 * 混同回避のためのエイリアス
 * @typedef {Gamepad} RawGamepad
 */

/**
 * @class phina.input.GamepadManager
 * _extends phina.util.EventDispatcher
 * 
 * ゲームパッドマネージャー.
 * ゲームパッド接続状況の監視、個々のゲームパッドの入力状態の更新を行う.
 */
class GamepadManager extends EventDispatcher {

  /**
   * @constructor
   */
  constructor() {
    super();

    /**
     * 作成済みphina.input.Gamepadオブジェクトのリスト
     *
     * @type {Object.<number, PhinaGamepad>}
     */
    this.gamepads = {};

    /**
     * 作成済みゲームパッドのindexのリスト
     * 
     * @protected
     * @type {number[]}
     */
    this._created = [];

    /**
     * ラップ前Gamepadのリスト
     * 
     * @protected
     * @type {RawGamepad[]}
     */
    this._rawgamepads = [];

    /**
     * RawGamepadのtimestampとの比較用
     * 
     * @protected
     * @type {Object.<number, number>}
     */
    this._prevTimestamps = {};

    /**
     * Gamepad取得関数
     * 
     * @protected
     * @type {typeof Navigator.prototype.getGamepads | (()=> void)}
     */
    this._getGamepads;

    /** @type {globalThis} */
    var global = phina.global;
    var navigator = global.navigator;
    if (navigator && navigator.getGamepads) {
      this._getGamepads = navigator.getGamepads.bind(navigator);
    } else if (navigator && /** @type {any} */(navigator)['webkitGetGamepads']) {
      this._getGamepads = /** @type {any} */(navigator)['webkitGetGamepads'].bind(navigator);
    } else {
      this._getGamepads = function() {};
    }

    global.addEventListener('gamepadconnected', 
    /** @this GamepadManager */
    function(e) {
      var gamepad = this.get(e.gamepad.index);
      gamepad.connected = true;
      this.flare('connected', {
        gamepad: gamepad,
      });
    }.bind(this));

    global.addEventListener('gamepaddisconnected',
    /** @this GamepadManager */
    function(e) {
      var gamepad = this.get(e.gamepad.index);
      gamepad.connected = false;
      this.flare('disconnected', {
        gamepad: gamepad,
      });
    }.bind(this));
  }

  /**
   * 更新処理
   * 要毎フレーム実行
   * 
   * @returns {void}
   */
  update() {
    this._poll();

    for (var i = 0, end = this._created.length; i < end; i++) {
      var index = this._created[i];
      var rawgamepad = this._rawgamepads[index];

      if (!rawgamepad) {
        continue;
      }

      if (rawgamepad.timestamp && (rawgamepad.timestamp === this._prevTimestamps[i])) {
        this.gamepads[index]._updateStateEmpty();
        continue;
      }

      this._prevTimestamps[i] = rawgamepad.timestamp;
      this.gamepads[index]._updateState(rawgamepad);
    }
  }

  /**
   * 指定されたindexのGamepadオブジェクトを返す.
   * 未作成の場合は作成して返す.
   * 
   * @param {number} [index=0]
   * @returns {PhinaGamepad}
   */
  get(index) {
    index = index || 0;

    if (!this.gamepads[index]) {
      this._created.push(index);
      this.gamepads[index] = new PhinaGamepad(index);
    }

    return this.gamepads[index];
  }

  /**
   * 指定されたindexのGamepadオブジェクトを破棄する.
   * 破棄されたGamepadオブジェクトは以降更新されない.
   * 
   * @param {number} index
   * @returns {void}
   */
  dispose(index) {
    if (contains.call(this._created, index)) {
    // if (this._created.contains(index)) {
      var gamepad = this.get(index);
      delete this.gamepads[index];
      erase.call(this._created, index);
      // this._created.erase(index);

      gamepad.connected = false;
    }
  }

  /**
   * 指定されたindexのゲームパッドが接続中かどうかを返す.
   * Gamepadオブジェクトが未作成の場合でも動作する.
   * 
   * @param {number} [index=0]
   * @returns {boolean}
   */
  isConnected(index) {
    index = index || 0;

    return this._rawgamepads[index] && this._rawgamepads[index].connected;
  }

  /**
   * @protected
   * @returns {void}
   */
  _poll() {
    var rawGamepads = this._getGamepads();
    if (rawGamepads) {
      clear.call(this._rawgamepads);
      // this._rawgamepads.clear();

      for (var i = 0, end = rawGamepads.length; i < end; i++) {
        if (rawGamepads[i]) {
          this._rawgamepads.push(
            /** @type {RawGamepad} */ (rawGamepads[i])
          );
        }
      }
    }
  }

  // _static: {
  //   /** ブラウザがGamepad APIに対応しているか. */
  //   isAvailable: (function() {
  //     var nav = phina.global.navigator;
  //     if (!nav) return false;

  //     return (!!nav.getGamepads) || (!!nav.webkitGetGamepads);
  //   })(),
  // }

}

// static props
/** ブラウザがGamepad APIに対応しているか. */
GamepadManager.isAvailable = (function() {
  var nav = phina.global.navigator;
  if (!nav) return false;

  return (!!nav.getGamepads) || (!!nav['webkitGetGamepads']);
})();


/**
 * @typedef {Object} PhinaGamepadButtonState gamepadボタンパラメータ
 * @property {number} value ボタンの状態を表すdouble型の数値 参考：https://developer.mozilla.org/en-US/docs/Web/API/GamepadButton/value
 * @property {*} pressed 0 | 1 (false | true)
 * @property {*} last 0 | 1 (false | true)
 * @property {*} down 0 | 1 (false | true)
 * @property {*} up 0 | 1 (false | true)
 */

/**
 * @class phina.input.Gamepad
 * ゲームパッド
 *
 * 直接インスタンス化せず、phina.input.GamepadManagerオブジェクトから取得して使用する.
 * 
 * ※"Gamepad"という名前のインターフェイスがすでに存在するため、
 * （https://developer.mozilla.org/en-US/docs/Web/API/Gamepad）
 * 混同回避のためクラス名を変更
 */
class PhinaGamepad {

  /**
   * @param {number} [index=0]
   */
  constructor(index) {
    this.index = index || 0;

    /** @type {PhinaGamepadButtonState[]} */
    // this.buttons = Array.range(0, 16).map(function() {
    this.buttons = range.call([], 0, 16).map(function() {
      return {
        value: 0,
        pressed: false,
        last: false,
        down: false,
        up: false,
      };
    });

    /**
     * アナログスティック傾き管理用
     * 
     * @type {Vector2[]}
     */
    this.sticks = range.call([], 0, 2).map(function() {
    // this.sticks = Array.range(0, 2).map(function() {
      return new Vector2(0, 0);
    });
    this.id = null;
    this.connected = false;
    this.mapping = null;
    this.timestamp = null;
  }

  /**
   * ボタンが押されているか.
   * 
   * @param {number|keyof typeof PhinaGamepad.BUTTON_CODE} button ボタンコード数値、あるいはラベル文字列
   * @returns {boolean}
   */
  getKey(button) {
    if (typeof(button) === 'string') {
      button = PhinaGamepad.BUTTON_CODE[button];
    }
    if (this.buttons[button]) {
      return this.buttons[button].pressed;
    } else {
      return false;
    }
  }

  /**
   * ボタンを押した.
   * 
   * @param {number|keyof typeof PhinaGamepad.BUTTON_CODE} button ボタンコード数値、あるいはラベル文字列
   * @returns {boolean}
   */
  getKeyDown(button) {
    if (typeof(button) === 'string') {
      button = PhinaGamepad.BUTTON_CODE[button];
    }
    if (this.buttons[button]) {
      return this.buttons[button].down;
    } else {
      return false;
    }
  }

  /**
   * ボタンを離した.
   * 
   * @param {number|keyof typeof PhinaGamepad.BUTTON_CODE} button ボタンコード数値、あるいはラベル文字列
   * @returns {boolean}
   */
  getKeyUp(button) {
    if (typeof(button) === 'string') {
      button = PhinaGamepad.BUTTON_CODE[button];
    }
    if (this.buttons[button]) {
      return this.buttons[button].up;
    } else {
      return false;
    }
  }

  /**
   * 十字キーの入力されている方向を度数単位で返す。
   * 
   * @returns {number | null} どの方向にも当てはまらない時はnull
   */
  getKeyAngle() {
    var angle = null;
    var arrowBit =
      (this.getKey('left') ? 1 : 0 << 3) | // 1000
      (this.getKey('up') ? 1 : 0 << 2) | // 0100
      (this.getKey('right') ? 1 : 0 << 1) | // 0010
      (this.getKey('down') ? 1 : 0); // 0001

    if (arrowBit !== 0 && ARROW_BIT_TO_ANGLE_TABLE.hasOwnProperty(arrowBit)) {
      angle = ARROW_BIT_TO_ANGLE_TABLE[
        /** @type {keyof typeof ARROW_BIT_TO_ANGLE_TABLE} */ (arrowBit)
      ];
    }

    return angle;
  }

  /**
   * 十字キーの入力されている方向をVector2で
   * 正規化されている.
   * 
   * @returns {Vector2}
   */
  getKeyDirection() {
    var direction = new Vector2(0, 0);

    if (this.getKey('left')) {
      direction.x = -1;
    } else if (this.getKey('right')) {
      direction.x = 1;
    }
    if (this.getKey('up')) {
      direction.y = -1;
    } else if (this.getKey('down')) {
      direction.y = 1;
    }

    if (direction.x && direction.y) {
      direction.div(Math.SQRT2);
    }

    return direction;
  }

  /**
   * スティックの入力されている方向.
   * 
   * @param {number} [stickId=0]
   * @returns {number | null} 対応するスティックがない場合はnull
   */
  getStickAngle(stickId) {
    stickId = stickId || 0;
    var stick = this.sticks[stickId];
    return stick ? Math.atan2(-stick.y, stick.x) : null;
  }

  /**
   * スティックの入力されている方向をVector2で取得
   * 
   * Vector2は参照ではなく、複製されて返却される
   * 
   * @param {number} [stickId=0] 省略すると0（通常左アナログスティックに対応するid）となる
   * @returns {Vector2} 対応するスティックが存在しない場合は初期化したVector2を返却
   */
  getStickDirection(stickId) {
    stickId = stickId || 0;
    return this.sticks ? this.sticks[stickId].clone() : new Vector2(0, 0);
  }

  /**
   * @public GamepadManagerからアクセス
   * @param {RawGamepad} gamepad
   */
  _updateState(gamepad) {
    this.id = gamepad.id;
    this.connected = gamepad.connected;
    this.mapping = gamepad.mapping;
    this.timestamp = gamepad.timestamp;

    for (var i = 0, iend = gamepad.buttons.length; i < iend; i++) {
      this._updateButton(gamepad.buttons[i], i);
    }

    for (var j = 0, jend = gamepad.axes.length; j < jend; j += 2) {
      this._updateStick(gamepad.axes[j + 0], j / 2, 'x');
      this._updateStick(gamepad.axes[j + 1], j / 2, 'y');
    }
  }

  /**
   * ボタンの入力状態をリセット
   * 
   * @public GamepadManagerからアクセス
   */
  _updateStateEmpty() {
    for (var i = 0, iend = this.buttons.length; i < iend; i++) {
      this.buttons[i].down = false;
      this.buttons[i].up = false;
    }
  }

   /**
    * @protected
    * @param {number | GamepadButton} value
    * @param {number} buttonId
    */
   _updateButton(value, buttonId) {
    if (this.buttons[buttonId] === undefined) {
      this.buttons[buttonId] = {
        value: 0,
        pressed: false,
        last: false,
        down: false,
        up: false,
      };
    }
    
    var button = this.buttons[buttonId];

    button.last = button.pressed;

    if (typeof value === 'object') {
      button.value = value.value;
      button.pressed = value.pressed;
    } else {
      button.value = value;
      button.pressed = value > PhinaGamepad.ANALOGUE_BUTTON_THRESHOLD;
    }

    button.down = (button.pressed ^ button.last) & button.pressed;
    button.up = (button.pressed ^ button.last) & button.last;
  }

  /**
   * @protected
   * @param {number} value
   * @param {number} stickId
   * @param {"x"|"y"} axisName
   */
  _updateStick(value, stickId, axisName) {
    if (this.sticks[stickId] === undefined) {
      this.sticks[stickId] = new Vector2(0, 0);
    }
    this.sticks[stickId][axisName] = value;
  }

}

/** ブラウザがGamepad APIに対応しているか. */
PhinaGamepad.isAvailable = (function() {
  var nav = phina.global.navigator;
  if (!nav) return false;

  return (!!nav.getGamepads) || (!!nav['webkitGetGamepads']);
})();

/** アナログ入力対応のボタンの場合、どの程度まで押し込むとonになるかを表すしきい値. */
PhinaGamepad.ANALOGUE_BUTTON_THRESHOLD = 0.5;

/** ボタン名とボタンIDのマップ. */
PhinaGamepad.BUTTON_CODE = {
  'a': 0,
  'b': 1,
  'x': 2,
  'y': 3,

  'l1': 4,
  'r1': 5,
  'l2': 6,
  'r2': 7,

  'select': 8,
  'start': 9,

  'l3': 10,
  'r3': 11,

  'up': 12,
  'down': 13,
  'left': 14,
  'right': 15,

  'special': 16,

  'A': 0,
  'B': 1,
  'X': 2,
  'Y': 3,

  'L1': 4,
  'R1': 5,
  'L2': 6,
  'R2': 7,

  'SELECT': 8,
  'START': 9,

  'L3': 10,
  'R3': 11,

  'UP': 12,
  'DOWN': 13,
  'LEFT': 14,
  'RIGHT': 15,

  'SPECIAL': 16,
};

var ARROW_BIT_TO_ANGLE_TABLE = {
  0x00: null,

  /* @property 下 */
  0x01: 270,
  /* @property 右 */
  0x02: 0,
  /* @property 上 */
  0x04: 90,
  /* @property 左 */
  0x08: 180,

  /* @property 右上 */
  0x06: 45,
  /* @property 右下 */
  0x03: 315,
  /* @property 左上 */
  0x0c: 135,
  /* @property 左下 */
  0x09: 225,

  // 三方向同時押し対応
  // 想定外の操作だが対応しといたほうが無難
  /* @property 右上左 */
  0x0e: 90,
  /* @property 上左下 */
  0x0d: 180,
  /* @property 左下右 */
  0x0b: 270,
  /* @property 下右上 */
  0x07: 0,
};

/**
 * @class phina.input.Accelerometer
 * スマートフォンのセンサー情報
 */
class Accelerometer {
  /**
   * @constructor
   */
  constructor() {
    var self = this;

    /** @property  gravity 重力センサー */
    this.gravity        = new Vector3(0, 0, 0);

    /** @property  acceleration 加速度センサー */
    this.acceleration   = new Vector3(0, 0, 0);

    /** @property  rotation 回転加速度センサー */
    this.rotation       = new Vector3(0, 0, 0);

    /** @property  orientation スマートフォンの傾き */
    this.orientation    = new Vector3(0, 0, 0);

    if (phina.isMobile()) {
      phina.global.addEventListener("devicemotion", function(e) {
        var acceleration = self.acceleration;
        var gravity = self.gravity;
        var rotation = self.rotation;
        
        if (e.acceleration) {
          acceleration.x = e.acceleration.x;
          acceleration.y = e.acceleration.y;
          acceleration.z = e.acceleration.z;
        }
        if (e.accelerationIncludingGravity) {
          gravity.x = e.accelerationIncludingGravity.x;
          gravity.y = e.accelerationIncludingGravity.y;
          gravity.z = e.accelerationIncludingGravity.z;
        }
        if (e.rotationRate) {
          rotation.x = rotation.beta  = e.rotationRate.beta;
          rotation.y = rotation.gamma = e.rotationRate.gamma;
          rotation.z = rotation.alpha = e.rotationRate.alpha;
        }
      });
      
      phina.global.addEventListener("deviceorientation", function(e) {
        var orientation = self.orientation;
        orientation.alpha   = e.alpha;  // z(0~360)
        orientation.beta    = e.beta;   // x(-180~180)
        orientation.gamma   = e.gamma;  // y(-90~90)
      });
    }
  }

}

/**
 * @class phina.app.Updater
 */
class Updater {

  /**
   * @param {import('../game/gameapp').AppUnion} app
   */
  constructor(app) {
    this.app = app;
  }

  /**
   * @param {import('../app/scene').Scene} root 
   */
  update(root) {
    this._updateElement(root);
  }

  /**
   * @private
   * @param {import('../app/element').Element} element
   */
  _updateElement(element) {
    var app = this.app;

    // 更新するかを判定
    if (element.awake === false) return ;

    // エンターフレームイベント
    if (element.has('enterframe')) {
      element.flare('enterframe', {
        app: this.app,
      });
    }

    // 更新
    if (element.update) element.update(app);

    // 子供を更新
    var len = element.children.length;
    if (element.children.length > 0) {
      var tempChildren = element.children.slice();
      for (var i=0; i<len; ++i) {
        this._updateElement(tempChildren[i]);
      }
    }
  }

}

/**
 * Interactiveクラスのappとして必要なプロパティ
 * @typedef {{
 *   on: typeof import('../util/eventdispatcher').EventDispatcher.prototype.on
 *   domElement?: HTMLCanvasElement
 *   pointer?: import('../display/domapp').Pointer
 *   pointers?: import('../display/domapp').Pointer[]
 * }} InteractableApp
 */

/**
 * @class phina.app.Interactive
 */
class Interactive {

  /**
   * @param {InteractableApp} app 
   */
  constructor(app) {
    this.app = app;
    this._enable = true;
    this.multiTouch = true;
    this.cursor = {
      normal: '',
      hover: 'pointer',
    };

    /** @type {import('./object2d').Object2D[]} */
    this._holds = [];
    this.app.on('changescene', function() {
      clear.call(this._holds);
      // this._holds.clear();
    }.bind(this));
  }

  /**
   * @returns {this}
   */
  enable() {
    this._enable = true;
    return this;
  }

  /**
   * @returns {this}
   */
  disable() {
    this._enable = false;
    return this;
  }

  /**
   * 指定要素のインタラクションチェック開始  
   * @param {import('./element').Element | import('./object2d').Object2D} root Sceneクラスに渡されるため
   */
  check(root) {
    // カーソルのスタイルを反映
    if (this.app.domElement) {
      if (this._holds.length > 0) {
        this.app.domElement.style.cursor = this.cursor.hover;
      }
      else {
        this.app.domElement.style.cursor = this.cursor.normal;
      }
    }

    if (!this._enable || !this.app.pointers) return ;
    this._checkElement(root);
  }

  /**
   * 指定要素のインタラクションチェック  
   * 子供がいれば再帰処理
   * @private
   * @param {import('./element').Element | import('./object2d').Object2D} element 
   */
  _checkElement(element) {
    var app = this.app;

    // 更新するかを判定
    if (element.awake === false) return ;

    // 子供を更新
    var len = element.children.length;
    if (element.children.length > 0) {
      var tempChildren = element.children.slice();
      for (var i=0; i<len; ++i) {
        this._checkElement(tempChildren[i]);
      }
    }

    // タッチ判定
    this._checkPoint(element);
  }

  /**
   * タッチ判定を行う
   * @private
   * @param {import('./element').Element | import('./object2d').Object2D} obj 
   */
  _checkPoint(obj) {
    var _obj = /** @type {import('./object2d').Object2D} */(obj);
    if (this.multiTouch) {
      this.app.pointers.forEach(function(p) {
        if (p.id !== null) {
          this.__checkPoint(_obj, p);
        }
      }, this);
    }
    else {
      this.__checkPoint(_obj, this.app.pointer);
    }
  }

  /**
   * @private
   * @param {import('./object2d').Object2D} obj
   * @param {import('../display/domapp').Pointer} p
   */
  __checkPoint(obj, p) {
    if (!obj.interactive) return ;

    var prevOverFlag = obj._overFlags[p.id];
    var overFlag = obj.hitTest(p.x, p.y);
    obj._overFlags[p.id] = overFlag;

    var e = {
      pointer: p,
      interactive: this,
      over: overFlag,
    };

    if (!prevOverFlag && overFlag) {
      obj.flare('pointover', e);

      if (obj.boundingType && obj.boundingType !== 'none') {
        this._holds.push(obj);
      }
    }
    if (prevOverFlag && !overFlag) {
      obj.flare('pointout', e);
      // this._holds.erase(obj);
      erase.call(this._holds, obj);
    }

    if (overFlag) {
      if (p.getPointingStart()) {
        obj._touchFlags[p.id] = true;
        obj.flare('pointstart', e);
        // クリックフラグを立てる
        obj._clicked = true;
      }
    }

    if (obj._touchFlags[p.id]) {
      obj.flare('pointstay', e);
      if (p._moveFlag) {
        obj.flare('pointmove', e);
      }
    }

    if (obj._touchFlags[p.id]===true && p.getPointingEnd()) {
      obj._touchFlags[p.id] = false;
      obj.flare('pointend', e);

      if (phina.isMobile() && obj._overFlags[p.id]) {
        obj._overFlags[p.id] = false;
        obj.flare('pointout', e);
        // this._holds.erase(obj);
        erase.call(this._holds, obj);
      }
    }
  }

}

/**
 * Accessoryのtargetプロパティとして最低限かどうか
 * @typedef {{
 *   detach: (accessor: Accessory)=> any
 *   [k: string]: any
 * }} AccessoryTarget
 */

/**
 * Accessoryアタッチ可能オブジェクト
 * @typedef {{
 *   attach: (accessor: Accessory)=> any
 * } & AccessoryTarget } AccessoryAttachable
 */

/**
 * @class phina.accessory.Accessory
 * _extends phina.util.EventDispatcher
 */
class Accessory extends EventDispatcher {

  /**
   * @constructor
   * @param {AccessoryTarget} [target]
   */
  constructor(target) {
    super();

    /**
     * 操作対象
     * @type {AccessoryTarget | undefined}
     */
    this.target = target;
  }

  /**
   * 更新関数
   * アタッチしたtargetのenterframeイベントを経由して
   * 毎フレーム実行される
   * 
   * 主にサブクラスで拡張してAccessoryとしての特徴づけを行う
   * 
   * @virtual
   * @protected
   * @param {*} _app Appクラスインスタンス
   */
  update(_app) {}

  /**
   * 操作対象を設定
   * 
   * @param {AccessoryTarget} target
   * @returns {this}
   */
  setTarget(target) {
    if (this.target === target) return this;

    this.target = target;
    return this;
  }

  /**
   * アタッチ対象を返す
   * 
   * @returns {AccessoryTarget | undefined}
   */
  getTarget() {
    return this.target;
  }

  /**
   * アタッチ対象が存在するかどうか
   * 
   * @returns {boolean}
   */
  isAttached() {
    return !!this.target;
  }

  /**
   * 対象に自身をアタッチさせる
   * 
   * @template {AccessoryAttachable} T
   * @param {T} element
   * @returns {this}
   */
  attachTo(element) {
    element.attach(this);
    this.setTarget(element);
    return this;
  }

  /**
   * targetに自身へのアタッチを外させ、target参照を切る
   * 
   * @returns {void}
   */
  remove() {
    if (!this.target) return;
    this.target.detach(this);
    this.target = undefined;
  }

}

// Element側で拡張
// phina.app.Element.prototype.$method('attach', function(accessory) {
//   if (!this.accessories) {
//     this.accessories = [];
//     this.on('enterframe', function(e) {
//       this.accessories.each(function(accessory) {
//         accessory.update && accessory.update(e.app);
//       });
//     });
//   }

//   this.accessories.push(accessory);
//   accessory.setTarget(this);
//   accessory.flare('attached');

//   return this;
// });

// phina.app.Element.prototype.$method('detach', function(accessory) {
//   if (this.accessories) {
//     this.accessories.erase(accessory);
//     accessory.setTarget(null);
//     accessory.flare('detached');
//   }

//   return this;
// });

/**
 * @typedef {"normal" | "delta" | "fps"} TweenerUpdateType tweener更新タイプ
 * 
 * @typedef {"to" | "by" | "from"} TweenerTaskMode tweenerタスクモード
 * 
 * @typedef {{
 *   type: "tween",
 *   mode: TweenerTaskMode,
 *   props: Object,
 *   duration?: number,
 *   easing?: import("../util/tween").TweenEasingType,
 * }} TweenTypeTaskParam Tweenクラスを使用するタスクの設定用パラメータ
 * 
 * @typedef {{
 *   type: "wait" | "call" | "set",
 *   data: {[key: string]: any}
 * }} CommonTypeTaskParam その他の汎用タスク用パラメータ
 * 
 * @typedef {TweenTypeTaskParam | CommonTypeTaskParam} TaskParamUnion
 */

/**
 * @class phina.accessory.Tweener
 * # Tweener
 * Tweenerはオブジェクトのプロパティに対して、
 * Tweenアニメーションの効果を与えるクラスです。  
 * 主に {@link phina.app.Element} とそのサブクラスで使用されます。
 * _extends phina.accessory.Accessory
 */
class Tweener extends Accessory {

  /**
   * @constructor
   * @param {import("./accessory").AccessoryTarget} [target]
   */
  constructor(target) {
    super(target);

    /**
     * アニメーションを更新する方法を指定します。  
     * 変更するとdurationによる時間の進み方が変わります。  
     * 詳しくは{@link #UPDATE_MAP}を参照してください。
     * @type {TweenerUpdateType}
     */
    this.updateType = 'delta';

    this._init();
  }

  /**
   * @private
   * 初期化
   */
  _init() {
    this._loop = false;

    /** @type {TaskParamUnion[]} */
    this._tasks = [];

    this._index = 0;
    this.playing = true;
    this._update = this._updateTask;
  }

  /**
   * @param {import('../app/baseapp').BaseApp} app
   */
  update(app) {
    this._update(app);
  }

  /**
   * {@link #updateType}を変更します。
   * @chainable
   * @param {TweenerUpdateType} type 更新方法を表す文字列
   * @returns {this}
   */
  setUpdateType(type) {
    this.updateType = type;
    return this;
  }

  /**
   * propsで指定した値になるまで、durationで指定した時間をかけて、アニメーションさせます。
   * @chainable
   * @param {{[key: string]: any}} props 変更したいプロパティをkeyとしたオブジェクト
   * @param {Number} [duration] (optional) アニメーションにかける時間
   * @param {import("../util/tween").TweenEasingType} [easing] (optional) easing {@link phina.util.Tween#EASING}を参照してください。
   * @returns {this}
   */
  to(props, duration, easing) {
    this._add({
      type: 'tween',
      mode: 'to',
      props: props,
      duration: duration,
      easing: easing,
    });
    return this;
  }

  /**
   * アニメーション開始時の値とpropsで指定した値を加算した値になるまで、durationで指定した時間をかけて、アニメーションさせます。
   * @chainable
   * @param {{[key: string]: any}} props 変更したいプロパティをkeyとしたオブジェクト
   * @param {Number} [duration] (optional) アニメーションにかける時間
   * @param {import("../util/tween").TweenEasingType} [easing] (optional) easing {@link phina.util.Tween#EASING}を参照してください。
   * @returns {this}
   */
  by(props, duration, easing) {
    this._add({
      type: 'tween',
      mode: 'by',
      props: props,
      duration: duration,
      easing: easing,
    });

    return this;
  }

  /**
   * propsで指定した値からアニメーション開始時の値になるまで、durationで指定した時間をかけて、アニメーションさせます。
   * @chainable
   * @param {{[key: string]: any}} props 変更したいプロパティをkeyとしたオブジェクト
   * @param {Number} [duration] (optional) アニメーションにかける時間
   * @param {import("../util/tween").TweenEasingType} [easing] (optional) easing {@link phina.util.Tween#EASING}を参照してください。
   * @returns {this}
   */
  from(props, duration, easing) {
    this._add({
      type: 'tween',
      mode: 'from',
      props: props,
      duration: duration,
      easing: easing,
    });
    return this;
  }

  /**
   * 指定した時間が経過するまで待機します。
   * @chainable
   * @param {Number} time waitする時間
   * @returns {this}
   */
  wait(time) {
    this._add({
      type: 'wait',
      data: {
        limit: time,
      },
    });
    return this;
  }

  /**
   * 現在設定されているアニメーションが終了した時に呼び出される関数をセットします。
   * @chainable
   * @param {Function} func 呼び出される関数
   * @param {Object} [self] (optional) func内でthisにしたいオブジェクト。
   * @param {Object[]} [args] (optional) funcの引数にしたい値
   * @returns {this}
   */
  call(func, self, args) {
    this._add({
      type: 'call',
      data: {
        func: func,
        self: self || this,
        args: args,
      },
    });
    return this;
  }

  /**
   * 現在設定されているアニメーションが終了した時にプロパティをセットします。  
   * 第一引数にオブジェクトをセットすることもできます。
   * @chainable
   * @param {String | Object} key valueをセットするプロパティ名か、変更したいプロパティをkeyとしたオブジェクト。
   * @param {Object} [value] (optional) セットする値
   * @returns {this}
   */
  set(key, value) {
    var values = null;
    if (arguments.length == 2) {
      values = {};
      values[key] = value;
    }
    else {
      values = key;
    }
    this._tasks.push({
      type: "set",
      data: {
        values: values
      }
    });

    return this;
  }

  /**
   * x, yに対して、 {@link #to} の処理を行います。
   * @chainable
   * @param {Number} x
   * @param {Number} y
   * @param {Number} [duration] (optional) アニメーションにかける時間
   * @param {import("../util/tween").TweenEasingType} [easing] (optional) easing {@link phina.util.Tween#EASING}を参照してください。
   * @returns {this}
   */
  moveTo(x, y, duration, easing) {
    return this.to({ x: x, y: y }, duration, easing);
  }
  
  /**
   * x, yに対して、 {@link #by} の処理を行います。
   * @chainable
   * @param {Number} x
   * @param {Number} y
   * @param {Number} [duration] (optional) アニメーションにかける時間
   * @param {import("../util/tween").TweenEasingType} [easing] (optional) easing {@link phina.util.Tween#EASING}を参照してください。
   * @returns {this}
   */
  moveBy(x, y, duration, easing) {
    return this.by({ x: x, y: y }, duration, easing);
  }

  /**
   * rotationに対して、 {@link #to} の処理を行います。
   * @chainable
   * @param {Number} rotation
   * @param {Number} [duration] (optional) アニメーションにかける時間
   * @param {import("../util/tween").TweenEasingType} [easing] (optional) easing {@link phina.util.Tween#EASING}を参照してください。
   * @returns {this}
   */
  rotateTo(rotation, duration, easing) {
    return this.to({ rotation: rotation }, duration, easing);
  }
  
  /**
   * rotationに対して、 {@link #by} の処理を行います。
   * @chainable
   * @param {Number} rotation
   * @param {Number} [duration] (optional) アニメーションにかける時間
   * @param {import("../util/tween").TweenEasingType} [easing] (optional) easing {@link phina.util.Tween#EASING}を参照してください。
   * @returns {this}
   */
  rotateBy(rotation, duration, easing) {
    return this.by({ rotation: rotation }, duration, easing);
  }

  /**
   * scaleX, scaleYに対して {@link #to} の処理を行います。
   * @chainable
   * @param {Number} scale scaleXとscaleYに設定する値
   * @param {Number} [duration] (optional) アニメーションにかける時間
   * @param {import("../util/tween").TweenEasingType} [easing] (optional) easing {@link phina.util.Tween#EASING}を参照してください。
   * @returns {this}
   */
  scaleTo(scale, duration, easing) {
    return this.to({ scaleX: scale, scaleY: scale }, duration, easing);
  }
  /**
   * scaleX, scaleYに対して {@link #by} の処理を行います。
   * @chainable
   * @param {Number} scale scaleXとscaleYに設定する値
   * @param {Number} [duration] (optional) アニメーションにかける時間
   * @param {import("../util/tween").TweenEasingType} [easing] (optional) easing {@link phina.util.Tween#EASING}を参照してください。
   * @returns {this}
   */
  scaleBy(scale, duration, easing) {
    return this.by({ scaleX: scale, scaleY: scale }, duration, easing);
  }

  /**
   * alphaに対して {@link #to} の処理を行います。
   * @chainable
   * @param {Number} value alphaに設定する値
   * @param {Number} [duration] (optional) アニメーションにかける時間
   * @param {import("../util/tween").TweenEasingType} [easing] (optional) easing {@link phina.util.Tween#EASING}を参照してください。
   * @returns {this}
   */
  fade(value, duration, easing) {
    return this.to({ alpha: value }, duration, easing);
  }

  /**
   * alphaを0にするアニメーションを設定します。
   * @chainable
   * @param {Number} [duration] (optional) アニメーションにかける時間
   * @param {import("../util/tween").TweenEasingType} [easing] (optional) easing {@link phina.util.Tween#EASING}を参照してください。
   * @returns {this}
   */
  fadeOut(duration, easing) {
    return this.fade(0.0, duration, easing);
  }

  /**
   * alphaを1にするアニメーションを設定します。
   * @chainable
   * @param {Number} [duration] (optional) アニメーションにかける時間
   * @param {import("../util/tween").TweenEasingType} [easing] (optional) easing {@link phina.util.Tween#EASING}を参照してください。
   * @returns {this}
   */
  fadeIn(duration, easing) {
    return this.fade(1.0, duration, easing);
  }

  /**
   * アニメーション開始
   * @chainable
   * @returns {this}
   */
  play() {
    this.playing = true;
    return this;
  }

  /**
   * アニメーションを一時停止
   * @chainable
   * @returns {this}
   */
  pause() {
    this.playing = false;
    return this;
  }

  /**
   * アニメーションを停止し、最初まで巻き戻します。
   * @chainable
   * @returns {this}
   */
  stop() {
    this.playing = false;
    this.rewind();
    return this;
  }

  /**
   * アニメーションを巻き戻す
   * @chainable
   * @returns {this}
   */
  rewind() {
    this._update = this._updateTask;
    this._index = 0;
    return this;
  }

  yoyo() {
    // TODO: 最初の値が分からないので反転できない...
    this._update = this._updateTask;
    this._index = 0;
    each$1.call(this._tasks, function(task) {
    // this._tasks.each(function(task) {
      if (task.type === 'tween') ;
    });
    this.play();

    return this;
  }

  /**
   * アニメーションループ設定
   * @chainable
   * @param {Boolean} flag
   * @returns {this}
   */
  setLoop(flag) {
    this._loop = flag;
    return this;
  }

  /**
   * アニメーションをクリア
   * @chainable
   * @override {EventDispatcher#clear}を上書き
   * @returns {this}
   */
  clear() {
    this._init();
    return this;
  }

  /**
   * @typedef {[string, ...any]} TweenParamArray
   * JSON形式でアニメーションを設定します。
   * @chainable
   * 
   * ```
   * [
   *   [method, arg1, arg2,,,],
   *   ['to', {value: 100}, 1000, 'swing'],
   *   ['wait', 1000],
   *   ['set', 'text', 'END']
   * ]
   * ```
   * 
   * @param {Object} json
   * @param {Boolean} json.loop (optional) ループする場合true
   * @param {TweenParamArray} json.tweens 設定するアニメーション
   * @returns {this}
   */
  fromJSON(json) {
    if (json.loop !== undefined) {
      this.setLoop(json.loop);
    }

    each$1.call(json.tweens, 
    // json.tweens.each(
      /**
       * @this Tweener
       * @param {TweenParamArray} t
       */
      function(t) {
        t = clone.call(t);
        // t = t.clone();
        var method = t.shift();
        this[method].apply(this, t);
      }, this
    );

    return this;
  }

  /**
   * @param {TaskParamUnion} params
   */
  _add(params) {
    this._tasks.push(params);
  }

  /**
   * @param {import('../app/baseapp').BaseApp} app
   */
  _updateTask(app) {
    if (!this.playing) return ;

    var task = this._tasks[this._index];
    if (!task) {
      if (this._loop) {
        this.rewind();
        this._update(app);
      }
      else {
        this.playing = false;
      }
      return ;
    }
    else {
      ++this._index;
    }

    if (task.type === 'tween') {
      // this._tween = phina.util.Tween();
      this._tween = new Tween();

      var duration = task.duration || this._getDefaultDuration();
      if (task.mode === 'to') {
        this._tween.to(this.target, task.props, duration, task.easing);
      }
      else if (task.mode === 'by') {
        this._tween.by(this.target, task.props, duration, task.easing);
      }
      else {
        this._tween.from(this.target, task.props, duration, task.easing);
      }
      this._update = this._updateTween;
      this._update(app);
    }
    else if (task.type === 'wait') {
      this._wait = {
        time: 0,
        limit: task.data.limit,
      };

      this._update = this._updateWait;
      this._update(app);
    }
    else if (task.type === 'call') {
      task.data.func.apply(task.data.self, task.data.args);
      // 1フレーム消費しないよう再帰
      this._update(app);
    }
    else if (task.type === 'set') {
      $extend.call(this.target, task.data.values);
      // this.target.$extend(task.data.values);
      // 1フレーム消費しないよう再帰
      this._update(app);
    }
  }

  /**
   * @param {import('../app/baseapp').BaseApp} app
   */
  _updateTween(app) {
    var tween = this._tween;
    var time = this._getUnitTime(app);

    tween.forward(time);
    this.flare('tween');

    if (tween.time >= tween.duration) {
      delete this._tween;
      this._tween = null;
      this._update = this._updateTask;
    }
  }

  /**
   * @param {import('../app/baseapp').BaseApp} app
   */
  _updateWait(app) {
    var wait = this._wait;
    var time = this._getUnitTime(app);
    wait.time += time;

    if (wait.time >= wait.limit) {
      delete this._wait;
      this._wait = null;
      this._update = this._updateTask;
    }
  }

  /**
   * @private
   * @param {import('../app/baseapp').BaseApp} app
   */
  _getUnitTime(app) {
    var obj = UPDATE_MAP[this.updateType];
    if (obj) {
      return obj.func(app);
    }
    else {
      return 1000 / app.fps;
    }
  }

  /**
   * @private
   */
  _getDefaultDuration() {
    var obj = UPDATE_MAP[this.updateType];
    return obj && obj.duration;
  }

}

/**
 * @static
 * {@link #updateType}に設定する更新方法の定義です。
 * 下記の表に定義済みの更新方法を{@link #updateType}に設定することで、
 * アニメーションの更新方法を変更することができます。
 * 
 * | 更新方法 | 単位(デフォルト値) | 1フレームあたりのアニメーション速度 |
 * |-|-|-|
 * | normal | ミリ秒(1000) | app.fpsによって変化 |
 * | delta | ミリ秒(1000) | 経過時間によって変化 |
 * | fps | フレーム(30) | 必ず同じ速度で変化 |
 * 
 * @type {{
 *   [key in TweenerUpdateType]: {
 *     func: (app: import('../app/baseapp').BaseApp)=> number,
 *     duration: number,
 *   }
 * }}
 */
var UPDATE_MAP = Tweener.UPDATE_MAP = {
  normal: {
    func: function(app) {
      return 1000 / app.fps;
    },
    duration: 1000,
  },

  delta: {
    func: function(app) {
      return app.ticker.deltaTime;
    },
    duration: 1000,
  },

  fps: {
    func: function() {
      return 1;
    },
    duration: 30,
  },

};

// Element側で拡張
// /**
//  * @member phina.app.Element
//  * @property tweener
//  * 自身にアタッチ済みの{@link phina.accessory.Tweener}オブジェクト。
//  */
// phina.app.Element.prototype.getter('tweener', function() {
//   if (!this._tweener) {
//     this._tweener = phina.accessory.Tweener().attachTo(this);
//   }
//   return this._tweener;
// });

/**
 * Draggableのtargetに指定可能なオブジェクト型
 * @typedef {{
 *   x: number
 *   y: number
 *   flare: (type: string)=> any
 *   setInteractive: (flag: boolean)=> any
 * } & import("./accessory").AccessoryAttachable } DraggableTarget
 */

/**
 * @class phina.accessory.Draggable
 * _extends phina.accessory.Accessory
 * 
 * 対象をドラッグ可能にするAccessory派生クラス
 * 
 * phina.app.Element派生クラスであれば、
 * draggableゲッターにアクセスするだけで有効化することも可能
 * 
 * ### イベント発火について
 * ドラッグ開始時に`dragstart`、
 * ドラッグ移動毎に`drag`、
 * ドラッグ終了時に時に`dragend`
 * イベントをそれぞれ自身および対象オブジェクト両方で発火する
 * 
 * @example
 * const target = new phina.display.Sprite("player");
 * const draggable = new phina.accessory.Draggable().attachTo(target);
 * draggable.on("dragend", ()=> {
 *   if (!isValidatePosition(target)) draggable.back()
 * })
 * 
 * @example
 * // Activate by getter
 * const el = new phina.app.Element();
 * el.draggable;
 * 
 */
class Draggable extends Accessory {

  /**
   * @constructor
   * 
   * @param {DraggableTarget} [target]
   * targetを受け取るが、それだけでは有効化されないことに注意
   * 同時に有効化する場合はattachToを使って付与する
   */
  constructor(target) {
    super(target);

    /** @type {DraggableTarget} */
    this.target;

    /**
     * @private
     * @type {boolean}
     */
    this._dragging = false;

    /**
     * @private
     * @type {boolean}
     * ※未使用
     */
    this._enable;

    /**
     * ドラッグ開始位置、処理毎に更新される
     * @type {Vector2}
     */
    this.initialPosition = new Vector2(0, 0);

    var self = this;
    this.on('attached',
    /** @this {Draggable} */
    function() {
      this.target.setInteractive(true);

      self._dragging = false;

      this.target.on('pointstart', 
      /** @this {DraggableTarget} */
      function() {
        if (Draggable._lock) return ;

        self._dragging = true;
        self.initialPosition.x = this.x;
        self.initialPosition.y = this.y;
        self.flare('dragstart');
        this.flare('dragstart');
      });

      this.target.on('pointmove', 
      /** @this {DraggableTarget} */
      function(e) {
        if (!self._dragging) return ;

        this.x += e.pointer.dx;
        this.y += e.pointer.dy;
        self.flare('drag');
        this.flare('drag');
      });

      this.target.on('pointend', 
      /** @this {DraggableTarget} */
      function(e) {
        if (!self._dragging) return ;

        self._dragging = false;
        self.flare('dragend');
        this.flare('dragend');
      });
    });
  }

  /**
   * ドラッグ開始位置にターゲットを戻す
   * パラメータ指定することでtweenerアニメーションを使って戻すことも可能
   * 
   * 終了時に`backend`イベントを発火
   * 
   * @param {number} [time] アニメーション時間（ミリ秒）。無指定の場合は即座に戻す
   * @param {import("../util/tween").TweenEasingType} [easing='easeOutElastic'] アニメーション種類
   * @returns {void}
   */
  back(time, easing) {
    if (time) {
      var t = this.target;
      t.setInteractive(false);
      var tweener = new Tweener().attachTo(t);
      tweener
        .to({
          x: this.initialPosition.x,
          y: this.initialPosition.y,
        }, time, easing || 'easeOutElastic')
        .call(function() {
          tweener.remove();

          t.setInteractive(true);
          this.flare('backend');
        }, this);
    }
    else {
      this.target.x = this.initialPosition.x;
      this.target.y = this.initialPosition.y;
      this.flare('backend');
    }
  }

  /**
   * @private ※未使用のため
   * @returns {void}
   */
  enable() {
    this._enable = true;
  }

  /**
   * 全てのインスタンスでドラッグを無効化する
   * 
   * @returns {void}
   */
  static lock() {
    this._lock = true;
  }

  /**
   * 全てのインスタンスでドラッグ無効化を解除
   * 
   * @returns {void}
   */
  static unlock() {
    this._lock = false;
  }

}

/**
 * @private
 * @type {boolean}
 */
Draggable._lock = false;

// Element側で定義
// phina.app.Element.prototype.getter('draggable', function() {
//   if (!this._draggable) {
//     this._draggable = phina.accessory.Draggable().attachTo(this);
//   }
//   return this._draggable;
// });

/**
 * TODO: Elementのプロパティを引き継ぎたい…
 * @typedef {Element | any} ElementBasedObject
 * _typedef {{[k: string]: any} & Element} ElementBasedObject
 */

/**
 * Elementに適合するためのプロパティを保持してるかチェック: template用
 * @typedef {{
 *   addChild: (el: Elementizable)=> Elementizable
 *   remove: ()=> Elementizable
 *   parent?: Elementizable
 *   has: (type:string)=> boolean
 *   flare: (type:string)=> any
 * }} Elementizable 
 */

/**
 * @class phina.app.Element
 * _extends phina.util.EventDispatcher
 * # 主に要素の親子関係を扱うクラス
 * 主に親子関係等を定義するクラスです。
 */
class Element extends EventDispatcher {

  /**
   * @constructor
   */
  constructor() {
    super();

    /**
     * @type {ElementBasedObject | null}
     * 親要素
     */
    this.parent = null;

    /**
     * @type {ElementBasedObject[]}
     * 子要素配列
     */
    this.children = [];

    /**
     * @type {boolean}
     * 有効かどうか
     */
    this.awake = true;

    /**
     * @type {boolean}
     * 要素クリック管理用フラグ
     */
    this._clicked = false;

    /**
     * @type {import('../accessory/accessory').Accessory[]}
     * Accessory配列
     * attachメソッドによって初期化
     */
    this.accessories = undefined;

    /**
     * @private
     * @type {Tweener}
     * 内部Tweenerクラス
     * tweenerアクセサによって初期化
     */
    this._tweener = undefined;

    /**
     * @private
     * @type {Draggable}
     */
    this._draggable = undefined;
  }

  /**
   * @method addChild
   * 自身に子要素を追加します。
   *
   * 自身を子要素として引数で指定した要素に追加するには {@link #addChildTo} を使用してください。
   *
   * @template {Elementizable} T
   * @param {T} child 追加する子要素
   * @returns {T} 追加した子要素
   */
  addChild(child) {
    if (child.parent) child.remove();

    child.parent = this;
    this.children.push(child);

    child.has('added') && child.flare('added');

    return child;
  }

  /**
   * @method addChildTo
   * 自身を子要素として引数で指定した要素に追加します。
   *
   * 自身に子要素を追加するには {@link #addChild} を使用してください。
   *
   * @template {Elementizable} T
   * @param {T} parent 自身を子要素として追加する要素
   * @returns {this}
   */
  addChildTo(parent) {
    parent.addChild(this);

    return this;
  }

  /**
   * @method addChildAt
   * 自身を、指定した要素の子要素の任意の配列インデックスに追加します。
   *
   * @template {Elementizable} T
   * @param {T} child 追加する子要素
   * @param {Number} index インデックス番号
   * @returns {T} 追加した子要素
   */
  addChildAt(child, index) {
    if (child.parent) child.remove();

    child.parent = this;
    this.children.splice(index, 0, child);

    child.has('added') && child.flare('added');

    return child;
  }

  /**
   * @method getChildAt
   * 指定したインデックスの子要素を返します。
   *
   * @param {Number} index インデックス番号
   * @returns {ElementBasedObject} 指定したインデックスの子要素
   */
  getChildAt(index) {
    // return this.children.at(index);
    return at.call(this.children, index);
  }

  /**
   * @todo
   * @method getChildByName
   * 指定した名前の子要素を返します。（未実装）
   */
  getChildByName(name) {
    // TODO:
  }

  /**
   * @method getChildIndex
   * 指定した子要素のインデックス番号を返します。
   *
   * @param {ElementBasedObject} child 子要素
   * @return {Number} 指定した子要素のインデックス番号
   */
  getChildIndex(child) {
    return this.children.indexOf(child);
  }

  /**
   * @method getParent
   * 指定した要素の親要素を返します。
   *
   * @return {ElementBasedObject} 指定した要素の親要素
   */
  getParent() {
    return this.parent;
  }

  /**
   * @method getRoot
   * 指定した要素の階層ツリーのルートを返します。
   *
   * @return {ElementBasedObject} 指定した要素の階層ツリーのルート
   */
  getRoot() {
    /** @type {ElementBasedObject} */
    var elm = this;
    for (elm=this.parent; elm.parent != null; elm = elm.parent) {

    }
    return elm;
  }

  /**
   * @method removeChild
   * @chainable
   * 指定した要素を自身の子要素から削除します。
   *
   * @template {Elementizable} T
   * @param {T} child 要素
   * @returns {this}
   */
  removeChild(child) {
    var index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.has('removed') && child.flare('removed');
    }
    return this;
  }

  /**
   * @method remove
   * 自身を親要素の子要素から削除します。
   * @returns {this}
   */
  remove() {
    if (!this.parent) return ;

    this.parent.removeChild(this);
    this.parent = null;

    return this;
  }

  /**
   * @method isAwake
   * 自身が有効かどうかを返します。
   *
   * @return {Boolean} 有効かどうか
   */
  isAwake() {
    return this.awake;
  }

  /**
   * @method wakeUp
   * 自身を有効にします。
   * @returns {this}
   */
  wakeUp() {
    this.awake = true;
    return this;
  }

  /**
   * @method sleep
   * 自身を無効にします。
   * @returns {this}
   */
  sleep() {
    this.awake = false;
    return this;
  }

  /**
   * @virtual
   * 更新用仮想関数
   * @param {import("../game/gameapp").AppUnion} [_app] アプリケーションクラス
   * @returns {any}
   */
  update(_app) {}

  /**
   * @method fromJSON
   * JSON 形式を使って自身に子要素を追加することができます。
   *
   * ### Example
   *      this.fromJSON({
   *        "children": {
   *          "label": {                  //キー名が追加する子要素の名前になる
   *            "className": "Label",     //クラス
   *            "arguments": ['hello!'],  //初期化時の引数
   *            "x":320,                  //その他プロパティ
   *            "y":480,
   *          },
   *        },
   *      });
   * 
   * @typedef {{
   *   children?: fromJSONData
   *   className?: string | (new (...args: any)=> any)
   *   arguments?: any
   *   [otherProp: string]: any
   * }} fromJSONData
   * @param {fromJSONData} json JSON 形式
   * @returns {this}
   */
  fromJSON(json) {

    var createChildren = 
      /**
       * @param {string | number} name
       * @param {fromJSONData} data
       */
      function(name, data) {
      var args = data.arguments;
      args = (args instanceof Array) ? args : [args];

      var _class;
      var element;
      if (typeof data.className === 'string') {
        // is phina class
        _class = phina.using(data.className);
        element = _class.apply(null, args);
      } else if (typeof data.className === 'function') {
        // is ES class
        // FIXME: インスタンス化にスプレッド構文が必要なため、es5サポートの場合babelが必要
        element = new data.className(...args);
      }

      element.name = name;
      this[name] = element;

      element.fromJSON(data);
      element.addChildTo(this);
    }.bind(this);

    forIn.call(json, function(key, value) {
    // json.forIn(function(key, value) {
      if (key === 'children') {
        forIn.call(value, function(name, data) {
        // value.forIn(function(name, data) {
          createChildren(name, data);
        });
      }
      else {
        if (key !== 'type' && key !== 'className') {
          this[key] = value;
        }
      }
    }, this);

    return this;
  }

  // /**
  //  * @method toJSON
  //  * 自身の子要素を JSON 形式で返します。
  //  *
  //  * @return {JSON} JSON形式
  //  */
  // toJSON() {
  //   var keys = Object.keys(phina.using(this.className).defaults || {});

  //   this._hierarchies.forEach(function(e) {
  //     var d = e.defaults;
  //     if (d) {
  //       Object.keys(d).forEach(function(k) {
  //         if (keys.indexOf(k) === -1) {
  //           keys.push(k);
  //         }
  //       });
  //     }
  //   });

  //   keys.push('name', 'className');

  //   var json = {};
  //   // keys.each(function(key) {
  //   keys.forEach(function(key) {
  //     json[key] = this[key];
  //   }, this);

  //   var children = this.children.map(function(child) {
  //     return child.toJSON();
  //   });

  //   if (children.length) {
  //     json.children = {};
  //     // children.each(function(child, i) {
  //     children.forEach(function(child, i) {
  //       json.children[child.name || (child.className + '_' + i)] = child;
  //     });
  //   }

  //   return json;
  // }

  /**
   * accessoryを付与する
   * @param  {import('../accessory/accessory').Accessory} accessory Accessory継承クラス
   * @return {this}
   */
  attach(accessory) {
    if (!this.accessories) {
      this.accessories = [];
      this.on('enterframe', function(e) {
        this.accessories.forEach(function(accessory) {
          accessory.update && accessory.update(e.app);
        });
      });
    }

    this.accessories.push(accessory);
    accessory.setTarget(this);
    accessory.flare('attached');

    return this;
  }

  /**
   * accessoryを削除
   * @param  {import('../accessory/accessory').Accessory} accessory Accessory継承クラス
   * @return {this}
   */
  detach(accessory) {
    if (this.accessories) {
      // this.accessories.erase(accessory);
      erase.call(this.accessories, accessory);
      accessory.setTarget(null);
      accessory.flare('detached');
    }

    return this;
  }

  /**
   * 自身に付与（attach）された内部tweenerオブジェクトを返却
   * 
   * アクセス時に存在しない場合、新たにTweenerを生成・付与する
   */
  get tweener() {
    if (!this._tweener) {
      this._tweener = new Tweener().attachTo(this);
    }
    return this._tweener;
  }

  /**
   * 自身に付与（attach）された内部draggableオブジェクトを返却
   * 
   * アクセス時に存在しない場合、新たにDraggableを生成・付与する
   * その際自動で有効化されるため、アクセスした地点でドラッグ可能になる
   */
  get draggable() {
    if (!this._draggable) {
      this._draggable = new Draggable().attachTo(this);
    }
    return this._draggable;
  }
}

/**
 * @typedef {string|number} SceneLabel
 */

/**
 * exitメソッド用パラメータ
 * @typedef {{
 *   nextLabel?: SceneLabel
 *   [key: string]: any,
 * }} NextArgumentsForExit
 */

/**
 * SceneのAppクラス参照として最低限のインタフェースを備えた型
 * @typedef {{
 *   popScene: typeof import("./baseapp").BaseApp.prototype.popScene
 *   [key: string]: any,
 * }} SceneAppAppliable
 */

/**
 * @class phina.app.Scene
 * _extends phina.app.Element
 */
class Scene extends Element {

  constructor() {
    super();

    /**
     * Appクラス参照
     * @type {SceneAppAppliable?}
     */
    this.app;

    /**
     * 次のシーンを表すラベル
     * @type {SceneLabel}
     */
    this.nextLabel;

    /**
     * 次のシーンに渡される引数を保持
     * ManagerSceneクラスで使用
     * @type {any}
     */
    this.nextArguments;
  }

  /**
   * 現在のシーンを抜ける
   * 
   * @example
   * const scene = new Scene();
   * scene.exit("nextscenelabel", {score: 128})
   * // or
   * scene.exit({nextLabel:"nextscenelabel", score: 128})
   * 
   * @param {SceneLabel | NextArgumentsForExit} [nextLabelOrArguments]
   * 次シーンのラベル、もしくはラベル込みの引数オブジェクト
   * 
   * @param {any} [nextArguments]
   * 引数オブジェクト
   * 第一引数をラベル文字列で指定した場合に設定
   * 
   * @returns {this}
   */
  exit(nextLabelOrArguments, nextArguments) {
    if (!this.app) return ;

    if (arguments.length > 0) {
      if (typeof arguments[0] === 'object') {
        nextLabelOrArguments = arguments[0].nextLabel || this.nextLabel;
        nextArguments = arguments[0];
      }

      this.nextLabel = /** @type {SceneLabel} */(nextLabelOrArguments);
      this.nextArguments = nextArguments;
    }

    this.app.popScene();

    return this;
  }

}

/**
 * @typedef {(
 *   Scene |
 *   import("../display/displayscene").DisplayScene |
 *   import("../game/managerscene.js").ManagerScene
 * )} SceneTypeUnion
 */

/**
 * @class phina.app.BaseApp
 * _extends phina.util.EventDispatcher
 * 
 * アプリケーションクラスの基底クラス
 */
class BaseApp extends EventDispatcher {

  /**
   * @constructor
   */
  constructor() {
    super();

    /**
     * シーンのスタック
     * @protected
     * @type {SceneTypeUnion[]}
     */
    this._scenes = [new Scene()];

    /**
     * シーンのインデックス値
     * アクティブ中のシーン管理に使用
     * @protected
     * @type {number}
     */
    this._sceneIndex = 0;

    /**
     * 更新処理が有効な状態かどうか
     * @type {boolean}
     */
    this.awake = true;

    /** @type {Updater} */
    this.updater = new Updater(this);

    /** @type {Interactive} */
    this.interactive = new Interactive(this);

    /** @type {Ticker} */
    this.ticker = new Ticker();
    
    /**
     * tickerによって毎フレーム実行されるアプリ内部処理
     * @private
     * @type {import("../util/eventdispatcher").PhinaEventHandler | null}
     */
    this._loopCaller;
  }

  /**
   * アプリケーションを開始
   * 
   * @returns {this}
   */
  run() {
    var self = this;
    this._loopCaller = function() {
      self._loop();
    };
    this.ticker.tick(this._loopCaller);

    this.ticker.start();

    return this;
  }

  /**
   * アプリケーションを完全停止
   * 
   * @returns {this}
   */
  kill() {
    this.ticker.stop();
    if (this._loopCaller) this.ticker.untick(this._loopCaller);
    return this;
  }

  /**
   * 指定したシーンに切り替える
   * 
   * @param {SceneTypeUnion} scene
   * @returns {this}
   */
  replaceScene(scene) {
    this.flare('replace');
    this.flare('changescene');

    if (this.currentScene) {
      this.currentScene.app = null;
    }
    this.currentScene = scene;
    this.currentScene.app = this;
    this.currentScene.flare('enter', {
      app: this,
    });

    return this;
  }

  /**
   * 指定したsceneに遷移する
   * 
   * replaceSceneとは違い、遷移前のシーンは停止して保持し続ける。
   * そのため、ポーズやオブション画面などの一時的なシーンでの使用に最適
   * 
   * 具体的にはシーンスタックにシーンを追加しつつ、
   * インデックス値を進めることでシーン遷移する
   * 
   * @param {Scene} scene
   * @returns {this}
   */
  pushScene(scene) {
    this.flare('push');
    this.flare('changescene');

    this.currentScene.flare('pause', {
      app: this,
    });

    this._scenes.push(scene);
    ++this._sceneIndex;

    this.flare('pushed');

    scene.app = this;
    scene.flare('enter', {
      app: this,
    });

    return this;
  }

  /**
   * 現在のシーンを抜け、直前のシーンに戻る
   * ポーズやオブション画面など、一時的なシーンを抜ける際に使用
   * 
   * pushScene同様、シーンスタックの操作によって
   * アクティブなシーンを切り替える
   * 
   * @returns {Scene | void} 抜けたSceneオブジェクト、処理できなかった場合は何も返さない
   */
  popScene() {
    this.flare('pop');
    this.flare('changescene');

    // Keep rootScene
    if (this._scenes.length <= 1) return;

    var scene = /** @type {Scene} */(this._scenes.pop());
    --this._sceneIndex;

    scene.flare('exit', {
      app: this,
    });
    scene.app = null;

    this.flare('poped');

    this.currentScene.flare('resume', {
      app: this,
      prevScene: scene,
    });

    return scene;
  }

  /**
   * アプリケーションの再開
   * 更新処理の実行を再開する
   * 
   * @returns {this}
   */
  start() {
    this.awake = true;

    return this;
  }

  /**
   * アプリケーションの一時停止
   * 更新処理を実行しないようにする
   * 
   * @returns {this}
   */
  stop() {
    this.awake = false;

    return this;
  }

  /**
   * stats.js( https://github.com/mrdoob/stats.js/ )を実行し、
   * パフォーマンスモニターを表示する
   * 
   * stats.jsがグローバルで読み込まれていない場合、
   * cdnjsからr14版スクリプトを読み込む
   * 
   * @returns {this}
   */
  enableStats() {
    if (phina.global['Stats']) {
      this.stats = new phina.global['Stats']();
      document.body.appendChild(this.stats.domElement);
    }
    else {
      // console.warn("not defined stats.");
      var STATS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/stats.js/r14/Stats.js';
      var script = document.createElement('script');
      script.src = STATS_URL;
      document.body.appendChild(script);
      script.onload = function() {
        this.enableStats();
      }.bind(this);
    }
    return this;
  }

  /**
   * dat.GUI( https://github.com/dataarts/dat.gui )を初期化し、
   * そのインスタンスをコールバック関数に渡して実行
   * 
   * dat.GUIがグローバルで読み込まれていない場合、
   * cdnjsからv0.5.1版スクリプトを読み込む
   * 
   * @param {(datGUIObject?: any) => any} callback
   * @returns {this}
   */
  enableDatGUI(callback) {
    if (phina.global['dat']) {
      var gui = new phina.global['dat'].GUI();
      callback(gui);
    }
    else {
      // console.warn("not defined dat.GUI.");
      var URL = 'https://cdnjs.cloudflare.com/ajax/libs/dat-gui/0.5.1/dat.gui.js';
      var script = document.createElement('script');
      script.src = URL;
      document.body.appendChild(script);
      script.onload = function() {
        var gui = new phina.global['dat'].GUI();
        callback(gui);
      }.bind(this);
    }
    return this;
  }

  /**
   * @protected
   * ループ処理関数
   * 
   * @returns {void}
   */
  _loop() {
    this._update();
    this.interactive.check(this.currentScene);
    this._draw();

    // stats update
    if (this.stats) this.stats.update();
  }

  /**
   * @protected
   * 更新処理関数
   * 
   * @returns {void}
   */
  _update() {
    if (this.awake) {
      // エンターフレームイベント
      if (this.has('enterframe')) {
        this.flare('enterframe');
      }

      this.update && this.update();
      this.updater.update(this.currentScene);
    }
  }

  /**
   * 更新用仮想関数
   * 
   * @virtual
   * @returns {any}
   */
  update() {}

  /**
   * 描画用仮想関数
   * 
   * @virtual
   * @returns {any}
   */
  _draw() {}

  /**
   * 現在アクティブ中のシーン
   */
  get currentScene()   { return this._scenes[this._sceneIndex]; }
  set currentScene(v)  { this._scenes[this._sceneIndex] = v; }

  /**
   * 根本シーン。インスタンス化の際に自動的に設定
   */
  get rootScene()   { return this._scenes[0]; }
  set rootScene(v)  { this._scenes[0] = v; }

  /**
   * 経過フレーム数
   */
  get frame() { return this.ticker.frame; }
  set frame(v) { this.ticker.frame = v; }

  /**
   * Frame per second  
   * 秒間の更新および描画処理回数
   */
  get fps() { return this.ticker.fps; }
  set fps(v) { this.ticker.fps = v; }

  /**
   * 前フレームでの処理にかかった時間
   */
  get deltaTime() { return this.ticker.deltaTime; }

  /**
   * アプリケーション開始からの経過時間
   */
  get elapsedTime() { return this.ticker.elapsedTime; }

  /**
   * 現在の時間（最後の更新時のUNIXタイムスタンプ）
   */
  get currentTime() { return this.ticker.currentTime; }

  /**
   * アプリケーション開始時間（UNIXタイムスタンプ）
   */
  get startTime() { return this.ticker.startTime; }
}

/**
 * 判定処理の際、どのような形状として扱うか
 * @typedef {"rect"|"circle"|"none"} Object2DBoundingType
 */

/**
 * @typedef {{
 *  x?: Number,
 *  y?: Number,
 *  scaleX?: Number,
 *  scaleY?: Number,
 *  rotation?: Number,
 *  originX?: Number,
 *  originY?: Number,
 *  width?: Number,
 *  height?: Number,
 *  radius?: Number,
 *  boundingType?: Object2DBoundingType,
 * }} Object2DOptions
 */

/**
 * @class phina.app.Object2D
 * Object2D
 * _extends phina.app.Element
 */
class Object2D extends Element {

  // /** 位置 */
  // position: null,
  // /** 回転 */
  // rotation: 0,
  // /** スケール */
  // scale: null,
  // /** 基準位置 */
  // origin: null,

  /**
   * @param {Object2DOptions} [options]
   */
  constructor(options) {
    super();

    options = $safe.call({}, options, Object2D.defaults);
    // options = ({}).$safe(options, phina.app.Object2D.defaults);

    /** @type {Vector2} 位置 */
    this.position = new Vector2(options.x, options.y);

    /** @type {Vector2} スケール */
    this.scale    = new Vector2(options.scaleX, options.scaleY);

    /** @type {number} 回転（度数単位） */
    this.rotation = options.rotation || 0;

    /** @type {Vector2} 基準位置、回転軸 */
    this.origin   = new Vector2(options.originX, options.originY);

    /**
     * @private
     * @type {Matrix33}
     * ローカル変換行列
     */
    this._matrix = new Matrix33().identity();
    /**
     * @type {Matrix33 | null}
     * ワールド変換行列
     */
    this._worldMatrix = new Matrix33().identity();

    /**
     * @private
     * @type {number} 行列計算用キャッシュ値
     */
    this._cachedRotation;
    /**
     * @private
     * @type {number} 行列計算用キャッシュ値
     */
    this._sr;
    /**
     * @private
     * @type {number} 行列計算用キャッシュ値
     */
    this._cr;

    /**
     * @type {boolean}
     * インタラクション可能かどうか
     */
    this.interactive = false;
    /**
     * @type {{ [id: number]: boolean }}
     * Interactiveクラスでのフラグ処理用
     */
    this._overFlags = {};
    /**
     * @type {{ [id: number]: boolean }}
     * Interactiveクラスでのフラグ処理用
     */
    this._touchFlags = {};

    /**
     * @protected
     * @type {number}
     */
    this._width;
    /**
     * @protected
     * @type {number}
     */
    this._height;
    /**
     * 半径: boundingTypeがcircleの場合のみ使用
     * @private
     * @type {number}
     */
    this._radius;
    /**
     * 直径: boundingTypeがcircleの際にwidth/height値として使用  
     * radiusアクセサsetの際に更新
     * @private
     * @type {number}
     */
    this._diameter;

    this.width = options.width;
    this.height = options.height;
    this.radius = options.radius;
    /**
     * 当たり判定範囲の種別
     * @type {Object2DBoundingType}
     */
    this.boundingType = options.boundingType;

    /** @type {Object2D|PhinaElement} */
    this.parent;
  }

  /**
   * 点と衝突しているかを判定
   * @param {Number} x
   * @param {Number} y
   */
  hitTest(x, y) {
    if (this.boundingType === 'rect') {
      return this.hitTestRect(x, y);
    }
    else if (this.boundingType === 'circle') {
      return this.hitTestCircle(x, y);
    }
    else {
      // none の場合
      return true;
    }
  }

  /**
   * 自身を矩形として、点と衝突しているかを判定
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  hitTestRect(x, y) {
    var p = this.globalToLocal(new Vector2(x, y));

    var left   = -this.width*this.originX;
    var right  = +this.width*(1-this.originX);
    var top    = -this.height*this.originY;
    var bottom = +this.height*(1-this.originY);

    return ( left < p.x && p.x < right ) && ( top  < p.y && p.y < bottom );
  }

  /**
   * 自身を円形として、点と衝突しているかを判定
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  hitTestCircle(x, y) {
    // 円判定
    var p = this.globalToLocal(new Vector2(x, y));
    if (((p.x)*(p.x)+(p.y)*(p.y)) < (this.radius*this.radius)) {
        return true;
    }
    return false;
  }

  /**
   * 要素と衝突しているかを判定
   * @param {Object2D} elm
   * @returns {boolean}
   */
  hitTestElement(elm) {
    var rect0 = this;
    var rect1 = elm;
    return (rect0.left < rect1.right) && (rect0.right > rect1.left) &&
           (rect0.top < rect1.bottom) && (rect0.bottom > rect1.top);
  }

  /**
   * 渡された座標をローカル座標に変換して返す
   * @param {import("../geom/vector2").PrimitiveVector2} p 値は変更しません
   * @returns {Vector2} 新規作成されたローカル座標オブジェクト
   */
  globalToLocal(p) {
    var matrix = this._worldMatrix.clone();
    matrix.invert();
    // matrix.transpose();

    var temp = matrix.multiplyVector2(p);

    return temp;
  }

  /**
   * インタラクション可能かどうかを変更  
   * 同時にboundingTypeも変更可能
   * @param {boolean} flag
   * @param {Object2DBoundingType} [type]
   * @returns {this}
   */
  setInteractive(flag, type) {
    this.interactive = flag;
    if (type) {
      this.boundingType = type;
    }

    return this;
  }

  /**
   * X 座標値をセット
   * @param {Number} x
   * @returns {this}
   */
  setX(x) {
    this.position.x = x;
    return this;
  }
  
  /**
   * Y 座標値をセット
   * @param {Number} y
   * @returns {this}
   */
  setY(y) {
    this.position.y = y;
    return this;
  }
  
  /**
   * XY 座標をセット
   * @param {Number} x
   * @param {Number} y
   * @returns {this}
   */
  setPosition(x, y) {
    this.position.x = x;
    this.position.y = y;
    return this;
  }

  /**
   * 回転をセット
   * @param {Number} rotation
   * @returns {this}
   */
  setRotation(rotation) {
    this.rotation = rotation;
    return this;
  }

  /**
   * スケールをセット
   * @param {Number} x
   * @param {Number} [y] 省略した場合、xパラメータ値が適用されます
   * @returns {this}
   */
  setScale(x, y) {
    this.scale.x = x;
    if (arguments.length <= 1) {
        this.scale.y = x;
    } else {
        this.scale.y = y;
    }
    return this;
  }
  
  /**
   * 基準点をセット
   * @param {Number} x
   * @param {Number} y
   * @returns {this}
   */
  setOrigin(x, y) {
    this.origin.x = x;
    this.origin.y = y;
    return this;
  }
  
  /**
   * 幅をセット
   * @param {Number} width
   * @returns {this}
   */
  setWidth(width) {
    this.width = width;
    return this;
  }
  
  /**
   * 高さをセット
   * @param {Number} height
   * @returns {this}
   */
  setHeight(height) {
    this.height = height;
    return this;
  }
  
  /**
   * サイズ(幅, 高さ)をセット
   * @param {Number} width
   * @param {Number} height
   * @returns {this}
   */
  setSize(width, height) {
    this.width  = width;
    this.height = height;
    return this;
  }

  /**
   * @param {Object2DBoundingType} type
   * @returns {this}
   */
  setBoundingType(type) {
    this.boundingType = type;
    return this;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {this}
   */
  moveTo(x, y) {
    this.position.x = x;
    this.position.y = y;
    return this;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {this}
   */
  moveBy(x, y) {
    this.position.x += x;
    this.position.y += y;
    return this;
  }

  /**
   * グローバル行列を計算
   * @returns {this}
   */
  _calcWorldMatrix() {
    if (!this.parent) return ;

    // cache check
    if (this.rotation != this._cachedRotation) {
      this._cachedRotation = this.rotation;

      var r = this.rotation*(Math.PI/180);
      this._sr = Math.sin(r);
      this._cr = Math.cos(r);
    }

    var local = this._matrix;
    var parent = /** @type {Object2D} */(this.parent)._worldMatrix || Matrix33.IDENTITY;
    var world = this._worldMatrix;

    // ローカルの行列を計算
    local.m00 = this._cr * this.scale.x;
    local.m01 =-this._sr * this.scale.y;
    local.m10 = this._sr * this.scale.x;
    local.m11 = this._cr * this.scale.y;
    local.m02 = this.position.x;
    local.m12 = this.position.y;

    // cache
    var a00 = local.m00; var a01 = local.m01; var a02 = local.m02;
    var a10 = local.m10; var a11 = local.m11; var a12 = local.m12;
    var b00 = parent.m00; var b01 = parent.m01; var b02 = parent.m02;
    var b10 = parent.m10; var b11 = parent.m11; var b12 = parent.m12;

    // 親の行列と掛け合わせる
    world.m00 = b00 * a00 + b01 * a10;
    world.m01 = b00 * a01 + b01 * a11;
    world.m02 = b00 * a02 + b01 * a12 + b02;

    world.m10 = b10 * a00 + b11 * a10;
    world.m11 = b10 * a01 + b11 * a11;
    world.m12 = b10 * a02 + b11 * a12 + b12;

    return this;
  }

  /**
   * @property    x
   * x座標値
   */
  get x()   { return this.position.x; }
  set x(v)  { this.position.x = v; }

  /**
   * @property    y
   * y座標値
   */
  get y()   { return this.position.y; }
  set y(v)  { this.position.y = v; }

  /**
   * @property    originX
   * x座標値
   */
  get originX()   { return this.origin.x; }
  set originX(v)  { this.origin.x = v; }

  /**
   * @property    originY
   * y座標値
   */
  get originY()   { return this.origin.y; }
  set originY(v)  { this.origin.y = v; }

  /**
   * @property    scaleX
   * スケールX値
   */
  get scaleX()   { return this.scale.x; }
  set scaleX(v)  { this.scale.x = v; }
  
  /**
   * @property    scaleY
   * スケールY値
   */
  get scaleY()   { return this.scale.y; }
  set scaleY(v)  { this.scale.y = v; }
  
  /**
   * @property    width
   * width
   */
  get width()   {
    return (this.boundingType === 'rect') ?
      this._width : this._diameter;
  }
  set width(v)  { this._width = v; }

  /**
   * @property    height
   * height
   */
  get height()   {
    return (this.boundingType === 'rect') ?
      this._height : this._diameter;
  }
  set height(v)  { this._height = v; }

  /**
   * @property    radius
   * 半径
   */
  get radius()   {
    return (this.boundingType === 'rect') ?
      (this.width+this.height)/4 : this._radius;
  }
  set radius(v)  {
    this._radius = v;
    this._diameter = v*2;
  }
  
  /**
   * @property    top
   * 左
   */
  get top()   { return this.y - this.height*this.originY; }
  set top(v)  { this.y = v + this.height*this.originY; }

  /**
   * @property    right
   * 左
   */
  get right()   { return this.x + this.width*(1-this.originX); }
  set right(v)  { this.x = v - this.width*(1-this.originX); }

  /**
   * @property    bottom
   * 左
   */
  get bottom()   { return this.y + this.height*(1-this.originY); }
  set bottom(v)  { this.y = v - this.height*(1-this.originY); }

  /**
   * @property    left
   * 左
   */
  get left()   { return this.x - this.width*this.originX; }
  set left(v)  { this.x = v + this.width*this.originX; }

  /**
   * @property    centerX
   * centerX
   */
  get centerX()   { return this.x + this.width/2 - this.width*this.originX; }
  // set centerX(v)  {
  //   // TODO: どうしようかな??
  // }

  /**
   * @property    centerY
   * centerY
   */
  get centerY()   { return this.y + this.height/2 - this.height*this.originY; }
  // set centerY(v)  {
  //   // TODO: どうしようかな??
  // }
}

/**
 * @type {Object2DOptions}
 * @static
 */
Object2D.defaults = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  originX: 0.5,
  originY: 0.5,
  width: 64,
  height: 64,
  radius: 32,
  boundingType: 'rect',
};

/**
 * phina独自のPointer型
 * @typedef {Mouse | PhinaTouch} Pointer
 */

/**
 * DomApp初期化オプション  
 * domElementもしくはqueryいずれかは必ず指定すること
 * @typedef {{
 *  domElement?: HTMLCanvasElement;
 *  query?: string; 
 *  fps?: number; 
 *  runner?: (run: TimerHandler, delay: number) => void;
 * }} DomAppOptions
 */

/**
 * @class phina.display.DomApp
 * _extends phina.app.BaseApp
 */
class DomApp extends BaseApp {

  /**
   * @constructor
   * @param {DomAppOptions} options
   */
  constructor(options) {
    super();

    /** @type HTMLCanvasElement */
    this.domElement;

    if (options.domElement) {
      this.domElement = options.domElement;
    }
    else {
      if (options.query) {
        this.domElement = document.querySelector(options.query);
      }
      else {
        console.assert('error');
      }
    }

    if (options.fps !== undefined) {
      this.fps = options.fps;
    }
    
    if(typeof options.runner === 'function') {
      this.ticker.runner = options.runner;
    }

    this.mouse = new Mouse(this.domElement);
    this.touch = new Touch$1(this.domElement);
    this.touchList = new TouchList(this.domElement);
    this.keyboard = new Keyboard(document);
    // // 加速度センサーを生成
    // this.accelerometer = phina.input.Accelerometer();

    // ポインタをセット(PC では Mouse, Mobile では Touch)
    /** @type {Pointer} */
    this.pointer = this.touch;
    /** @type {Pointer[]} */
    this.pointers = this.touchList.touches;
    this.domElement.addEventListener("touchstart", 
    /** @this DomApp */
    function () {
      this.pointer = this.touch;
      this.pointers = this.touchList.touches;
    }.bind(this));
    this.domElement.addEventListener("mouseover", 
    /** @this DomApp */
    function () {
      this.pointer = this.mouse;
      this.pointers = [this.mouse];
    }.bind(this));

    // keyboard event
    this.keyboard.on('keydown', function(e) {
      this.currentScene && this.currentScene.flare('keydown', {
        keyCode: e.keyCode,
      });
    }.bind(this));
    this.keyboard.on('keyup', function(e) {
      this.currentScene && this.currentScene.flare('keyup', {
        keyCode: e.keyCode,
      });
    }.bind(this));
    this.keyboard.on('keypress', function(e) {
      this.currentScene && this.currentScene.flare('keypress', {
        keyCode: e.keyCode,
      });
    }.bind(this));

    // click 対応
    var eventName = phina.isMobile() ? 'touchend' : 'mouseup';
    this.domElement.addEventListener(eventName, this._checkClick.bind(this));

    // 決定時の処理をオフにする(iPhone 時のちらつき対策)
    this.domElement.addEventListener("touchstart", function(e) { stop.call(e); });
    this.domElement.addEventListener("touchmove", function(e) { stop.call(e); });

    // ウィンドウフォーカス時イベントリスナを登録
    phina.global.addEventListener('focus', function() {
      this.flare('focus');
      this.currentScene.flare('focus');
    }.bind(this), false);
    // ウィンドウブラー時イベントリスナを登録
    phina.global.addEventListener('blur', function() {
      this.flare('blur');
      this.currentScene.flare('blur');
    }.bind(this), false);

    // 更新関数を登録
    this.on('enterframe', function() {
      this.mouse.update();
      this.touch.update();
      this.touchList.update();
      this.keyboard.update();
    });
  }

  /**
   * @private
   * touchend/mouseupでの疑似clickイベント処理
   * @param {*} _e 
   */
  _checkClick(_e) {
    /** @param {import('../app/element').Element} element */
    var _check = function(element) {
      if (element.children.length > 0) {
        element.children.forEach(function(child) {
          _check(child);
        });
      }
      if (element._clicked && element.has('click')) {
        element.flare('click');
      }
      element._clicked = false;
    };

    _check(this.currentScene);
  }

}

/**
 * @typedef {import("../app/element").Element & {
 *   backgroundColor?: import("../graphics/canvas").CanvasStyle
 * }} RenderableScene
 */

/**
 * @typedef {import("./displayelement").DisplayElement & {
 *   clip?: (canvas: import('../graphics/canvas').Canvas)=> any,
 *   draw?: (canvas: import('../graphics/canvas').Canvas)=> any
 * }} RenderableElement
 */

/**
 * @class phina.display.CanvasRenderer
 */
class CanvasRenderer {

  /**
   * @param {import('../graphics/canvas').Canvas} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this._context = this.canvas.context;
  }

  /**
   * @param {RenderableScene} scene
   */
  render(scene) {
    this.canvas.clear();
    if (scene.backgroundColor) {
      this.canvas.clearColor(scene.backgroundColor);
    }

    this._context.save();
    this.renderChildren(scene);
    this._context.restore();
  }

  /**
   * @param {import("../app/element").ElementBasedObject} obj
   */
  renderChildren(obj) {
    // 子供たちも実行
    if (obj.children.length > 0) {
      var tempChildren = /** @type {RenderableElement[]}*/(obj.children.slice());
      for (var i=0,len=tempChildren.length; i<len; ++i) {
        this.renderObject(tempChildren[i]);
      }
    }
  }

  /**
   * @param {RenderableElement} obj
   */
  renderObject(obj) {
    if (obj.visible === false && !obj.interactive) return;

    obj._calcWorldMatrix && obj._calcWorldMatrix();

    if (obj.visible === false) return;

    obj._calcWorldAlpha && obj._calcWorldAlpha();

    var context = this.canvas.context;

    context.globalAlpha = obj._worldAlpha;
    context.globalCompositeOperation = obj.blendMode;

    if (obj._worldMatrix) {
      // 行列をセット
      var m = obj._worldMatrix;
      context.setTransform( m.m00, m.m10, m.m01, m.m11, m.m02, m.m12 );
    }

    if (obj.clip) {

      context.save();

      obj.clip(this.canvas);
      context.clip();

      if (obj.draw) obj.draw(this.canvas);

      // 子供たちも実行
      if (obj.renderChildBySelf === false && obj.children.length > 0) {
          var tempChildren = obj.children.slice();
          for (var i=0,len=tempChildren.length; i<len; ++i) {
              this.renderObject(tempChildren[i]);
          }
      }

      context.restore();
    }
    else {
      if (obj.draw) obj.draw(this.canvas);

      // 子供たちも実行
      if (obj.renderChildBySelf === false && obj.children.length > 0) {
        var tempChildren = obj.children.slice();
        for (var i=0,len=tempChildren.length; i<len; ++i) {
          this.renderObject(tempChildren[i]);
        }
      }

    }
  }

}

/**
 * @typedef {{
 *   width?: number,
 *   height?: number,
 *   imageSmoothing?: boolean,
 *   backgroundColor?: import("../graphics/canvas").CanvasStyle,
 * }} DisplaySceneOptions
 */

/**
 * @class phina.display.DisplayScene
 * _extends phina.app.Scene
 */
class DisplayScene extends Scene {

  /**
   * @param {DisplaySceneOptions} [params]
   */
  constructor(params) {
    super();

    params = $safe.call({}, params, DisplayScene.defaults);
    // params = ({}).$safe(params, DisplayScene.defaults);

    this.canvas = new Canvas();
    this.canvas.setSize(params.width, params.height);
    this.renderer = new CanvasRenderer(this.canvas);
    this.backgroundColor = (params.backgroundColor) ? params.backgroundColor : null;

    this.width = params.width;
    this.height = params.height;
    this.gridX = new Grid(params.width, 16);
    this.gridY = new Grid(params.height, 16);

    // TODO: 一旦むりやり対応
    this.interactive = true;
    // this.setInteractive = function(flag) {
    //   this.interactive = flag;
    // };
    this._overFlags = {};
    this._touchFlags = {};

    var ctx = this.canvas.context;
    if (params.imageSmoothing === false) {
      ctx.imageSmoothingEnabled = false;
      ctx['webkitImageSmoothingEnabled'] = false;
      ctx['msImageSmoothingEnabled'] = false;
    }
  }

  /**
   * @param {boolean} flag
   */
  setInteractive(flag) {
    this.interactive = flag;
  }

  hitTest() {
    return true;
  }

  /**
   * @virtual
   * @param {import("../display/canvasapp").CanvasApp} [_app] アプリケーション本体の参照
   */
  update(_app) {}

  /**
   * @returns {void}
   */
  _update() {
    if (this.update) {
      this.update();
    }
  }

  /**
   * @returns {void}
   */
  _render() {
    this.renderer.render(this);
  }

}

/** @type DisplaySceneOptions */
DisplayScene.defaults = {
  width: 640,
  height: 960,
  imageSmoothing: true,
};

/**
 * CanvasApp初期化オプション  
 * DisplaySceneの初期化に使われることも考え、そのオプションパラメータも継承
 * @typedef {{ 
 *  append?: boolean
 *  columns?: number
 *  backgroundColor?: import("../graphics/canvas").CanvasStyle
 *  fit?: boolean
 *  pixelated?: boolean
 * } 
 * & import("./domapp").DomAppOptions
 * & import("./displayscene").DisplaySceneOptions } CanvasAppOptions
 */

/**
 * @class phina.display.CanvasApp
 * _extends phina.display.DomApp
 */
class CanvasApp extends DomApp {

  /**
   * @constructor
   * @param {CanvasAppOptions} options
   */
  constructor(options) {
    options = $safe.call((options || {}), CanvasApp.defaults);
    // options = (options || {}).$safe(CanvasApp.defaults);
    
    if (!options.query && !options.domElement) {
      options.domElement = document.createElement('canvas');
      if (options.append) {
        document.body.appendChild(options.domElement);
      }
    }
    super(options);

    this.gridX = new Grid({
      width: options.width,
      columns: options.columns,
    });
    this.gridY = new Grid({
      width: options.height,
      columns: options.columns,
    });

    this.canvas = new Canvas(this.domElement);
    this.canvas.setSize(options.width, options.height);

    this.backgroundColor = (options.backgroundColor !== undefined) ? options.backgroundColor : 'white';

    this.replaceScene(new DisplayScene({
      width: options.width,
      height: options.height,
    }));

    if (options.fit) {
      this.fitScreen();
    }

    if (options.pixelated) {
      // チラつき防止
      // ドット絵ゲームのサポート
      // https://drafts.csswg.org/css-images/#the-image-rendering
      // https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering#Browser_compatibility
      if (navigator.userAgent.match(/Firefox\/\d+/)) {
        this.domElement.style.imageRendering = 'crisp-edges';
      } else {
        this.domElement.style.imageRendering = 'pixelated';
      }
    }

    // pushScene, popScene 対策
    this.on('push', function() {
      // onenter 対策で描画しておく
      if (this.currentScene.canvas) {
        this._draw();
      }
    });
  }

  /**
   * @override
   * 描画処理
   */
  _draw() {
    if (this.backgroundColor) {
      this.canvas.clearColor(this.backgroundColor);
    } else {
      this.canvas.clear();
    }

    var currentScene = /** @type {DisplayScene} */(this.currentScene);
    if (currentScene.canvas) {
      currentScene._render();

      // this._scenes.each(
      this._scenes.forEach(
      /** @param {DisplayScene} scene */
      function(scene) {
        var c = scene.canvas;
        if (c) {
          this.canvas.context.drawImage(c.domElement, 0, 0, c.width, c.height);
        }
      }, this);
    }
  }

  /**
   * CanvasクラスのfitScreenを実行
   * @returns {void}
   */
  fitScreen() {
    this.canvas.fitScreen();
  }

}

/**
 * @static
 * @type {CanvasAppOptions}
 */
CanvasApp.defaults = {
  width: 640,
  height: 960,
  columns: 12,
  fit: true,
  append: true,
};

/**
 * @typedef {{
 *   alpha?: number,
 *   visible?: boolean,
 * } & import("../app/object2d").Object2DOptions} DisplayElementOptions
 */

/**
 * globalCompositeOperation(https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation) のtypeと同じ
 * @typedef { 'source-over' | 'source-in' | 'source-out' | 'source-atop' | 'destination-over' | 'destination-in' | 'destination-out' | 'destination-atop' | 'lighter' | 'copy' | 'xor' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity'} BlendMode
 */

/**
 * @class phina.display.DisplayElement
 * _extends phina.app.Object2D
 */
class DisplayElement extends Object2D {

  /**
   * @param {DisplayElementOptions} [options] 
   */
  constructor(options) {
    options = $safe.call({}, options||{}, DisplayElement.defaults);
    // options = ({}).$safe(options || {}, phina.display.DisplayElement.defaults);
    super(options);

    /**
     * 表示フラグ
     * @type {boolean}
     */
    this.visible = (options.visible != null) ? options.visible : true;

    /**
     * アルファ値
     * @type {number}
     */
    this.alpha = (options.alpha != null) ? options.alpha : 1.0;

    /**
     * ブレンドモード
     * @type {BlendMode}
     */
    this.blendMode = "source-over";

    /**
     * 子供を 自分のCanvasRenderer で描画するか
     * @type {boolean}
     */
    this.renderChildBySelf = false;

    /** @type {DisplayElement} 型アサーション */
    this.parent;

    /**
     * グローバルアルファ内部値
     * @type {number}
     */
    this._worldAlpha = 1.0;
  }

  /**
   * アルファ値をセット
   * @param {number} alpha
   * @returns {this}
   */
  setAlpha(alpha) {
    this.alpha = alpha;
    return this;
  }

  /**
   * 表示/非表示をセット
   * @param {boolean} flag
   * @returns {this}
   */
  setVisible(flag) {
    this.visible = flag;
    return this;
  }

  /**
   * 表示
   * @returns {this}
   */
  show() {
    this.visible = true;
    return this;
  }

  /**
   * 非表示
   * @returns {this}
   */
  hide() {
    this.visible = false;
    return this;
  }

  /**
   * グローバルアルファ値の再計算
   * @returns {void}
   */
  _calcWorldAlpha() {
    if (this.alpha < 0) {
      this._worldAlpha = 0;
      return;
    }
    if (!this.parent) {
      this._worldAlpha = this.alpha;
      return ;
    }
    else {
      var worldAlpha = (this.parent._worldAlpha !== undefined) ? this.parent._worldAlpha : 1.0;
      // alpha
      this._worldAlpha = worldAlpha * this.alpha;
    }
  }

}

/**
 * @type {DisplayElementOptions}
 */
DisplayElement.defaults = {
  alpha: 1.0,
  visible: true,
};

/**
 * @class phina.asset.AssetManager
 * 
 */
class AssetManager {

  /**
   * @param {string} type "sound"、"image"などのアセット種類
   * @param {string} key アセットのキー
   */
  static get(type, key) {
    return this.assets[type] && this.assets[type][key];
  }

  /**
   * @param {string | number} type "sound"、"image"などのアセット種類
   * @param {string | number} key アセット登録キー
   * @param {any} asset Assetオブジェクト
   */
  static set(type, key, asset) {
    if (!this.assets[type]) {
      this.assets[type] = {};
    }
    this.assets[type][key] = asset;
  }

  /**
   * 未実装
   * @param {*} type 
   * @param {*} key 
   */
  static contains(type, key) {
    return ;
  }

}

AssetManager.assets = {
  image: {},
  sound: {},
  spritesheet: {},
};

/**
 * Sprite画像ソースとして使えるオブジェクト型
 * TextureクラスやCanvasクラスなど
 * @typedef {{
 *   domElement: HTMLCanvasElement | HTMLImageElement;
 *   [key: string]: any;
 * }} SpriteImage
 */

/**
 * AssetManagerに登録した画像キー、もしくはSpriteImageオブジェクト
 * @typedef {string | SpriteImage} SpriteImageSrc
 */

/**
 * @class phina.display.Sprite
 * _extends phina.display.DisplayElement
 */
class Sprite extends DisplayElement {

  /**
   * @param {SpriteImageSrc} image
   * @param {number} [width]
   * @param {number} [height]
   */
  constructor(image, width, height) {
    super();

    /**
     * スプライト元画像（テクスチャ）。setImageで初期化
     * @private
     * @type {SpriteImage}
     */
    this._image;

    /**
     * フレームインデックス。setImageで初期化
     * @private
     * @type {number}
     */
    this._frameIndex;

    /**
     * 画像描画範囲
     * @type {Rect}
     */
    this.srcRect = new Rect();

    this.setImage(image, width, height);
  }

  /**
   * @param {import("../graphics/canvas").Canvas} canvas 
   */
  draw(canvas) {
    var image = this.image.domElement;

    // canvas.context.drawImage(image,
    //   0, 0, image.width, image.height,
    //   -this.width*this.origin.x, -this.height*this.origin.y, this.width, this.height
    //   );

    var srcRect = this.srcRect;
    canvas.context.drawImage(image,
      srcRect.x, srcRect.y, srcRect.width, srcRect.height,
      -this._width*this.originX, -this._height*this.originY, this._width, this._height
      );
  }

  /**
   * スプライト元画像を設定
   * @param {SpriteImageSrc} image
   * @param {number} [width]
   * @param {number} [height]
   * @returns {this}
   */
  setImage(image, width, height) {
    if (typeof image === 'string') {
      image = AssetManager.get('image', image);
    }
    this._image = /**@type {SpriteImage} */ (image);
    this.width = this._image.domElement.width;
    this.height = this._image.domElement.height;

    if (width) { this.width = width; }
    if (height) { this.height = height; }

    this.frameIndex = 0;

    return this;
  }

  /**
   * フレームインデックスを指定し、そのフレームに合わせて描画範囲を更新  
   * @param {number} index フレームインデックス。最大値を超えた場合はループ
   * @param {number} [width] フレームサイズ幅
   * @param {number} [height] フレームサイズ高さ
   * @returns {this}
   */
  setFrameIndex(index, width, height) {
    var tw  = width || this._width;      // tw
    var th  = height || this._height;    // th
    var row = ~~(this.image.domElement.width / tw);
    var col = ~~(this.image.domElement.height / th);
    var maxIndex = row*col;
    index = index%maxIndex;
    
    var x = index%row;
    var y = ~~(index/row);
    this.srcRect.x = x*tw;
    this.srcRect.y = y*th;
    this.srcRect.width  = tw;
    this.srcRect.height = th;

    this._frameIndex = index;

    return this;
  }

  get image() {return this._image;}
  set image(v) {
    this.setImage(v);
  }

  get frameIndex() {return this._frameIndex;}
  set frameIndex(idx) {
    this.setFrameIndex(idx);
  }
}

/**
 * @class phina.display.PlainElement
 * _extends phina.display.DisplayElement
 */
class PlainElement extends DisplayElement {

  /**
   * @param {DisplayElement.defaults} options 
   */
  constructor(options) {
    super(options);
    this.canvas = new Canvas();
    this.canvas.setSize(this.width, this.height);
  }

  /**
   * @param {Canvas} canvas
   * @returns {void}
   */
  draw(canvas) {
    var image = this.canvas.domElement;
    var w = image.width;
    var h = image.height;

    var x = -w*this.origin.x;
    var y = -h*this.origin.y;

    canvas.context.drawImage(image,
      0, 0, w, h,
      x, y, w, h
      );
  }
}

/**
 * @class phina.display.Layer
 * _extends phina.display.DisplayElement
 */
class Layer extends DisplayElement {

  /**
   * @param {DisplayElement.defaults} [options] 
   */
  constructor(options) {
    options = $safe.call({}, options||{}, {
    // options = ({}).$safe(options, {
      width: 640,
      height: 960,
    });
    super(options);
    this.width = options.width;
    this.height = options.height;
    this.gridX = new Grid(options.width, 16);
    this.gridY = new Grid(options.height, 16);
    this.renderChildBySelf = true;

    /**
     * @type HTMLCanvasElement 
     */
    this.domElement;
  }

  /**
   * @param {Canvas} canvas
   * @returns {void}
   */
  draw(canvas) {
    if (!this.domElement) return ;

    var image = this.domElement;
    canvas.context.drawImage(image,
      0, 0, image.width, image.height,
      -this.width*this.originX, -this.height*this.originY, this.width, this.height
      );
  }
}


/**
 * @class phina.display.CanvasLayer
 * _extends phina.display.Layer
 */
class CanvasLayer extends Layer {

  /**
   * @param {DisplayElement.defaults} options 
   */
  constructor(options) {
    super(options);
    this.canvas = new Canvas();
    this.canvas.width  = this.width;
    this.canvas.height = this.height;

    this.renderer = new CanvasRenderer(this.canvas);
    this.domElement = this.canvas.domElement;

    this.on('enterframe',
    /** @this CanvasLayer */
    function() {
      var temp = this._worldMatrix;
      this._worldMatrix = null;
      this.renderer.render(this);
      this._worldMatrix = temp;
    });
  }

  /**
   * @param {Canvas} canvas
   * @returns {void}
   */
  draw(canvas) {
    var image = this.domElement;
    canvas.context.drawImage(image,
      0, 0, image.width, image.height,
      -this.width*this.originX, -this.height*this.originY, this.width, this.height
      );
  }
}

var THREE = phina.global['THREE'];

/**
 * @class phina.display.ThreeLayer
 * _extends phina.display.Layer
 */
class ThreeLayer extends Layer {

  // scene: null,
  // camera: null,
  // light: null,
  // renderer: null,

  constructor(options) {
    super(options);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera( 75, options.width / options.height, 1, 10000 );
    this.camera.position.z = 1000;

    this.light = new THREE.DirectionalLight( 0xffffff, 1 );
    this.light.position.set( 1, 1, 1 ).normalize();
    this.scene.add( this.light );

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setClearColor( 0xf0f0f0 );
    this.renderer.setSize( options.width, options.height );

    this.on('enterframe',
    /** @this ThreeLayer */
    function() {
      this.renderer.render( this.scene, this.camera );
    });

    this.domElement = this.renderer.domElement;
  }
}

/**
 * Shapeクラスオプション
 * @typedef {{
 *   padding?: number,
 *   backgroundColor?: import('../graphics/canvas').CanvasStyle,
 *   fill?: import('../graphics/canvas').CanvasStyle | false,
 *   stroke?: import('../graphics/canvas').CanvasStyle | false,
 *   strokeWidth?: number,
 *   lineCap?: CanvasLineCap,
 *   lineJoin?: CanvasLineJoin,
 *   shadow?: string | false,
 *   shadowBlur?: number,
 * } & import('../display/displayelement').DisplayElementOptions } ShapeOptions
 */

/**
 * @class phina.display.Shape
 * _extends phina.display.PlainElement
 */
class Shape extends PlainElement {

  /**
   * @param {ShapeOptions} [options]
   */
  constructor(options) {
    // options = ({}).$safe(options || {}, phina.display.Shape.defaults);
    options = $safe.call({}, options||{}, Shape.defaults);

    super(options);

    this.padding = options.padding;

    this.backgroundColor = options.backgroundColor;
    this.fill = options.fill;
    this.stroke = options.stroke;
    this.strokeWidth = options.strokeWidth;
    this.lineCap = options.lineCap;
    this.lineJoin = options.lineJoin;

    this.shadow = options.shadow;
    this.shadowBlur = options.shadowBlur;

    this.watchDraw = true;
    this._dirtyDraw = true;

    /** @this Shape */
    var checkRender = function() {
      // render
      if (this.watchDraw && this._dirtyDraw === true) {
        this.render(this.canvas);
        this._dirtyDraw = false;
      }
    };

    this.on('enterframe', checkRender);
    this.on('added', checkRender);
  }

  calcCanvasWidth() {
    return this.width + this.padding*2;
  }

  calcCanvasHeight() {
    return this.height + this.padding*2;
  }

  calcCanvasSize () {
    return {
      width: this.calcCanvasWidth(),
      height: this.calcCanvasHeight(),
    };
  }

  isStrokable() {
    return this.stroke && 0 < this.strokeWidth;
  }

  /**
   * @virtual
   * @param  {import('../graphics/canvas').Canvas} _canvas 
   * @returns {any}
   */
  prerender(_canvas) {

  }

  /**
   * @virtual
   * @param  {import('../graphics/canvas').Canvas} _canvas 
   * @returns {any}
   */
  postrender(_canvas) {

  }

  /**
   * @param  {import('../graphics/canvas').Canvas} canvas 
   * @returns {void}
   */
  renderFill(canvas) {
    canvas.fill();
  }

  /**
   * @param {import('../graphics/canvas').Canvas} canvas 
   * @returns {void}
   */
  renderStroke(canvas) {
    canvas.stroke();
  }

  /**
   * @param {import('../graphics/canvas').Canvas} canvas 
   * @returns {this}
   */
  render(canvas) {
    var context = canvas.context;
    // リサイズ
    var size = this.calcCanvasSize();
    canvas.setSize(size.width, size.height);
    // クリアカラー
    canvas.clearColor(this.backgroundColor);
    // 中心に座標を移動
    canvas.transformCenter();

    // 描画前処理
    this.prerender(this.canvas);

    // ストローク描画
    if (this.isStrokable()) {
      context.strokeStyle = /** @type {import('../graphics/canvas').CanvasStyle} */(this.stroke);
      context.lineWidth = this.strokeWidth;
      context.lineCap = this.lineCap;
      context.lineJoin = this.lineJoin;
      context.shadowBlur = 0;
      this.renderStroke(canvas);
    }

    // 塗りつぶし描画
    if (this.fill) {
      context.fillStyle = this.fill;

      // shadow の on/off
      if (this.shadow) {
        context.shadowColor = this.shadow;
        context.shadowBlur = this.shadowBlur;
      }
      else {
        context.shadowBlur = 0;
      }

      this.renderFill(canvas);
    }

    // 描画後処理
    this.postrender(this.canvas);

    return this;
  }

  /**
   * 指定プロパティを監視し、変更があったらダーティフラグを立てて再描画を促す
   * @param {string} key
   * @returns {void}
   */
  static watchRenderProperty(key) {
    // this.prototype.$watch(key, function(newVal, oldVal) {
    $watch.call(this.prototype, key, function(newVal, oldVal) {
      if (newVal !== oldVal) {
        this._dirtyDraw = true;
      }
    });
  }

  /**
   * Shape.watchRenderPropertyをまとめて行う
   * @param {string[]} keys
   * @returns {void}
   */
  static watchRenderProperties(keys) {
    var watchRenderProperty = this.watchRenderProperty || Shape.watchRenderProperty;
    keys.forEach(function(key) {
      watchRenderProperty.call(this, key);
    }, this);
  }

}

/**
 * @type {ShapeOptions}
 * @static
 */
Shape.defaults = {
  width: 64,
  height: 64,
  padding: 8,

  backgroundColor: '#aaa',
  fill: '#00a',
  stroke: '#aaa',
  strokeWidth: 4,
  lineCap: 'round',
  lineJoin: 'round',

  shadow: false,
  shadowBlur: 4,
};

// _defined
Shape.watchRenderProperties([
  'width',
  'height',
  'radius',
  'padding',
  'backgroundColor',
  'fill',
  'stroke',
  'strokeWidth',
  'lineCap',
  'lineJoin',
  'shadow',
  'shadowBlur',
]);


/**
 * @typedef {{
 *   cornerRadius?: number
 * } & ShapeOptions } RectangleShapeOptions
 */

  /**
 * @class phina.display.RectangleShape
 * _extends phina.display.Shape
 * 矩形描画クラス
 */
class RectangleShape extends Shape {

  /**
   * @param {RectangleShapeOptions} [options]
   */
  constructor(options) {
    // options = ({}).$safe(options || {}, phina.display.RectangleShape.defaults);
    options = $safe.call({}, options||{}, RectangleShape.defaults);

    super(options);

    this.cornerRadius = options.cornerRadius;
  }

  /**
   * @param  {import('../graphics/canvas').Canvas} canvas 
   */
  prerender(canvas) {
    canvas.roundRect(-this.width/2, -this.height/2, this.width, this.height, this.cornerRadius);
  }

}

/**
 * @type {RectangleShapeOptions}
 * @static
 */
RectangleShape.defaults = {
  backgroundColor: 'transparent',
  fill: 'blue',
  stroke: '#aaa',
  strokeWidth: 4,
  cornerRadius: 0,
};

// _defined
Shape.watchRenderProperty.call(RectangleShape, 'cornerRadius');


/**
 * @typedef {{
 *   radius?: number
 * } & ShapeOptions } CircleShapeOptions
 */

/**
 * @class phina.display.CircleShape
 * _extends phina.display.Shape
 */
class CircleShape extends Shape {

  /**
   * @param {CircleShapeOptions} [options]
   */
  constructor(options) {
    // options = ({}).$safe(options || {}, phina.display.CircleShape.defaults);
    options = $safe.call({}, options||{}, CircleShape.defaults);

    super(options);

    this.setBoundingType('circle');
  }

  /**
   * @param  {import('../graphics/canvas').Canvas} canvas 
   */
  prerender(canvas) {
    canvas.circle(0, 0, this.radius);
  }

}

/**
 * @type {CircleShapeOptions}
 * @static
 */
CircleShape.defaults = {
  backgroundColor: 'transparent',
  fill: 'red',
  stroke: '#aaa',
  strokeWidth: 4,
  radius: 32,
};


/**
 * @class phina.display.TriangleShape
 * _extends phina.display.Shape
 */
class TriangleShape extends Shape {

  /**
   * @param {CircleShapeOptions} [options]
   */
  constructor(options) {
    // options = ({}).$safe(options || {}, phina.display.TriangleShape.defaults);
    options = $safe.call({}, options||{}, TriangleShape.defaults);

    super(options);

    this.setBoundingType('circle');
  }

  /**
   * @param  {import('../graphics/canvas').Canvas} canvas 
   */
  prerender(canvas) {
    canvas.polygon(0, 0, this.radius, 3);
  }

}

/**
 * @type {CircleShapeOptions}
 * @static
 */
TriangleShape.defaults = {
  backgroundColor: 'transparent',
  fill: 'green',
  stroke: '#aaa',
  strokeWidth: 4,

  radius: 32,
};


/**
 * @typedef {{
 *   sides?: number,
 * } & CircleShapeOptions } PolygonShapeOptions
 */
/**
 * @typedef {{
 *   sideIndent?: number,
 * } & PolygonShapeOptions } StarShapeOptions
 */

/**
 * @class phina.display.StarShape
 * _extends phina.display.Shape
 */
class StarShape extends Shape {

  /**
   * @param {StarShapeOptions} [options] 
   */
  constructor(options) {
    // options = ({}).$safe(options || {}, phina.display.StarShape.defaults);
    options = $safe.call({}, options||{}, StarShape.defaults);

    super(options);

    this.setBoundingType('circle');
    this.sides = options.sides;
    this.sideIndent = options.sideIndent;
  }

  /**
   * @param  {import('../graphics/canvas').Canvas} canvas 
   */
  prerender(canvas) {
    canvas.star(0, 0, this.radius, this.sides, this.sideIndent);
  }

}

/**
 * @type {StarShapeOptions}
 * @static
 */
StarShape.defaults = {
  backgroundColor: 'transparent',
  fill: 'yellow',
  stroke: '#aaa',
  strokeWidth: 4,

  radius: 32,
  sides: 5,
  sideIndent: 0.38,
};

// _defined
Shape.watchRenderProperty.call(StarShape, 'sides');
Shape.watchRenderProperty.call(StarShape, 'sideIndent');


/**
 * @class phina.display.PolygonShape
 * _extends phina.display.Shape
 */
class PolygonShape extends Shape {

  /**
   * @param {PolygonShapeOptions} [options] 
   */
  constructor(options) {
    // options = ({}).$safe(options || {}, phina.display.PolygonShape.defaults);
    options = $safe.call({}, options||{}, PolygonShape.defaults);

    super(options);

    this.setBoundingType('circle');
    this.sides = options.sides;
  }

  /**
   * @param  {import('../graphics/canvas').Canvas} canvas 
   */
  prerender(canvas) {
    canvas.polygon(0, 0, this.radius, this.sides);
  }

}

/**
 * @type {PolygonShapeOptions}
 * @static
 */
PolygonShape.defaults = {
  backgroundColor: 'transparent',
  fill: 'cyan',
  stroke: '#aaa',
  strokeWidth: 4,

  radius: 32,
  sides: 5,
};

// defined
Shape.watchRenderProperty.call(PolygonShape, 'sides');


/**
 * @typedef {{
 *   cornerAngle?: number,
 * } & CircleShapeOptions } HeartShapeOptions
 */

/**
 * @class phina.display.HeartShape
 * _extends phina.display.Shape
 */
class HeartShape extends Shape {

  /**
   * @param {HeartShapeOptions} [options]
   */
  constructor(options) {
    // options = ({}).$safe(options || {}, phina.display.HeartShape.defaults);
    options = $safe.call({}, options||{}, HeartShape.defaults);

    super(options);

    this.setBoundingType('circle');
    this.cornerAngle = options.cornerAngle;
  }

  /**
   * @param  {import('../graphics/canvas').Canvas} canvas 
   */
  prerender(canvas) {
    canvas.heart(0, 0, this.radius, this.cornerAngle);
  }

}

/**
 * @type {HeartShapeOptions}
 * @static
 */
HeartShape.defaults = {
  backgroundColor: 'transparent',
  fill: 'pink',
  stroke: '#aaa',
  strokeWidth: 4,

  radius: 32,
  cornerAngle: 45,
};

// defined
Shape.watchRenderProperty.call(HeartShape, 'cornerAngle');


/**
 * @typedef {{
 *   paths?: Vector2[]
 * } & ShapeOptions } PathShapeOptions
 */

/**
 * @class phina.display.PathShape
 * _extends phina.display.Shape
 */
class PathShape extends Shape {
  // paths: null,

  /**
   * @param {PathShapeOptions} [options]
   */
  constructor(options) {
    // options = ({}).$safe(options || {}, phina.display.PathShape.defaults);
    options = $safe.call({}, options||{}, PathShape.defaults);

    super(options);
    this.paths = options.paths || [];
    this.lineJoin = options.lineJoin;
    this.lineCap = options.lineCap;
  }

  /**
   * @param {Vector2[]} paths
   * @returns {this}
   */
  setPaths (paths) {
    this.paths = paths;
    this._dirtyDraw = true;
    return this;
  }

  /**
   * @returns {this}
   */
  clear () {
    this.paths.length = 0;
    this._dirtyDraw = true;
    return this;
  }

  /**
   * @param {Vector2[]} paths 
   * @returns {this}
   */
  addPaths (paths) {
    [].push.apply(this.paths, paths);
    this._dirtyDraw = true;
    return this;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {this}
   */
  addPath (x, y) {
    this.paths.push(new Vector2(x, y));
    this._dirtyDraw = true;
    return this;
  }

  /**
   * @param {string | number} i
   * @returns {Vector2}
   */
  getPath (i) {
    return this.paths[i];
  }

  /**
   * @returns {Vector2[]} paths 
   */
  getPaths () {
    return this.paths;
  }

  /**
   * @param {string | number} i
   * @param {number} x
   * @param {number} y
   */
  changePath (i, x, y) {
    this.paths[i].set(x, y);
    this._dirtyDraw = true;
    return this;
  }

  /**
   * @returns {{width: number, height: number}}
   */
  calcCanvasSize () {
    var paths = this.paths;
    if (paths.length === 0) {
      return {
        width: this.padding * 2,
        height:this.padding * 2,
      };
    }
    var maxX = -Infinity;
    var maxY = -Infinity;
    var minX = Infinity;
    var minY = Infinity;

    for (var i = 0, len = paths.length; i < len; ++i) {
      var path = paths[i];
      if (maxX < path.x) { maxX = path.x; }
      if (minX > path.x) { minX = path.x; }
      if (maxY < path.y) { maxY = path.y; }
      if (minY > path.y) { minY = path.y; }
    }
    return {
      width: Math.max(Math.abs(maxX), Math.abs(minX)) * 2 + this.padding * 2,
      height: Math.max(Math.abs(maxY), Math.abs(minY)) * 2 + this.padding * 2,
    };
  }

  /**
   * @returns {number}
   */
  calcCanvasWidth () {
    return this.calcCanvasSize().width;
  }

  /**
   * @returns {number}
   */
  calcCanvasHeight () {
    return this.calcCanvasSize().height;
  }

  /**
   * @param  {import('../graphics/canvas').Canvas} canvas 
   */
  prerender (canvas) {
    var paths = this.paths;
    if (paths.length > 1) {
      var c = canvas.context;
      var p = paths[0];
      c.beginPath();
      c.moveTo(p.x, p.y);
      for (var i = 1, len = paths.length; i < len; ++i) {
        p = paths[i];
        c.lineTo(p.x, p.y);
      }
    }
  }

}

/**
 * @type {PathShapeOptions}
 * @static
 */
PathShape.defaults = {
  fill: false,
  backgroundColor: 'transparent',
};

/**
 * @typedef {{
 *   text?: string
 *   fontSize?: number
 *   fontWeight?: string | number
 *   fontFamily?: string
 *   align?: CanvasTextAlign
 *   baseline?: CanvasTextBaseline
 *   lineHeight?: number
 * } & import("./shape").ShapeOptions } LabelOptions
 */

/**
 * @class phina.display.Label
 * _extends phina.display.Shape
 */
class Label extends Shape {

  /**
   * @constructor
   * @param {LabelOptions} [options]
   */
  constructor(options) {
    if (typeof arguments[0] !== 'object') {
      options = { text: arguments[0], };
    }
    else {
      options = arguments[0];
    }

    options = $safe.call({}, options||{}, Label.defaults);
    // options = ({}).$safe(options, phina.display.Label.defaults);

    super(options);

    /** @type {string|number} */
    this._text;

    this.text = options.text;
    this.fontSize = options.fontSize;
    this.fontWeight = options.fontWeight;
    this.fontFamily = options.fontFamily;
    this.align = options.align;
    this.baseline = options.baseline;
    this.lineHeight = options.lineHeight;
  }

  /**
   * @returns {number}
   */
  calcCanvasWidth() {
    var width = 0;
    var canvas = this.canvas;
    canvas.context.font = this.font;
    this._lines.forEach(function(line) {
      var w = canvas.context.measureText(line).width;
      if (width < w) {
        width = w;
      }
    }, this);
    if (this.align !== 'center') width*=2;

    return width + this.padding*2;
  }

  /**
   * @returns {number}
   */
  calcCanvasHeight() {
    var height = this.fontSize * this._lines.length;
    if (this.baseline !== 'middle') height*=2;
    return height*this.lineHeight + this.padding*2;
  }

  /**
   * @param  {import('../graphics/canvas').Canvas} canvas 
   */
  prerender(canvas) {
    var context = canvas.context;
    context.font = this.font;
    context.textAlign = this.align;
    context.textBaseline = this.baseline;

    var lines = this._lines;
    this.lineSize = this.fontSize*this.lineHeight;
    this._offset = -Math.floor(lines.length/2)*this.lineSize;
    this._offset += ((lines.length+1)%2) * (this.lineSize/2);
  }

  /**
   * @param  {import('../graphics/canvas').Canvas} canvas 
   */
  renderFill(canvas) {
    var context = canvas.context;
    this._lines.forEach(function(line, i) {
      context.fillText(line, 0, i*this.lineSize+this._offset);
    }, this);
  }

  /**
   * @param  {import('../graphics/canvas').Canvas} canvas 
   */
  renderStroke(canvas) {
    var context = canvas.context;
    this._lines.forEach(function(line, i) {
      context.strokeText(line, 0, i*this.lineSize+this._offset);
    }, this);
  }

  /**
   * text
   * @returns {string|number}
   */
  get text() { return this._text; }
  set text(v) {
    this._text = v;
    this._lines = (this.text + '').split('\n');
  }

  /**
   * @returns {string}
   */
  get font() {
    return format.call("{fontWeight} {fontSize}px {fontFamily}", this);
    // return "{fontWeight} {fontSize}px {fontFamily}".format(this);
  }

}

/**
 * @type {LabelOptions}
 * @static
 */
Label.defaults = {
  backgroundColor: 'transparent',

  fill: 'black',
  stroke: null,
  strokeWidth: 2,

  // 
  text: 'Hello, world!',
  // 
  fontSize: 32,
  fontWeight: '',
  fontFamily: "'HiraKakuProN-W3'", // Hiragino or Helvetica,
  // 
  align: 'center',
  baseline: 'middle',
  lineHeight: 1.2,
};

// defined
Shape.watchRenderProperty.call(Label, 'text');
Shape.watchRenderProperty.call(Label, 'fontSize');
Shape.watchRenderProperty.call(Label, 'fontWeight');
Shape.watchRenderProperty.call(Label, 'fontFamily');
Shape.watchRenderProperty.call(Label, 'align');
Shape.watchRenderProperty.call(Label, 'baseline');
Shape.watchRenderProperty.call(Label, 'lineHeight');

/**
 * Spriteクラスなど、FrameAnimationのtargetとして適正な型
 * @typedef {{
 *   srcRect: import("../geom/rect").Rect
 *   width: number
 *   height: number
 * } & import("./accessory").AccessoryTarget } FrameAnimationTarget
 */

/**
 * @class phina.accessory.FrameAnimation
 * _extends phina.accessory.Accessory
 * 
 * フレームアニメーション制御を行うAccessory派生クラス
 * 
 * 予めロード（パース）したスプライトシートJSONデータを使い、
 * Spriteクラスのフレーム範囲を制御することでアニメーションを実現する
 * @see https://qiita.com/alkn203/items/a287c7524193f5f4ca90
 * 
 * @example
 * // 予め"player_ss"という名前でスプライトシート画像、Jsonデータをアセット登録しておく
 * // player_ssには"walk"という名前のアニメーションを定義
 * const target = new phina.display.Sprite("player_ss");
 * const frameAnim = new phina.accessory.FrameAnimation("player_ss").attachTo(target);
 * frameAnim.gotoAndPlay("walk");
 */
class FrameAnimation extends Accessory {

  /**
   * @constructor
   * @param {string} ss ロード済みスプライトシートデータAssetキー
   */
  constructor(ss) {
    super();

    /** @type {FrameAnimationTarget} */
    this.target;

    /**
     * スプライトシートオブジェクト
     * 
     * @type {import('../asset/spritesheet').SpriteSheet}
     */
    this.ss = AssetManager.get('spritesheet', ss);

    /**
     * 再生中のアニメーションのデータオブジェクト
     * 
     * @type {import("../asset/spritesheet").SpriteSheetAnimationData | null}
     */
    this.currentAnimation;

    /**
     * 再生中のアニメーション名
     * 
     * @type {(string | number) | null}
     */
    this.currentAnimationName;

    /**
     * 停止状態
     * 
     * @type {boolean}
     */
    this.paused = true;

    /**
     * フレームサイズに合わせて対象の幅・高さを変えるかどうか
     * 
     * @type {boolean}
     */
    this.fit = true;

    /**
     * 現在のアニメーションフレームを表すインデックス値
     * 
     * @type {number}
     * @protected
     */
    this.currentFrameIndex;

    /**
     * アニメーション更新用のアプリフレームのカウント値
     * 
     * @type {number}
     * @protected
     */
    this.frame;

    /**
     * 終了フラグ：trueの時はupdate時にcurrentFrameIndexがリセットされる
     * 
     * @type {boolean}
     * @protected
     */
    this.finished = false;
  }

  /**
   * @param {*} _app Appクラスインスタンス
   */
  update(_app) {
    if (this.paused) return ;
    if (!this.currentAnimation) return ;

    if (this.finished) {
      this.finished = false;
      this.currentFrameIndex = 0;
      return ;
    }

    ++this.frame;
    if (this.frame%this.currentAnimation.frequency === 0) {
      ++this.currentFrameIndex;
      this._updateFrame();
    }
  }

  /**
   * 指定アニメーションを再生
   * 
   * @param {string | number} name アニメーション名
   * @param {boolean} [keep=true] 同名アニメーションがすでに再生中の場合、そのままにするかどうか
   * @returns {this}
   */
  gotoAndPlay(name, keep) {
    keep = (keep !== undefined) ? keep : true;
    if (keep && this.currentAnimation
             && name === this.currentAnimationName
             && this.currentFrameIndex < this.currentAnimation.frames.length
             && !this.paused) {
      return this;
    }
    this.currentAnimationName = name;
    this.frame = 0;
    this.currentFrameIndex = 0;
    this.currentAnimation = this.ss.getAnimation(name);
    this._updateFrame();

    this.paused = false;

    return this;
  }

  /**
   * 指定アニメーション及びその冒頭フレームをセット後、停止状態にする
   * 
   * @param {string} name アニメーション名
   * @returns {this}
   */
  gotoAndStop(name) {
    this.currentAnimationName = name;
    this.frame = 0;
    this.currentFrameIndex = 0;
    this.currentAnimation = this.ss.getAnimation(name);
    this._updateFrame();

    this.paused = true;

    return this;
  }

  /**
   * フレーム更新処理
   * 
   * @protected
   * @returns {void}
   */
  _updateFrame() {
    if (!this.currentAnimation) return;

    var anim = this.currentAnimation;
    if (this.currentFrameIndex >= anim.frames.length) {
      if (anim.next) {
        this.gotoAndPlay(anim.next);
        return ;
      }
      else {
        this.paused = true;
        this.finished = true;
        return ;
      }
    }

    var index = anim.frames[this.currentFrameIndex];
    var frame = this.ss.getFrame(index);
    this.target.srcRect.set(frame.x, frame.y, frame.width, frame.height);

    if (this.fit) {
      this.target.width = frame.width;
      this.target.height = frame.height;
    }
  }

}

/**
 * @typedef {{
 *   x: number
 *   y: number
 *   setInteractive: (flag:boolean) => any
 * } & import("./accessory").AccessoryAttachable } FlickableTarget
 */

/**
 * @class phina.accessory.Flickable
 * Flickable
 * _extends phina.accessory.Accessory
 */
class Flickable extends Accessory {

  /**
   * @constructor
   * @param {FlickableTarget} target
   */
  constructor(target) {
    super(target);

    /** @type {FlickableTarget} */
    this.target;

    /**
     * フリック開始位置
     */
    this.initialPosition = new Vector2(0, 0);

    /**
     * 摩擦値
     * @default 0.9
     */
    this.friction = 0.9;

    /**
     * 速度ベクトル
     */
    this.velocity = new Vector2(0, 0);

    /**
     * 上下の移動を許可するかどうか（初期値：true）
     * @default true
     */
    this.vertical = true;

    /**
     * 左右の移動を許可するかどうか（初期値：true）
     * @default true
     */
    this.horizontal = true;

    /**
     * キャッシュした差分値
     * @protected
     */
    this.cacheList = [];

    var self = this;
    this.on('attached', 
    /** @this {Flickable} */
    function() {
      this.target.setInteractive(true);

      this.target.on('pointstart', function(e) {
        self.initialPosition.set(this.x, this.y);
        self.velocity.set(0, 0);
      });
      this.target.on('pointstay', function(e) {
        if (self.horizontal) {
          this.x += e.pointer.dx;
        }
        if (self.vertical) {
          this.y += e.pointer.dy;
        }

        if (self.cacheList.length > 3) self.cacheList.shift();
        self.cacheList.push(e.pointer.deltaPosition.clone());
      });

      this.target.on('pointend', function(e) {
        // 動きのある delta position を後ろから検索　
        var delta = self.cacheList.reverse().find(function(v) {
          return v.lengthSquared() > 10;
        });
        clear.call(self.cacheList);
        // self.cacheList.clear();

        if (delta) {
          self.velocity.x = delta.x;
          self.velocity.y = delta.y;

          self.flare('flickstart', {
            direction: delta.normalize(),
          });
        }
        else {
          self.flare('flickcancel');
        }

        // self.flare('flick');
        // self.flare('flickend');
      });
    });
  }

  /**
   * 更新関数
   * @param {*} _app Appクラスインスタンス
   */
  update(_app) {
    if (!this.target) return ;

    this.velocity.x *= this.friction;
    this.velocity.y *= this.friction;

    if (this.horizontal) {
      this.target.position.x += this.velocity.x;
    }
    if (this.vertical) {
      this.target.position.y += this.velocity.y;
    }
  }

  /**
   * 位置・速度をフリック前に戻す
   * @returns {void}
   */
  cancel() {
    this.target.x = this.initialPosition.x;
    this.target.y = this.initialPosition.y;
    this.velocity.set(0, 0);

    // TODO: 
    // this.setInteractive(false);
    // this.tweener.clear()
    //     .move(this.initialX, this.initialY, 500, "easeOutElastic")
    //     .call(function () {
    //         this.setInteractive(true);
    //         this.fire(tm.event.Event("backend"));
    //     }.bind(this));
  }

  /**
   * フリック可能にする
   * @returns {void}
   */
  enable() {
    this._enable = true;
  }

}

// TODO: Element側で呼ぶ？
// phina.app.Element.prototype.getter('flickable', function() {
//   if (!this._flickable) {
//     this._flickable = phina.accessory.Flickable().attachTo(this);
//   }
//   return this._flickable;
// });

/**
 * @typedef {{
 *   position: import("../geom/vector2").PrimitiveVector2
 * } & import("./accessory").AccessoryAttachable } PhysicalTarget
 */

/**
 * @class phina.accessory.Physical
 * 本物ではないので名前変えるかも
 * FakePhysical or MarioPhysical or LiePhysical
 * RetroPysical or PysicaLike
 * _extends phina.accessory.Accessory
 */
class Physical extends Accessory  {

  /**
   * @constructor
   * @param {PhysicalTarget} target
   */
  constructor(target) {
    super(target);

    /**
     * かかっている力のベクトル
     */
    this.velocity = new Vector2(0, 0);

    /**
     * 重力ベクトル
     */
    this.gravity = new Vector2(0, 0);

    /**
     * 摩擦値
     * @default 1.0
     */
    this.friction = 1.0;
  }

  /**
   * 更新関数
   * @param {*} _app Appクラスインスタンス
   */
  update(_app) {
    var t = /** @type {PhysicalTarget} */(this.target);

    this.velocity.x *= this.friction;
    this.velocity.y *= this.friction;

    this.velocity.x += this.gravity.x;
    this.velocity.y += this.gravity.y;

    t.position.x += this.velocity.x;
    t.position.y += this.velocity.y;
  }

  /**
   * 力ベクトルをセット
   * @param {number} x
   * @param {number} y
   * @returns {this}
   */
  force(x, y) {
    this.velocity.set(x, y);
    return this;
  }

  /**
   * 力ベクトルに値を加算
   * @param {number} x
   * @param {number} y
   * @returns {this}
   */
  addForce(x, y) {
    this.velocity.x += x;
    this.velocity.y += y;
    return this;
  }

  /**
   * 重力ベクトルをセット
   * @param {number} x
   * @param {number} y
   * @returns {this}
   */
  setGravity(x, y) {
    this.gravity.set(x, y);
    return this;
  }

  /**
   * 摩擦値をセット
   * @param {number} fr
   * @returns {this}
   */
  setFriction(fr) {
    this.friction = fr;
    return this;
  }
}

// phina.app.Element.prototype.getter('physical', function() {
//   if (!this._physical) {
//     this._physical = phina.accessory.Physical().attachTo(this);
//   }
//   return this._physical;
// });

/** @typedef {string | import("./file").FileAssetLoadParam | any} AssetSrc 基本的には文字列だがAsset種類によって変わる */

/**
 * @class phina.asset.Asset
 * _extends phina.util.EventDispatcher
 */
class Asset extends EventDispatcher {

  // serverError: false,
  // notFound: false,
  // loadError: false,

  /**
   * @constructor
   */
  constructor() {
    super();

    this.loaded = false;
    this.serverError = false;
    this.notFound = false;
    this.loadError = false;

    /** @type {AssetSrc} */
    this.src = undefined;
  }

  /**
   * @param {AssetSrc} src
   * @returns {Flow}
   */
  load(src) {
    this.src = src;
    return new Flow(this._load.bind(this));
  }

  /**
   * ロード済みかどうか
   * @returns {boolean}
   */
  isLoaded() {
    return this.loaded;
  }

  /**
   * アセット種類に応じてサブクラスでオーバーライド
   * @protected
   * @param {(...args: any) => any} resolve
   */
  _load(resolve) {
    var self = this;
    setTimeout(function() {
      self.loaded = true;
      resolve();
    }, 100);
  }

  /**
   * @virtual
   * ロード失敗時にダミーをセットする
   */
  loadDummy() { }

}

var getFirst = function(array) { return first.get.call(array); };
var getLast = function(array) { return last.get.call(array); };

/**
 * @class phina.asset.Texture
 * _extends phina.asset.Asset
 */
class Texture extends Asset {

  /**
   * @constructor
   */
  constructor() {
    super();

    /** @type {HTMLImageElement|HTMLCanvasElement} */
    this.domElement = new Image();
    
    /** @type {string} */
    this.src;
  }

  /**
   * @protected
   * @override
   * @param {(...args: any) => any} resolve
   */
  _load(resolve) {
    this.domElement = new Image();

    var isLocal = (location.protocol == 'file:');
    if ( !isLocal && !(/^data:/.test(this.src)) ) ;

    var self = this;
    this.domElement.onload = function(e) {
      self.loaded = true;
      resolve(self);
    };
    /** @param {Event} e */
    this.domElement.onerror = function(e) {
      console.error(format.call("[phina.js] not found `{0}`!", this.src));
      // console.error("[phina.js] not found `{0}`!".format(this.src));

      // var key = self.src.split('/').last.replace('.png', '').split('?').first.split('#').first;
      var key = getFirst(
        getFirst(
          getLast(
            self.src.split('/')
          ).replace('.png', '').split('?')
        ).split('#')
      );

      // 型アサーション
      var target = /** @type {HTMLImageElement} */ (e.target);
      target.onerror = null;
      target.src = "http://dummyimage.com/128x128/444444/eeeeee&text=" + key;
    };

    this.domElement.src = this.src;
  }

  /**
   * 新たにTextureをクローン生成して返す
   * @returns {Texture}
   */
  clone() {
    var image = this.domElement;
    var canvas = new Canvas().setSize(image.width, image.height);
    var t = new Texture();
    canvas.context.drawImage(image, 0, 0);
    t.domElement = canvas.domElement;
    return t;
  }

  /**
   * @param {{ r: number; g: number; b: number; }} [color]
   * @returns {void}
   */
  transmit(color) {
    // imagaオブジェクトをゲット
    var image = this.domElement;
    // 新規canvas作成
    var canvas = new Canvas().setSize(image.width, image.height);
    // 新規canvasに描画
    canvas.context.drawImage(image, 0, 0);
    // canvas全体のイメージデータ配列をゲット
    var imageData = canvas.context.getImageData(0, 0, canvas.width, canvas.height);
    var data = imageData.data;
    // 透過色の指定がなければ左上のrgb値を抽出
    var r = (color !== undefined) ? color.r : data[0];
    var g = (color !== undefined) ? color.g : data[1];
    var b = (color !== undefined) ? color.b : data[2];
    // 配列を4要素目から4つ飛び（アルファ値）でループ
    // (3).step(data.length, 4, function(i) {
    step.call(3, data.length, 4, function(i) {
      // rgb値を逆算でゲットし、左上のrgbと比較
      if (data[i - 3] === r && data[i - 2] === g && data[i - 1] === b) {
        // 一致した場合はアルファ値を書き換える
        data[i] = 0;
      }
    });
    // 書き換えたイメージデータをcanvasに戻す
    canvas.context.putImageData(imageData, 0, 0);

    this.domElement = canvas.domElement;
  }

  /**
   * @typedef {(pixel: Uint8ClampedArray, index: number, x: number, y: number, imageData: ImageData )=> void} FilterFunc
   * @param {FilterFunc | FilterFunc[]} filters
   * @returns {this}
   */
  filter(filters) {
    if (!filters) {
      return this;
    }
    if (!Array.isArray(filters)) {
      filters = [filters];
    }
    var image = this.domElement;
    var w = image.width;
    var h = image.height;
    var canvas = new Canvas().setSize(w, h);

    /** @type {ImageData} */
    var imageData = null;

    canvas.context.drawImage(image, 0, 0);
    imageData = canvas.context.getImageData(0, 0, w, h);
    filters.forEach( function (fn) {
      if (typeof fn == 'function') {
        // h.times( function (y) {
        times.call(h, function (y) {
          // w.times( function (x) {
          times.call(w, function (x) {
            var i = (y * w + x) * 4;
            var pixel = imageData.data.slice(i, i + 4);
            fn(pixel, i, x, y, imageData);
          });
        });
      }
    });
    canvas.context.putImageData(imageData, 0, 0);
    this.domElement = canvas.domElement;
    return this;
  }

}

/**
 * @class phina.asset.Sound
 * _extends phina.asset.Asset
 */
class Sound extends Asset {

  /**
   * @constructor
   */
  constructor() {
    super();
    this._loop = false;
    this._loopStart = 0;
    this._loopEnd = 0;
    this._playbackRate = 1;
    this.context = Sound.getAudioContext();
    this.gainNode = this.context.createGain();

    /** @type {(AudioBufferSourceNode | OscillatorNode)?} */
    this.source;

    /** @type {string} */
    this.src;
  }

  /**
   * 音源を再生
   * 音源終了時に"ended"イベントを発生
   * 
   * @param {number} [when=0] 指定の秒数、再生を遅らせる
   * @param {number} [offset=0] 音源のどの時間位置で再生するかを秒数指定
   * @param {number} [duration] 再生時間を秒数指定
   * @returns {this}
   */
  play(when, offset, duration) {
    when = when ? when + this.context.currentTime : 0;
    offset = offset || 0;

    if (this.source) ;

    var source = this.source = this.context.createBufferSource();
    var buffer = source.buffer = this.buffer;
    source.loop = this._loop;
    source.loopStart = this._loopStart;
    source.loopEnd = this._loopEnd;
    source.playbackRate.value = this._playbackRate;

    // connect
    source.connect(this.gainNode);
    this.gainNode.connect(Sound.getMasterGain());

    // play
    if (duration !== undefined) {
      source.start(when, offset, duration);
    }
    else {
      source.start(when, offset);
    }

    // check play end
    source.addEventListener('ended', function(){
      this.flare('ended');
    }.bind(this));

    return this;
  }

  /**
   * 再生を停止（再生中でなかった時は何もしない）  
   * 再生中だった場合、同時に"stop", "ended"イベントを発火する
   * 
   * @returns {this}
   */
  stop() {
    if (this.source) {
      // stop すると source.endedも発火する
      this.source.stop && this.source.stop(0);
      this.source = null;
      this.flare('stop');
    }

    return this;
  }

  /**
   * 再生を一時停止
   * 同時に"pause"イベントを発火する
   * 
   * @returns {this}
   */
  pause() {
    /** @type {AudioBufferSourceNode} */
    (this.source).playbackRate.value = 0;
    this.flare('pause');
    return this;
  }

  /**
   * 再生を再開
   * 同時に"resume"イベントを発火する
   * 
   * @returns {this}
   */
  resume() {
    /** @type {AudioBufferSourceNode} */
    (this.source).playbackRate.value = this._playbackRate;
    this.flare('resume');
    return this;
  }

  /**
   * @private
   * 未実装
   * 
   * @param {*} type 
   */
  _oscillator(type) {
    var context = this.context;

    var oscillator = context.createOscillator();

    // Sine wave is type = “sine”
    // Square wave is type = “square”
    // Sawtooth wave is type = “saw”
    // Triangle wave is type = “triangle”
    // Custom wave is type = “custom” 
    oscillator.type = type || 'sine';

    this.source = oscillator;
    // connect
    this.source.connect(context.destination);
  }

  /**
   * AudioBufferからロード
   * 
   * @param {AudioBuffer} [buffer] 
   */
  loadFromBuffer(buffer) {
    var context = this.context;

    // set default buffer
    if (!buffer) {
      buffer = context.createBuffer( 1, 44100, 44100 );
      var channel = buffer.getChannelData(0);

      for( var i=0; i < channel.length; i++ )
      {
        channel[i] = Math.sin( i / 100 * Math.PI);
      }
    }

    // source
    this.buffer = buffer;
  }

  /**
   * ループ設定
   * 
   * @param {boolean} loop
   * @returns {this}
   */
  setLoop(loop) {
    this.loop = loop;
    return this;
  }

  /**
   * ループ開始位置を秒数で設定
   * 
   * @param {number} loopStart
   * @returns {this}
   */
  setLoopStart(loopStart) {
    this.loopStart = loopStart;
    return this;
  }

  /**
   * ループ終了位置を秒数で設定
   * 
   * @param {number} loopEnd
   * @returns {this}
   */
  setLoopEnd(loopEnd) {
    this.loopEnd = loopEnd;
    return this;
  }
  
  /**
   * 再生速度を設定
   * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/playbackRate
   * 
   * @param {number} playbackRate
   * @returns {this}
   */
  setPlaybackRate(playbackRate) {
    this.playbackRate = playbackRate;
    return this;
  }

  /**
   * @override
   * @param {(...args: any) => any} r
   */
  _load(r) {
    if (/^data:/.test(this.src)) {
      this._loadFromURIScheme(r);
    }
    else {
      this._loadFromFile(r);
    }
  }

  /**
   * @private
   * @param {(...args: any) => any} r
   */
  _loadFromFile(r) {
    var self = this;

    var xml = new XMLHttpRequest();
    xml.open('GET', this.src);
    xml.onreadystatechange = function() {
      if (xml.readyState === 4) {
        if ([200, 201, 0].indexOf(xml.status) !== -1) {

          // 音楽バイナリーデータ
          var data = xml.response;

          // webaudio 用に変換
          self.context.decodeAudioData(data, function(buffer) {
            self.loadFromBuffer(buffer);
            r(self);
          }, function() {
            console.warn("音声ファイルのデコードに失敗しました。(" + self.src + ")");
            r(self);
            self.flare('decodeerror');
          });

        } else if (xml.status === 404) {
          // not found

          self.loadError = true;
          self.notFound= true;
          r(self);
          self.flare('loaderror');
          self.flare('notfound');

        } else {
          // サーバーエラー

          self.loadError = true;
          self.serverError = true;
          r(self);
          self.flare('loaderror');
          self.flare('servererror');
        }
      }
    };

    xml.responseType = 'arraybuffer';

    xml.send(null);
  }

  /**
   * @private
   * @param {(...args: any) => any} r
   */
  _loadFromURIScheme(r) {
    var byteString = '';
    if (this.src.split(',')[0].indexOf('base64') >= 0) {
      byteString = atob(this.src.split(',')[1]);
    }
    else {
      byteString = unescape(this.src.split(',')[1]);
    }

    var self = this;
    var len = byteString.length;
    var buffer = new Uint8Array(len);

    for (var i=0; i<len; ++i) {
      buffer[i] = byteString.charCodeAt(i);
    }

    // webaudio 用に変換
    this.context.decodeAudioData(buffer.buffer, function(buffer) {
      self.loadFromBuffer(buffer);
      r(self);
    }, function() {
      console.warn("音声ファイルのデコードに失敗しました。(" + self.src + ")");
      self.loaded = true;
      r(self);
    });
  }

  /**
   * @override
   * ダミーバッファをロード
   */
  loadDummy() {
    this.loadFromBuffer();
  }

  /**
   * 音量
   */
  get volume()  { return this.gainNode.gain.value; }
  set volume(v) { this.gainNode.gain.value = v; }

  /**
   * ループ設定
   */
  get loop()  { return this._loop; }
  set loop(v) {
    this._loop = v;
  }

  /**
   * ループ開始時間位置(second)
   */
  get loopStart()  { return this._loopStart; }
  set loopStart(v) {
    this._loopStart = v;
  }

  /**
   * ループ終了時間位置(second)
   */
  get loopEnd()  { return this._loopEnd; }
  set loopEnd(v) {
    this._loopEnd = v;
  }

  /**
   * 再生速度
   */
  get playbackRate() { return this._playbackRate; }
  set playbackRate(v) {
    this._playbackRate = v;
    this.source = /** @type {AudioBufferSourceNode} */(this.source);
    if (this.source && this.source.playbackRate.value !== 0) {
      this.source.playbackRate.value = v;
    }
  }

  /**
   * マスターのゲインノードを返します。  
   * GainNodeが未生成の場合は生成して返します。
   * @returns {GainNode}
   */
  static getMasterGain() {
    if(!this._masterGain) {
      var context = this.getAudioContext();
      this._masterGain = context.createGain();
      this._masterGain.connect(context.destination);
    }
    return this._masterGain;
  }

  /**
   * WebAudioのコンテキストを生成して返します。  
   * すでに生成済みの場合はそれを返します。  
   * WebAudio未サポートの場合はnullを返します。
   * @returns {AudioContext | null}
   */
  static getAudioContext() {
    if (!Support.webAudio) return null;

    if (this.context) return this.context;

    var g = phina.global;
    var context = null;

    if (g.AudioContext) {
      context = new AudioContext();
    }
    else if (g['webkitAudioContext']) {
      context = new g['webkitAudioContext']();
    }
    else if (g['mozAudioContext']) {
      context = new g['mozAudioContext']();
    }

    this.context = context;

    return context;
  }

  /**
   * マスター音量を取得
   */
  static get volume() {
    return this.getMasterGain().gain.value;
  }

  /**
   * マスター音量をセット
   * @param {number} v
   */
  static set volume(v) {
    this.getMasterGain().gain.value = v;
  }
}

/**
 * @class phina.asset.Script
 * _extends phina.asset.Asset
 */
class Script extends Asset {

  /**
   * @constructor
   */
  constructor() {
    super();
    
    /** @type {string} */
    this.src;
  }

  _load(resolve) {
    var self = this;
    this.domElement = document.createElement('script');
    this.domElement.src = this.src;

    this.domElement.onload = function() {
      resolve(self);
    }.bind(this);

    document.body.appendChild(this.domElement);
  }

}

/**
 * @typedef {Object} SpriteSheetFrameData
 * @property {number} x フレーム左上x座標
 * @property {number} y フレーム左上y座標
 * @property {number} width フレーム横幅
 * @property {number} height フレーム縦幅
 */

 /**
 * 各アニメーションの詳細
 * @typedef {Object} SpriteSheetAnimationData
 * @property {number[]} frames フレーム番号順の数列 ex) [0, 1, 2]
 * @property {string | number} next 現アニメーション終了時に移行したいアニメーション名、ループさせたい場合は同じアニメーションを指定
 * @property {number} frequency フレーム更新頻度（間隔）
 */

/**
 * SpriteSheetAnimationDataの配列版
 * @typedef {[
 *   number, // 開始フレームindex
 *   number, // 終了フレームindex
 *   string | number, // next
 *   number  // frequency
 * ]} SpriteSheetAnimationDataArray
 */

/**
 * アニメーションテーブル
 * @typedef {{
 *   [key in (string | number)]: SpriteSheetAnimationData
 * }} SpriteSheetAnimationTable
 */

/**
 * @typedef {Object} SpriteSheetFrameSetupParam
 * @property {number} width １フレームの横幅
 * @property {number} height １フレームの縦幅
 * @property {number} rows 横のフレーム数
 * @property {number} cols 縦のフレーム数
 */

/**
 * SpriteSheetクラスセットアップ用のデータオブジェクト
 * @typedef {Object} SpriteSheetSetupParam
 * @property {SpriteSheetFrameSetupParam} frame フレームのサイズ・分割数データ
 * @property {{
 *   [key in (string | number)]: SpriteSheetAnimationData | SpriteSheetAnimationDataArray
 * }} animations
 */

/**
 * @class phina.asset.SpriteSheet
 * _extends phina.asset.Asset
 */
class SpriteSheet extends Asset {

  /**
   * @constructor
   */
  constructor() {
    super();

    /**
     * jsonファイルへのパス文字列、もしくはjsonデータオブジェクトそのもの
     * @type {string | SpriteSheetSetupParam}
     */
    this.src;

    /**
     * 総フレーム数
     * @type {number}
     */
    this.frame;

    /** @type {SpriteSheetFrameData[]} */
    this.frames;

    /** @type {SpriteSheetAnimationTable} */
    this.animations;
  }

  /**
   * @param {SpriteSheetSetupParam} params
   * @returns {this}
   */
  setup(params) {
    this._setupFrame(params.frame);
    this._setupAnim(params.animations);
    return this;
  }

  /**
   * @override
   * @param {(arg0: this) => void} resolve
   * @returns {void}
   */
  _load(resolve) {

    var self = this;

    if (typeof this.src === 'string') {
      var xml = new XMLHttpRequest();
      xml.open('GET', this.src);
      xml.onreadystatechange = function() {
        if (xml.readyState === 4) {
          if ([200, 201, 0].indexOf(xml.status) !== -1) {
            var data = xml.responseText;
            var json = JSON.parse(data);

            self.setup(json);

            resolve(self);
          }
        }
      };

      xml.send(null);
    }
    else {
      this.setup(this.src);
      resolve(self);
    }

  }

  /**
   * @private
   * @param {SpriteSheetFrameSetupParam} frame
   */
  _setupFrame(frame) {
    /** @type {SpriteSheetFrameData[]} */
    var frames = this.frames = [];
    var unitWidth = frame.width;
    var unitHeight = frame.height;

    var count = frame.rows * frame.cols;
    this.frame = count;

    times.call(count, function(i) {
    // (count).times(function(i) {
      var xIndex = i%frame.cols;
      var yIndex = (i/frame.cols)|0;

      frames.push({
        x: xIndex*unitWidth,
        y: yIndex*unitHeight,
        width: unitWidth,
        height: unitHeight,
      });
    });
  }

  /**
   * @private
   * @param {SpriteSheetSetupParam["animations"]} animations
   */
  _setupAnim(animations) {
    this.animations = {};

    // デフォルトアニメーション
    this.animations["default"] = {
        frames: range.call([], 0, this.frame),
        // frames: [].range(0, this.frame),
        next: "default",
        frequency: 1,
    };

    // animations.forIn(
    forIn.call(animations, 
    /**
     * @this {SpriteSheet}
     * @param {string | number} key
     * @param {SpriteSheetAnimationData | SpriteSheetAnimationDataArray} value
     */
    function(key, value) {
      var anim = value;

      if (anim instanceof Array) {
        this.animations[key] = {
          frames: range.call([], anim[0], anim[1]),
          // frames: [].range(anim[0], anim[1]),
          next: anim[2],
          frequency: anim[3] || 1,
        };
      }
      else {
        this.animations[key] = {
          frames: anim.frames,
          next: anim.next,
          frequency: anim.frequency || 1
        };
      }

    }, this);
  }

  /**
   * フレームを取得
   * @param {number} index
   * @returns {SpriteSheetFrameData}
   */
  getFrame(index) {
    return this.frames[index];
  }

  /**
   * @param {string | number} [name="default"]
   * @returns {SpriteSheetAnimationData}
   */
  getAnimation(name) {
    name = (name !== undefined) ? name : "default";
    return this.animations[name];
  }

}

/** @typedef {string|number|null} FontName 基本はstring型 */

/**
 * @class phina.asset.Font
 * _extends phina.asset.Asset
 */
class Font extends Asset {

  /**
   * @constructor
   */
  constructor() {
    super();

    /** @type {FontName} */
    this.fontName = null;
  }

  /**
   * @param {string} path
   * @returns {Flow}
   */
  load(path) {
    this.src = path;

    var reg = /(.*)(?:\.([^.]+$))/;
    var key = this.fontName || last.get.call(path.match(reg)[1].split('/'));    //フォント名指定が無い場合はpathの拡張子前を使用
    // var key = this.fontName || path.match(reg)[1].split('/').last;    //フォント名指定が無い場合はpathの拡張子前を使用
    var type = path.match(reg)[2];
    var format$1 = "unknown";
    switch (type) {
      case "ttf":
        format$1 = "truetype"; break;
      case "otf":
        format$1 = "opentype"; break;
      case "woff":
        format$1 = "woff"; break;
      case "woff2":
        format$1 = "woff2"; break;
      default:
        console.warn("サポートしていないフォント形式です。(" + path + ")");
    }
    this.format = format$1;
    this.fontName = key;

    if (format$1 !== "unknown") {
      var text = format.call("@font-face { font-family: '{0}'; src: url({1}) format('{2}'); }", key, path, format$1);
      // var text = "@font-face { font-family: '{0}'; src: url({1}) format('{2}'); }".format(key, path, format);
      var e = document.querySelector("head");
      var fontFaceStyleElement = document.createElement("style");
      if (fontFaceStyleElement.innerText) {
        fontFaceStyleElement.innerText = text;
      } else {
        fontFaceStyleElement.textContent = text;
      }
      e.appendChild(fontFaceStyleElement);
    }

    return new Flow(this._load.bind(this));
  }

  /**
   * @param {(arg0: Font) => void} resolve
   */
  _load(resolve) {
    if (this.format !== "unknown") {
      this._checkLoaded(this.fontName, 
      /** @this {Font} */
      function() {
        this.loaded = true;
        resolve(this);
      }.bind(this));
    } else {
      this.loaded = true;
      resolve(this);
    }
  }

  /**
   * @param {FontName} font
   * @param {() => any} [callback]
   */
  _checkLoaded (font, callback) {
    var canvas = new Canvas();
    var DEFAULT_FONT = canvas.context.font.split(' ')[1];
    canvas.context.font = '40px ' + DEFAULT_FONT;

    var checkText = "1234567890-^\\qwertyuiop@[asdfghjkl;:]zxcvbnm,./\!\"#$%&'()=~|QWERTYUIOP`{ASDFGHJKL+*}ZXCVBNM<>?_１２３４５６７８９０－＾￥ｑｗｅｒｔｙｕｉｏｐａｓｄｆｇｈｊｋｌｚｘｃｖｂｎｍ，．あいうかさたなをん時は金なり";
    // 特殊文字対応
    checkText += String.fromCharCode(0xf04b);

    var before = canvas.context.measureText(checkText).width;
    canvas.context.font = '40px ' + font + ', ' + DEFAULT_FONT;

    var timeoutCount = 30;
    var checkLoadFont = function () {
      var after = canvas.context.measureText(checkText).width;
      if (after !== before) {
        setTimeout(function() {
          callback && callback();
        }, 100);
      } else {
        if (--timeoutCount > 0) {
          setTimeout(checkLoadFont, 100);
        }
        else {
          callback && callback();
          console.warn("timeout font loading");
        }
      }
    };
    checkLoadFont();
  }

  /**
   * @param {FontName} name
   * @returns {this}
   */
  setFontName(name) {
    if (this.loaded) {
      console.warn("フォント名はLoad前にのみ設定が出来ます(" + name + ")");
      return this;
    }
    this.fontName = name;
    
    return this;
  }

  /**
   * @returns {FontName}
   */
  getFontName() {
    return this.fontName;
  }

}

/**
 * @typedef {{
 *   path: string,
 *   dataType: "xml"| "json",
 * }} FileAssetLoadParam
 */

/**
 * @class phina.asset.File
 * _extends phina.asset.Asset
 */
class File extends Asset {

  /**
   * @constructor
   */
  constructor() {
    super();
    this.data = undefined;
    this.dataType = undefined;
  }

  _load(resolve) {

    var params = {};

    if (typeof this.src === 'string') {
      $extend.call(params, {
      // params.$extend({
        path: this.src,
      });
    }
    else if (typeof this.src === 'object') {
      $extend.call(params, this.src);
      // params.$extend(this.src);
    }

    $safe.call(params, {
    // params.$safe({
      path: '',
      dataType: 'text',
    });

    // load
    var self = this;
    var xml = new XMLHttpRequest();
    xml.open('GET', params.path);
    xml.onreadystatechange = function() {
      if (xml.readyState === 4) {
        if ([200, 201, 0].indexOf(xml.status) !== -1) {
          /** @type {string|Document} */
          var data = xml.responseText;

          if (params.dataType === 'json') {
            data = JSON.parse(data);
          } else if (params.dataType === 'xml') {
            data = (new DOMParser()).parseFromString(data, "text/xml");
          }
          self.dataType = params.dataType;

          self.data = data;
          resolve(self);
        }
      }
    };

    xml.send(null);
    // this.domElement = new Image();
    // this.domElement.src = this.src;

    // var self = this;
    // this.domElement.onload = function() {
    //   self.loaded = true;
    //   resolve(self);
    // };
  }

}

/**
 * assetKeyのvalueは通常はstring（パス文字列）
 * ただしパース済みjsonなどの特殊な形式も受け付けるため、any型としている
 * @typedef {{
 *   [assetType: string]: {
 *     [assetKey: string]: any
 *   }
 * }} AssetLoaderLoadParam
 */

/**
 * @class phina.asset.AssetLoader
 * _extends phina.util.EventDispatcher
 */
class AssetLoader extends EventDispatcher {

  /**
   * @constructor
   * @param {{ cache: boolean }} [params]
   */
  constructor(params) {
    super();

    // params = (params || {}).$safe({
    //   cache: true,
    // });
    params = $safe.call(params||{}, { cache: true });

    this.assets = {};
    this.cache = params.cache;
  }

  /**
   * @param {AssetLoaderLoadParam} params
   * @returns {Flow}
   */
  load(params) {
    var self = this;
    var flows = [];

    var counter = 0;
    var length = 0;
    forIn.call(params, function(_type, assets) {
    // params.forIn(function(type, assets) {
      length += Object.keys(assets).length;
    });
    
    forIn.call(params, function(type, assets) {
    // params.forIn(function(type, assets) {
      forIn.call(assets, function(key, value) {
      // assets.forIn(function(key, value) {
        var func = AssetLoader.assetLoadFunctions[type];
        var flow = func(key, value);
        flow.then(function(asset) {
          if (self.cache) {
            AssetManager.set(type, key, asset);
          }
          self.flare('progress', {
            key: key,
            asset: asset,
            progress: (++counter/length),
          });
        });
        flows.push(flow);
      });
    });


    if (self.cache) {

      self.on('progress', function(e) {
        if (e.progress >= 1.0) {
          // load失敗時、対策

          forIn.call(params, function(type, assets) {
          // params.forIn(function(type, assets) {
            forIn.call(assets, function(key, value) {
            // assets.forIn(function(key, value) {
              var asset = AssetManager.get(type, key);
              if (asset.loadError) {
                var dummy = AssetManager.get(type, 'dummy');
                if (dummy) {
                  if (dummy.loadError) {
                    dummy.loadDummy();
                    dummy.loadError = false;
                  }
                  AssetManager.set(type, key, dummy);
                } else {
                  asset.loadDummy();
                }
              }
            });
          });
        }
      });
    }
    return Flow.all(flows).then(function(args) {
      self.flare('load');
    });
  }

  /**
   * アセット種類に応じたロード関数を登録
   * @param {string | number} key アセットタイプ名
   * @param {(...args: any)=> Flow} func Flowインスタンスを返す関数
   */
  static register(key, func) {
    this.assetLoadFunctions[key] = func;
    return this;
  }

}

/**
 * 登録済みアセットロード関数
 */
AssetLoader.assetLoadFunctions = {
  image: function(key, path) {
    var texture = new Texture();
    var flow = texture.load(path);
    return flow;
  },
  sound: function(key, path) {
    var sound = new Sound();
    var flow = sound.load(path);
    return flow;
  },
  spritesheet: function(key, path) {
    var ss = new SpriteSheet();
    var flow = ss.load(path);
    return flow;
  },
  script: function(key, path) {
    var script = new Script();
    return script.load(path);
  },
  font: function(key, path) {
    var font = new Font();
    font.setFontName(key);
    return font.load(path);
  },
  json: function(key, path) {
    var text = new File();
    return text.load({
      path: path,
      dataType: "json",
    });
  },
  xml: function(key, path) {
    var text = new File();
    return text.load({
      path: path,
      dataType: "xml",
    });
  },
  text: function(key, path) {
    var text = new File();
    return text.load(path);
  }
};

/**
 * @class phina.asset.SoundManager
 * 全てのクラスメンバーがstaticな静的クラス
 * サウンドの再生は基本これを使う
 * 
 * ### Ref
 * - http://evolve.reintroducing.com/_source/classes/as3/SoundManager/SoundManager.html
 * - https://github.com/nicklockwood/SoundManager
 */
class SoundManager {
  // volume: 0.8,
  // musicVolume: 0.8,
  // muteFlag: false,
  // currentMusic: null,

  /**
   * @private インスタンス化しない
   */
  constructor() {}

  /**
   * 音源を再生
   * 
   * @param {string} name 音源キー名
   * @param {number} [when=0] 指定の秒数、再生を遅らせる
   * @param {number} [offset=0] 音源のどの時間位置で再生するかを秒数指定
   * @param {number} [duration] 再生時間を秒数指定
   * @returns {import('../asset/sound').Sound}
   */
  static play(name, when, offset, duration) {
    /** @type {import('../asset/sound').Sound} */
    var sound = AssetManager.get('sound', name);

    sound.volume = this.getVolume();
    sound.play(when, offset, duration);

    return sound;
  }

  /**
   * @private 未実装のため
   */
  static stop() {
    // TODO: 
  }

  /**
   * @private 未実装のため
   */
  static pause() {
    // TODO: 
  }

  /**
   * @private 未実装のため
   */
  static fade() {
    // TODO: 
  }

  /**
   * 通常サウンド音量をセット
   * 
   * @param {number} volume
   * @returns {void}
   */
  static setVolume(volume) {
    this.volume = volume;
  }

  /**
   * 通常サウンド音量を取得
   * 
   * @returns {number}
   */
  static getVolume() {
    return this.volume;
  }

  /**
   * ミュート
   * 
   * @returns {SoundManager}
   */
  static mute() {
    this.muteFlag = true;
    if (this.currentMusic) {
      this.currentMusic.volume = 0;
    }
    return this;
  }

  /**
   * ミュート解除
   * 
   * @returns {SoundManager}
   */
  static unmute() {
    this.muteFlag = false;
    if (this.currentMusic) {
      this.currentMusic.volume = this.getVolumeMusic();
    }
    return this;
  }

  /**
   * ミュート状態かどうか
   * 
   * @returns {boolean}
   */
  static isMute() {
    return this.muteFlag;
  }

  /**
   * 音楽系の音源を再生：ループの有無などを細かく調整可能
   * 
   * @param {string} name 音源キー名
   * @param {number} [fadeTime] 指定時間をかけて音量フェードイン。単位はミリ秒
   * @param {boolean} [loop] ループするかどうか。Default: true
   * @param {number} [when=0] 指定の秒数、再生を遅らせる
   * @param {number} [offset=0] 音源のどの時間位置で再生するかを秒数指定
   * @param {number} [duration] 再生時間を秒数指定
   * @returns {import('../asset/sound').Sound} 再生したSoundクラス
   */
  static playMusic(name, fadeTime, loop, when, offset, duration) {
    loop = (loop !== undefined) ? loop : true;

    if (this.currentMusic) {
      this.stopMusic(fadeTime);
    }

    /** @type {import('../asset/sound').Sound} */
    var music = AssetManager.get('sound', name);

    music.setLoop(loop);
    music.play(when, offset, duration);

    if (fadeTime > 0) {
      var count = 32;
      var counter = 0;
      var unitTime = fadeTime/count;
      var volume = this.getVolumeMusic();

      music.volume = 0;
      var id = setInterval(function() {
        counter += 1;
        var rate = counter/count;
        music.volume = rate*volume;

        if (rate >= 1) {
          clearInterval(id);
          return false;
        }

        return true;
      }, unitTime);
    }
    else {
      music.volume = this.getVolumeMusic();
    }

    this.currentMusic = music;

    return this.currentMusic;
  }

  /**
   * 音楽を停止
   * 
   * @param {number} [fadeTime] 指定時間をかけて音量フェードアウト。単位はミリ秒
   * @returns {void}
   */
  static stopMusic(fadeTime) {
    if (!this.currentMusic) { return ; }

    var music = this.currentMusic;
    this.currentMusic = null;

    if (fadeTime > 0) {
      var count = 32;
      var counter = 0;
      var unitTime = fadeTime/count;
      var volume = this.getVolumeMusic();

      music.volume = 0;
      var id = setInterval(function() {
        counter += 1;
        var rate = counter/count;
        music.volume = volume*(1-rate);

        if (rate >= 1) {
          music.stop();
          clearInterval(id);
          return false;
        }

        return true;
      }, unitTime);
    }
    else {
      music.stop();
    }
  }

  /**
   * 音楽を一時停止
   * 
   * @returns {void}
   */
  static pauseMusic() {
    if (!this.currentMusic) { return ; }
    this.currentMusic.pause();
  }

  /**
   * 音楽を再開
   * 
   * @returns {void}
   */
  static resumeMusic() {
    if (!this.currentMusic) { return ; }
    this.currentMusic.resume();
  }

  /**
   * 音楽の音量を設定
   * 
   * @param {number} volume
   * @returns {SoundManager}
   */
  static setVolumeMusic(volume) {
    this.musicVolume = volume;
    if (this.currentMusic) {
      this.currentMusic.volume = volume;
    }

    return this;
  }

  /**
   * 音楽の音量を取得
   * 
   * @returns {number}
   */
  static getVolumeMusic() {
    return this.musicVolume;
  }

}

/**
 * 通常サウンド（SE）音量
 * @type {number}
 */
SoundManager.volume = 0.8;

/**
 * 音楽音量
 * @type {number}
 */
SoundManager.musicVolume = 0.8;

/**
 * ミュート状態
 * @type {boolean}
 */
SoundManager.muteFlag = false;

/**
 * 再生中の音楽音源
 * @type {import('../asset/sound').Sound | null}
 */
SoundManager.currentMusic = null;

/**
 * @typedef {{
 *   text?: string,
 *   fontColor?: import("../graphics/canvas").CanvasStyle,
 *   fontSize?: number,
 *   fontWeight?: string | number,
 *   fontFamily?: string,
 *   cornerRadius?: number
 * } & import('../display/shape').ShapeOptions } ButtonOptions
 */

/**
 * @class phina.ui.Button
 * Button
 * _extends phina.display.Shape
 */
class Button extends Shape {

  /**
   * @constructor
   * @param {ButtonOptions} [options]
   */
  constructor(options) {
    options = $safe.call(options || {}, Button.defaults);
    // options = (options || {}).$safe(phina.ui.Button.defaults);
    super(options);

    this.cornerRadius = options.cornerRadius;
    this.text         = options.text;
    this.fontColor    = options.fontColor;
    this.fontSize     = options.fontSize;
    this.fontWeight     = options.fontWeight;
    this.fontFamily   = options.fontFamily;

    this.setInteractive(true);
    this.on('pointend', function() {
      this.flare('push');
    });
  }

  /**
   * @param {import('../graphics/canvas').Canvas} canvas 
   */
  prerender(canvas) {
    canvas.roundRect(-this.width/2, -this.height/2, this.width, this.height, this.cornerRadius);
  }

  /**
   * @param {import('../graphics/canvas').Canvas} canvas 
   */
  postrender(canvas) {
    var context = canvas.context;
    // text
    var font = format.call("{fontWeight} {fontSize}px {fontFamily}", this);
    // var font = "{fontWeight} {fontSize}px {fontFamily}".format(this);
    context.font = font;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = this.fontColor;
    context.fillText(this.text, 0, 0);
  }

}

/**
 * @type {ButtonOptions}
 * @static
 */
Button.defaults = {
  width: 200,
  height: 80,
  backgroundColor: 'transparent',
  fill: 'hsl(200, 80%, 60%)',
  stroke: null,

  cornerRadius: 8,
  text: 'Hello',
  fontColor: 'white',
  fontSize: 32,
  fontWeight: '',
  fontFamily: "'HiraKakuProN-W3'", // Hiragino or Helvetica,
};

// defined
Shape.watchRenderProperty.call(Button, 'cornerRadius');
Shape.watchRenderProperty.call(Button, 'text');
Shape.watchRenderProperty.call(Button, 'fontColor');
Shape.watchRenderProperty.call(Button, 'fontSize');
Shape.watchRenderProperty.call(Button, 'fontFamily');

/**
 * @typedef {{
 *   value?: number
 *   maxValue?: number
 *   gaugeColor?: import("../graphics/canvas").CanvasStyle
 *   animation?: boolean
 *   cornerRadius?: number
 * } & import('../display/shape').ShapeOptions } GaugeOptions
 */

/**
 * @class phina.ui.Gauge
 * _extends phina.display.Shape
 * 
 * @example
 * const lifeGauge = new Gauge({
 *   fill: "gray", // Gauge background color
 *   gaugeColor: "red", // Gauge main color
 *   stroke: "black" // Gauge frame color
 *   maxValue: 200,
 *   animation: true,
 * })
 * 
 * if (playerDamaged) {
 *   lifeGauge.value -= 10
 * }
 * 
 */
class Gauge extends Shape {

  /**
   * @param {GaugeOptions} [options] 
   */
  constructor(options) {
    options = $safe.call({}, options || {}, Gauge.defaults);
    // options = ({}).$safe(options || {}, phina.ui.Gauge.defaults);
    
    super(options);

    /**
     * @private
     * @type {number}
     */
    this._value = (options.value !== undefined) ? options.value : options.maxValue;

    /**
     * @type {number} 最大値
     */
    this.maxValue = options.maxValue;

    /**
     * @type {import("../graphics/canvas").CanvasStyle} ゲージの色
     */
    this.gaugeColor = options.gaugeColor;
    
    /**
     * @type {number} 最大値
     */
    this.cornerRadius = options.cornerRadius;

    /**
     * @type {number} 見た目の値
     */
    this.visualValue = (options.value !== undefined) ? options.value : options.maxValue;

    /**
     * @type {boolean} アニメーションさせるかどうか
     */
    this.animation = options.animation;

    /**
     * @type {number} アニメーション完了時間をミリ秒指定
     * @default 1000
     */
    this.animationTime = 1*1000;
  }

  /**
   * 満タンかをチェック
   * @returns {boolean}
   */
  isFull() {
    return this.value === this.maxValue;
  }

  /**
   * 空っぽかをチェック
   * @returns {boolean}
   */
  isEmpty() {
    return this.value === 0;
  }

  /**
   * @param {number} value
   * @returns {void}
   */
  setValue(value) {
    value = clamp(value, 0, this.maxValue);
    // value = Math.clamp(value, 0, this.maxValue);

    // end when now value equal value of argument
    if (this.value === value) return ;

    // fire value change event
    this.flare('change');

    this._value = value;

    if (this.animation) {
      var range = Math.abs(this.visualValue-value);
      var time = (range/this.maxValue)*this.animationTime;

      // @ts-ignore
      this.tweener.ontween = function() {
        this._dirtyDraw = true;
      }.bind(this);
      this.tweener
        .clear()
        .to({'visualValue': value}, time)
        .call(function() {
          this.flare('changed');
          if (this.isEmpty()) {
            this.flare('empty');
          }
          else if (this.isFull()) {
            this.flare('full');
          }
        }, this);
    }
    else {
      this.visualValue = value;
      this.flare('changed');
      if (this.isEmpty()) {
        this.flare('empty');
      }
      else if (this.isFull()) {
        this.flare('full');
      }
    }
  }

  /**
   * 
   * @returns {number}
   */
  getRate() {
    var rate = this.visualValue/this.maxValue;
    return rate;
  }

  /**
   * @override
   * @param {import('../graphics/canvas').Canvas} canvas 
   */
  prerender(canvas) {
    canvas.roundRect(-this.width/2, -this.height/2, this.width, this.height, this.cornerRadius);
  }

  /**
   * @override
   * @param {import('../graphics/canvas').Canvas} canvas 
   */
  postrender(canvas) {
    var rate = this.getRate();
    canvas.context.fillStyle = this.gaugeColor;
    canvas.context.save();
    canvas.context.clip();
    canvas.fillRect(-this.width/2, -this.height/2, this.width*rate, this.height);
    canvas.context.restore();
  }

  get value() {
    return this._value;
  }
  set value(v) {
    this.setValue(v);
  }

}

/**
 * @type {GaugeOptions}
 * @static
 */
Gauge.defaults = {
  width: 256,
  height: 32,
  backgroundColor: 'transparent',
  fill: 'white',
  stroke: '#aaa',
  strokeWidth: 4,
  maxValue: 100,
  gaugeColor: '#44f',
  cornerRadius: 0,
  animation: true
};

// defined
Shape.watchRenderProperty.call(Gauge, 'value');
Shape.watchRenderProperty.call(Gauge, 'maxValue');
Shape.watchRenderProperty.call(Gauge, 'gaugeColor');
Shape.watchRenderProperty.call(Gauge, 'cornerRadius');

/**
 * @typedef {{
 *   anticlockwise?: boolean
 *   showPercentage?: boolean
 * } & GaugeOptions } CircleGaugeOptions
 */

/**
 * @class phina.ui.CircleGauge
 * _extends phina.ui.Gauge
 */
class CircleGauge extends Gauge {

  /**
   * @param {CircleGaugeOptions} [options] 
   */
  constructor(options) {
    options = $safe.call(options || {}, {
    // options = (options || {}).$safe({
      backgroundColor: 'transparent',
      fill: '#aaa',
      stroke: '#222',

      radius: 64,
      anticlockwise: true,
      showPercentage: false, // TODO
    });

    super(options);

    this.setBoundingType('circle');

    this.radius = options.radius;
    this.anticlockwise = options.anticlockwise;
    this.showPercentage = options.showPercentage;
  }

  /**
   * @override
   * @param {import('../graphics/canvas').Canvas} _canvas 
   */
  prerender(_canvas) {
    var rate = this.getRate();
    var end = (Math.PI*2)*rate;
    this.startAngle = 0;
    this.endAngle = end;

    this.canvas.rotate(-Math.PI*0.5);
    this.canvas.scale(1, -1);
  }

  /**
   * @override
   * @param {import('../graphics/canvas').Canvas} canvas 
   */
  renderFill(canvas) {
    canvas.fillPie(0, 0, this.radius, this.startAngle, this.endAngle);
  }

  /**
   * @override
   * @param {import('../graphics/canvas').Canvas} canvas 
   */
  renderStroke(canvas) {
    canvas.strokeArc(0, 0, this.radius, this.startAngle, this.endAngle);
  }

  postrender() {
    // if (this.showPercentage) {
    //   // TODO:
    //   var left = Math.max(0, this.limit-this.time);
    //   this.label.text = Math.ceil(left/1000)+'';
    // }
  }

}

/**
 * @typedef {{
 *   verticalAlign?: number | keyof LabelArea.verticalAlignToOffsetMap
 *   align?: keyof LabelArea.alignToOffsetMap,
 *   baseline?: CanvasTextBaseline,
 *   scroll?: Vector2
 *   scrollX?: number
 *   scrollY?: number
 * } & import('../display/label').LabelOptions } LabelAreaOptions
 */

/**
 * @type {{[fontName: string]: {[character: string]: number }}}
 */
var textWidthCache = {};

/**
 * @class phina.ui.LabelArea
 * _extends phina.display.Label
 */
class LabelArea extends Label {

  // _lineUpdate: true,

  /**
   * @param {LabelAreaOptions} options 
   */
  constructor(options) {
    options = $safe.call({}, options, LabelArea.defaults);
    // options = {}.$safe(options, LabelArea.defaults);
    super(options);

    this._lineUpdate = true;
    this.verticalAlign = options.verticalAlign;
    this.scroll = options.scroll || new Vector2();
    this.scrollX = options.scrollX;
    this.scrollY = options.scrollY;
  }

  /**
   * @returns {number}
   */
  calcCanvasWidth () {
    return this.width + this.padding * 2;
  }

  /**
   * @returns {number}
   */
  calcCanvasHeight () {
    return this.height + this.padding * 2;
  }

  /**
   * @returns {number}
   */
  getOffsetY () {
    if (typeof this.verticalAlign === 'number') {
      return this.verticalAlign;
    }
    return LabelArea.verticalAlignToOffsetMap[this.verticalAlign] || 0;
  }

  /**
   * @returns {number}
   */
  getOffsetX () {
    return LabelArea.alignToOffsetMap[this.align] || 0;
  }

  /**
   * @returns {{ [character: string]: number }}
   */
  getTextWidthCache () {
    var cache = textWidthCache[this.font];
    return cache || (textWidthCache[this.font] = {});
  }
  
  /**
   * @param {string[]} lines 文章
   * @returns {string[]} 整形済み文字ライン
   */
  spliceLines (lines) {
    var rowWidth = this.width;
    var context = this.canvas.context;
    context.font = this.font;

    var cache = this.getTextWidthCache();

    // update cache
    each.call(this._text, function(ch) {
    // this._text.each(function(ch) {
      if (!cache[ch]) {
        cache[ch] = context.measureText(ch).width;
      }
    });
    
    var localLines = [];
    lines.forEach(function(line) {
      
      var str = '';
      var totalWidth = 0;

      // はみ出ていたら強制的に改行する
      each.call(line, function(ch) {
      // line.each(function(ch) {
        var w = cache[ch];

        if ((totalWidth+w) > rowWidth) {
          localLines.push(str);
          str = '';
          totalWidth = 0;
        }

        str += ch;
        totalWidth += w;
      });

      // 残りを push する
      localLines.push(str);

    });
    

    return localLines;
  }
  
  getLines () {
    if (this._lineUpdate === false) {
      return this._lines;
    }
    this._lineUpdate = false;

    var lines = (this.text + '').split('\n');
    if (this.width < 1) {
      this._lines = lines;
    }
    else {
      this._lines = this.spliceLines(lines);
    }

    return this._lines;
  }

  /**
   * @override
   * @param {import('../graphics/canvas').Canvas} canvas 
   */
  prerender (canvas) {
    var context = canvas.context;
    context.font = this.font;
    context.textAlign = this.align;
    context.textBaseline = this.baseline;

    var text = this.text + '';
    var lines = this.getLines();
    var length = lines.length;
    var width = this.width;
    var height = this.height;

    var fontSize = this.fontSize;
    var lineSize = fontSize * this.lineHeight;
    var offsetX = this.getOffsetX() * width;
    var offsetY = this.getOffsetY();
    if (offsetY === 0) {
      offsetY = -Math.floor(length / 2) * lineSize;
      offsetY += ((length + 1) % 2) * (lineSize / 2);
    }
    else if (offsetY < 0) {
      offsetY *= height;
    }
    else {
      offsetY = offsetY * height - length * lineSize + lineSize;
    }

    offsetY -= this.scrollY;
    offsetX -= this.scrollX;
    var start = (offsetY + height / 2) / -lineSize | 0;
    if (start < 0) { start = 0; }

    var end = (height / 2 - offsetY + lineSize * 2) / lineSize | 0;
    lines = lines.filter(function(line, i) {
      return start <= i && end > i;
    });

    this.lines = lines;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.lineSize = lineSize;
    this.start = start;
  }

  /**
   * @override
   * @param {import('../graphics/canvas').Canvas} canvas 
   */
  renderFill (canvas) {
    var context = canvas.context;
    var offsetX = this.offsetX;
    var offsetY = this.offsetY;
    var lineSize = this.lineSize;
    var start = this.start;
    this.lines.forEach(function(line, i) {
      context.fillText(line, offsetX, (start + i) * lineSize + offsetY);
    }, this);
  }

  /**
   * @override
   * @param {import('../graphics/canvas').Canvas} canvas 
   */
  renderStroke (canvas) {
    var context = canvas.context;
    var offsetX = this.offsetX;
    var offsetY = this.offsetY;
    var lineSize = this.lineSize;
    var start = this.start;
    this.lines.forEach(function(line, i) {
      context.strokeText(line, offsetX, (start + i) * lineSize + offsetY);
    }, this);
  }

  get text() {
    return this._text;
  }
  set text(v) {
    this._text = v;
  }

  get scrollX() {
    return this.scroll.x;
  }
  set scrollX(v) {
    this.scroll.x = v;
  }

  get scrollY() {
    return this.scroll.y;
  }
  set scrollY(v) {
    this.scroll.y = v;
  }
  
  // _static: {
  //   defaults: {
  //     verticalAlign: 'top',
  //     align: 'left',
  //     baseline: 'top',
  //     width: 320,
  //     height: 320,
  //     scrollX: 0,
  //     scrollY: 0,
  //   },
  //   alignToOffsetMap: {
  //     start: -0.5,
  //     left: -0.5,
  //     center: 0,
  //     end: 0.5,
  //     right: 0.5,
  //   },

  //   verticalAlignToOffsetMap: {
  //     top: -0.5,
  //     center: 0,
  //     middle: 0,
  //     bottom: 0.5,
  //   },
  // },

  // _defined: function() {
  //   var func = function(newVal, oldVal) {
  //     if((this._lineUpdate === false) && (newVal !== oldVal)){
  //       this._lineUpdate = true;
  //     }
  //   };

  //   [
  //     'text',
  //     'width',
  //     'fontSize',
  //     'fontWeight',
  //     'fontFamily'
  //   ].forEach(function(key) {
  //     this.$watch(key, func);
  //   }, this.prototype);

  //   phina.display.Shape.watchRenderProperties.call(this ,[
  //     'verticalAlign',
  //     'text',
  //     'scroll',
  //     'scrollX',
  //     'scrollY'
  //   ]);
  // },

  /**
   * 未定義
   * @returns {this}
   */
  enableScroll() {
    //   this.setInteractive(true);
    //   var physical = phina.accessory.Physical();
    //   physical.attachTo(this);
    //   physical.friction = 0.8;
    //   var lastForce = 0;
    //   var lastMove = 0;
    //   this.on('pointstart', function(e){
    //     lastForce = physical.velocity.y;
    //     lastMove = 0;
    //     physical.force(0, 0);
    //   });
    //   this.on('pointmove', function(e){
    //     var p = e.pointer.deltaPosition;
    //     lastMove = p.y;
    //     this.scrollY += lastMove;
    //   });

    //   this.on('pointend', function(e){
    //     physical.force(0, lastForce + lastMove);
    //   });

    return this;
  }

}

/**
 * @type {LabelAreaOptions}
 */
LabelArea.defaults = {
  verticalAlign: 'top',
  align: 'left',
  baseline: 'top',
  width: 320,
  height: 320,
  scrollX: 0,
  scrollY: 0,
};
LabelArea.alignToOffsetMap = {
  start: -0.5,
  left: -0.5,
  center: 0,
  end: 0.5,
  right: 0.5,
};
LabelArea.verticalAlignToOffsetMap = {
  top: -0.5,
  center: 0,
  middle: 0,
  bottom: 0.5,
}

// defined
;(function() {
  var func = function(newVal, oldVal) {
    if((this._lineUpdate === false) && (newVal !== oldVal)){
      this._lineUpdate = true;
    }
  };

  [
    'text',
    'width',
    'fontSize',
    'fontWeight',
    'fontFamily'
  ].forEach(function(key) {
    $watch.call(this, key, func);
    // this.$watch(key, func);
  }, LabelArea.prototype);
})();

Shape.watchRenderProperties.call(LabelArea ,[
  'verticalAlign',
  'text',
  'scroll',
  'scrollX',
  'scrollY'
]);

/**
 * @class phina.effect.Wave
 * _extends phina.display.CircleShape
 */
class Wave extends CircleShape {

  /**
   * @constructor
   * @param {import("../display/shape").CircleShapeOptions} [options]
   */
  constructor(options) {
    options = $safe.call(options || {}, {
    // options = (options || {}).$safe({
      fill: 'white',
      stroke: false,
    });

    super(options);

    var tweener = new Tweener().attachTo(this);
    tweener
      .to({scaleX:2, scaleY:2, alpha:0}, 500)
      .call(function() {
        this.remove();
      }, this);
  }
}

/**
 * @class phina.social.Twitter
 * # Twitter の共有リンクを生成するクラス
 * Twitter の共有リンクの URL を生成してくれるクラスです。
 */
class Twitter {

  /**
   * @constructor
   * 
   * コンストラクタは存在しますがインスタンスメンバはありません。
   */
  constructor() {}

  /**
   * @method phina.social.Twitter.createURL
   * @static
   * Twitterの共有リンクを生成します。引数にオブジェクトを渡すことで様々なパラメーターを設定出来ます。引数のオブジェクトは {@link #phina.social.Twitter.defaults} で安全拡張されます。
   * 
   * ### Example
   *     phina.social.Twitter.createURL(); // => http://twitter.com/intent/tweet?text=Hello%2C%20world!&hashtags=javascript%2Cphina&url={現在のURL}
   * 
   *     phina.social.Twitter.createURL({
   *       text: 'This is text',
   *       hashtags: 'hashtag1,hashtag2',
   *       url: 'http://phinajs.com'
   *     }); // => http://twitter.com/intent/tweet?text=This%20is%20text&hashtags=hashtag1%2Chashtag2&url=http%3A%2F%2Fphinajs.com
   * 
   *     phina.social.Twitter.createURL({
   *       text: 'This is text',
   *       hashtags: 'hashtag1,hashtag2',
   *       url: 'http://phinajs.com',
   *       other: 'This is other'//設定項目は適当に増やせる
   *     }); // => http://twitter.com/intent/tweet?text=This%20is%20text&hashtags=hashtag1%2Chashtag2&url=http%3A%2F%2Fphinajs.com&other=This%20is%20other
   * 
   *     phina.social.Twitter.createURL({
   *       url: 'http://phinajs.com'
   *     }); // => http://twitter.com/intent/tweet?url=http%3A%2F%2Fphinajs.com&text=Hello%2C%20world!&hashtags=javascript%2Cphina
   * 
   * @param {Twitter.defaults} options
   * @return {String} Twitter の共有リンク
   */
  static createURL (options) {
    options = $safe.call(options || {}, Twitter.defaults);
    // options = (options || {}).$safe(this.defaults);

    var queries = [];
    var euc = encodeURIComponent;
    forIn.call(options, function(key, value) {
    // options.forIn(function(key, value) {
      var str = key + '=' + euc(value);
      queries.push(str);
    });

    var url = format.call('{baseURL}/{type}?{query}', {
    // var url = '{baseURL}/{type}?{query}'.format({
      baseURL: this.baseURL,
      // type: options.type,
      type: 'tweet',
      query: queries.join('&'),
    });

    return url;
  }

}


/**
 * @property {String} [phina.social.Twitter.baseURL = 'https://twitter.com/intent']
 * Twitter の共有リンクのベースとなる URL です。
 * 
 * @static
 */
Twitter.baseURL = 'https://twitter.com/intent';

/**
 * @property {Object} phina.social.Twitter.defaults
 * デフォルト値を格納しているオブジェクトです。{@link #phina.social.Twitter.defaults.text}, {@link #phina.social.Twitter.defaults.hashtags}, {@link #phina.social.Twitter.defaults.url} を内包しています。
 * 
 * @static
 */
Twitter.defaults = {
  // type: 'tweet',

  /**
   * @property {String} [phina.social.Twitter.defaults.text = 'Hello, World']
   * デフォルトでツイートに含まれる文字列です。
   * 
   * @static
   */
  text: 'Hello, world!',

  // screen_name: 'phi_jp',

  /**
   * @property {String} [phina.social.Twitter.defaults.hashtags = 'javascript, phina_js']
   * デフォルトでツイートに含まれるハッシュタグです。
   * 
   * @static
   */
  hashtags: 'javascript,phina_js',

  // url: 'http://github.com/phi-jp/phina.js',

  /**
   * @property {String} [phina.social.Twitter.defaults.url = phina.global.location && phina.global.location.href]
   * デフォルトでツイートに含まれる URL です。
   * 
   * @static
   */
  url: phina.global.location && phina.global.location.href

  // via: 'phi_jp',
};

/**
 * @typedef {{
 *   className: string | (new (...args: any)=> any)
 *   label: import("../app/scene").SceneLabel
 *   arguments?: any
 *   nextLabel?: import("../app/scene").SceneLabel
 *   nextArguments?: any
 * }} SceneData
 */

/**
 * @typedef {{
 *   startLabel: import("../app/scene").SceneLabel
 *   scenes: SceneData[]
 * }} ManagerSceneParams
 */

/**
 * @class phina.game.ManagerScene
 * _extends phina.app.Scene
 */
class ManagerScene extends Scene {

  /**
   * @constructor
   * @param {ManagerSceneParams} params
   */
  constructor(params) {
    super();

    /** @type SceneData[] */
    this.scenes;
    /** @type number */
    this.sceneIndex;

    this.setScenes(params.scenes);

    this.on("enter", function() {
      this.gotoScene(params.startLabel || 0);
    }.bind(this));

    this.on("resume", this.onnext.bind(this));

    /**
     * @private 未使用
     */
    this.commonArguments = {};
  }

  /**
   * scenes をセット
   * 
   * @param {SceneData[]} scenes
   * @returns {this}
   */
  setScenes(scenes) {
    this.scenes = scenes;
    this.sceneIndex = 0;

    return this;
  }

  /**
   * @private
   * Sceneクラスをインスタンス化して返す
   * 
   * @param {SceneData} data Sceneデータ
   * @param {any} args インスタンス化の際のコンストラクタの引数
   * @returns {Scene}
   */
  _instantiateScene(data, args) {
    // Scene初期化引数
    // typescriptが何故かargumentsに反応して余計な引数定義を生成するため、文字列参照とする
    var initArguments = $extend.call({}, data["arguments"], args);
    // var initArguments = {}.$extend(data.arguments, args);

    /** @type {Scene} */
    var scene;

    /** @type {(new (args: any)=> any)} */
    var SceneConstructor;
    if (typeof data.className === 'string') {
      // 文字列型の場合：phina.define、あるいはグローバルスコープ（window）に直接定義されたクラスの文字列
      SceneConstructor = phina.using(data.className);
      if (typeof SceneConstructor !== 'function') {
        SceneConstructor = phina.using('phina.game.' + data.className);
      }
    } else if (typeof data.className === 'function') {
      // 関数型の場合：純粋なclassと見なす
      SceneConstructor = data.className;
    }
    scene = new SceneConstructor(initArguments);

    // 次シーンパラメータが無い場合の処理
    if (!scene.nextLabel) {
      scene.nextLabel = data.nextLabel;
    }
    if (!scene.nextArguments) {
      scene.nextArguments = data.nextArguments;
    }

    return scene
  }

  /**
   * 指定したlabelに対応するシーンへ飛ぶ  
   * Sceneクラスをインスタンス化してappにreplaceSceneさせる  
   * 
   * @param  {import("../app/scene").SceneLabel} label シーンラベル
   * @param  {any} [args] Sceneにわたす引数がある場合に指定
   * @returns {this}
   */
  replaceScene(label, args) {
    var index = (typeof label == 'string') ? this.labelToIndex(label) : label||0;
    if (!this.scenes[index]) {
      console.error(format.call('phina.js error: `{0}` に対応するシーンがありません.', label));
    }
    var scene = this._instantiateScene(this.scenes[index], args);
    this.app.replaceScene(scene);
    this.sceneIndex = index;

    return this;
  }

  /**
   * 指定したlabelに対応するシーンへ飛ぶ  
   * replaceSceneとの違いはapp.replaceSceneではなく、
   * app.pushSceneを実行する点
   * 
   * @param {import("../app/scene").SceneLabel} label シーンラベル
   * @param {any} args Sceneコンストラクタの引数
   * @returns {this}
   */
  gotoScene(label, args) {
    var index = (typeof label == 'string') ? this.labelToIndex(label) : label||0;
    if (!this.scenes[index]) {
      console.error(format.call('phina.js error: `{0}` に対応するシーンがありません.', label));
    }
    var scene = this._instantiateScene(this.scenes[index], args);
    this.app.pushScene(scene);
    this.sceneIndex = index;

    return this;
  }

  /**
   * 次のシーンへ飛ぶ  
   * シーンが存在しない場合、"finish"イベントを発火して終了
   * 
   * @param {any} args 次のSceneコンストラクタの引数
   * @returns {this}
   */
  gotoNext(args) {
    var data = this.scenes[this.sceneIndex];
    var nextIndex = null;

    if (data.nextLabel) {
      // 次のラベルが設定されていた場合
      nextIndex = this.labelToIndex(data.nextLabel);
    }
    else if (this.sceneIndex+1 < this.scenes.length) {
      // index上の次のシーンに遷移
      nextIndex = this.sceneIndex+1;
    }

    if (nextIndex !== null) {
      this.gotoScene(nextIndex, args);
    }
    else {
      this.flare("finish");
    }

    return this;
  }

  /**
   * 現在のシーンのインデックスを取得
   * 
   * @returns {number}
   */
  getCurrentIndex() {
    return this.sceneIndex;
  }

  /**
   * 現在のシーンのラベルを取得
   * 
   * @returns {import("../app/scene").SceneLabel} label
   */
  getCurrentLabel() {
    return this.scenes[this.sceneIndex].label;
  }

  /**
   * ラベルからインデックスに変換
   * 
   * @param {import("../app/scene").SceneLabel} label
   */
  labelToIndex(label) {
    var data = this.scenes.filter(function(data) {
      return data.label == label;
    })[0];

    return this.scenes.indexOf(data);
  }

  /**
   * インデックスからラベルに変換
   * 
   * @param {number} index
   * @returns {import("../app/scene").SceneLabel} label
   */
  indexToLabel(index) {
    return this.scenes[index].label;
  }

  /**
   * @private
   * {@link BaseApp#popScene} の際にresumeイベント経由で実行され、
   * 対応する次のシーンに移行する
   * 
   * @param {{ prevScene: { nextLabel: import("../app/scene").SceneLabel; nextArguments: any; }; }} e
   * @returns {void}
   */
  onnext(e) {
    var nextLabel = e.prevScene.nextLabel;
    var nextArguments = e.prevScene.nextArguments;
    if (nextLabel) {
      this.gotoScene(nextLabel, nextArguments);
    }
    else {
      this.gotoNext(nextArguments);
    }
  }

}

/**
 * @typedef {{
 *   lie?: boolean,
 *   exitType?: 'auto'
 *   assets?: import("../asset/assetloader").AssetLoaderLoadParam
 * } & import("../display/displayscene").DisplaySceneOptions } LoadingSceneOptions
 */

/**
 * @class phina.game.LoadingScene
 * _extends phina.display.DisplayScene
 */
class LoadingScene extends DisplayScene {

  /**
   * @constructor
   * @param {LoadingSceneOptions} [options]
   */
  constructor(options) {
    options = $safe.call({}, options, LoadingScene.defaults);
    // options = ({}).$safe(options, phina.game.LoadingScene.defaults);
    super(options);

    this.gauge = new Gauge({
      value: 0,
      width: this.width,
      height: 12,
      fill: '#aaa',
      stroke: false,
      gaugeColor: 'hsla(200, 100%, 80%, 0.8)',
      padding: 0,
    }).addChildTo(this)
      .setPosition(
        this.gridX.center(),
        0,
      )
      .setOrigin(
        0.5, 
        0
      );
    // this.fromJSON({
    //   children: {
    //     gauge: {
    //       className: 'phina.ui.Gauge',
    //       arguments: {
    //         value: 0,
    //         width: this.width,
    //         height: 12,
    //         fill: '#aaa',
    //         stroke: false,
    //         gaugeColor: 'hsla(200, 100%, 80%, 0.8)',
    //         padding: 0,
    //       },
    //       x: this.gridX.center(),
    //       y: 0,
    //       originY: 0,
    //     }
    //   }
    // });

    var loader = new AssetLoader();

    if (options.lie) {
      this.gauge.animationTime = 10*1000;
      this.gauge.value = 90;

      loader.on('load', function() {
        this.gauge.animationTime = 0;
        this.gauge.value = 100;
      }.bind(this));
    }
    else {
      this.gauge.animationTime = 100;
      loader.on('progress', function(e) {
        this.gauge.value = e.progress * 100;
      }.bind(this)) ;
    }

    this.gauge.on('full', function() {
      if (options.exitType === 'auto') {
        this.app.popScene();
      }
      this.flare('loaded');
    }.bind(this));

    loader.load(options.assets);
  }

}

/** @type LoadingSceneOptions */
LoadingScene.defaults = {
  exitType: 'auto',
  lie: false,
};

/**
 * @typedef {Object} SplashSceneOptionExtend
 * @property {string} [imageURL] 表示するスプラッシュ画像パス
 */

/**
 * @class phina.game.SplashScene
 * _extends phina.display.DisplayScene
 */
class SplashScene extends DisplayScene {

  /**
   * @param {import("../display/displayscene").DisplaySceneOptions} [options]
   */
  constructor(options) {
    var defaults = SplashScene.defaults;
    super(options);

    var texture = new Texture();
    texture.load(defaults.imageURL).then(
    /** @this SplashScene */
    function() {
      this._init();
    }.bind(this));
    this.texture = texture;
  }

  /**
   * @private
   * 初期化関数
   */
  _init() {
    this.sprite = new Sprite(this.texture).addChildTo(this);

    this.sprite.setPosition(this.gridX.center(), this.gridY.center());
    this.sprite.alpha = 0;

    this.sprite.tweener
      .clear()
      .to({alpha:1}, 500, 'easeOutCubic')
      .wait(1000)
      .to({alpha:0}, 500, 'easeOutCubic')
      .wait(250)
      .call(function() {
        this.exit();
      }, this)
      ;
  }

}

/** @type {import("../display/displayscene").DisplaySceneOptions & SplashSceneOptionExtend} */
SplashScene.defaults = {
  imageURL: 'http://cdn.rawgit.com/phi-jp/phina.js/develop/logo.png',
};

/**
 * @typedef {Object} TitleSceneOptionExtend
 * @property {string} [title] タイトル文字列
 * @property {string} [message] 未使用
 * @property {import("../graphics/canvas").CanvasStyle} [fontColor] タイトルラベルの色
 * @property {string} [backgroundImage] 未使用
 * @property {"touch"|""} [exitType] "touch"指定時に自動でタッチ遷移イベントを付与
 * 
 * @typedef {import("../display/displayscene").DisplaySceneOptions & TitleSceneOptionExtend} TitleSceneOptions
 */

/**
 * @class phina.game.TitleScene
 * _extends phina.display.DisplayScene
 */
class TitleScene extends DisplayScene {

  /**
   * @constructor
   * @param {TitleSceneOptions} [params]
   */
  constructor(params) {
    params = $safe.call({}, params, TitleScene.defaults);
    // params = ({}).$safe(params, phina.game.TitleScene.defaults);
    super(params);

    this.backgroundColor = params.backgroundColor;

    this.fromJSON({
      children: {
        titleLabel: {
          className: Label,
          // className: 'phina.display.Label',
          arguments: {
            text: params.title,
            fill: params.fontColor,
            stroke: false,
            fontSize: 64,
          },
          x: this.gridX.center(),
          y: this.gridY.span(4),
        }
      }
    });

    if (params.exitType === 'touch') {
      this.fromJSON({
        children: {
          touchLabel: {
            className: Label,
            // className: 'phina.display.Label',
            arguments: {
              text: "TOUCH START",
              fill: params.fontColor,
              stroke: false,
              fontSize: 32,
            },
            x: this.gridX.center(),
            y: this.gridY.span(12),
          },
        },
      });

      this.on('pointend', function() {
        this.exit();
      });
    }
  }

}

/**
 * @type {TitleSceneOptions}
 */
TitleScene.defaults = {
  title: 'phina.js games',
  message: '',

  fontColor: 'white',
  backgroundColor: 'hsl(200, 80%, 64%)',
  backgroundImage: '',

  exitType: 'touch',
};

/**
 * @typedef {{
 *   fontColor?: string,
 *   exitType?: 'touch'
 * } & import("../display/displayscene").DisplaySceneOptions } PauseSceneOptions
 */

/**
 * @class phina.game.PauseScene
 * _extends phina.display.DisplayScene
 */
class PauseScene extends DisplayScene {

  /**
   * @constructor
   * @param {PauseSceneOptions} [params]
   */
  constructor(params) {
    params = $safe.call({}, params, PauseScene.defaults);
    // params = ({}).$safe(params, phina.game.PauseScene.defaults);
    super(params);

    this.backgroundColor = params.backgroundColor;

    this.fromJSON({
      children: {
        text: {
          className: Label,
          // className: 'phina.display.Label',
          arguments: {
            text: 'Pause',
            fill: params.fontColor,
            stroke: null,
            fontSize: 48,
          },
          x: this.gridX.center(),
          y: this.gridY.center(),
        },
      }
    });

    if (params.exitType === 'touch') {
      this.on('pointend', function() {
        this.exit();
      });
    }
  }

}

/** @type PauseSceneOptions */
PauseScene.defaults =  {
  fontColor: 'white',
  backgroundColor: 'hsla(0, 0%, 0%, 0.85)',

  exitType: 'touch',
};

/**
 * @typedef {Object} ResultSceneOptionExtend
 * @property {number} [score] [description]
 * @property {string} [message] [description]
 * @property {string} [hashtags] [description]
 * @property {string} [url] [description]
 * @property {"touch"} [exitType] [description]
 * @property {import("../graphics/canvas").CanvasStyle} [fontColor] [description]
 * @property {import("../graphics/canvas").CanvasStyle} [backgroundColor]
 * @property {string} [backgroundImage] 未使用
 * 
 * @typedef {import("../display/displayscene").DisplaySceneOptions & ResultSceneOptionExtend} ResultSceneOptions
 */

/**
 * @class phina.game.ResultScene
 * _extends phina.display.DisplayScene
 */
class ResultScene extends DisplayScene {

  /**
   * @constructor
   * @param {ResultSceneOptions} [params]
   */
  constructor(params) {
    params = $safe.call({}, params, ResultScene.defaults);
    // params = ({}).$safe(params, phina.game.ResultScene.defaults);
    super(params);

    var message = format.call(params.message, params);
    // var message = params.message.format(params);

    this.backgroundColor = params.backgroundColor;

    this.fromJSON({
      children: {
        scoreText: {
          className: Label,
          // className: 'phina.display.Label',
          arguments: {
            text: 'score',
            fill: params.fontColor,
            stroke: null,
            fontSize: 48,
          },
          x: this.gridX.span(8),
          y: this.gridY.span(4),
        },
        scoreLabel: {
          className: Label,
          // className: 'phina.display.Label',
          arguments: {
            text: params.score+'',
            fill: params.fontColor,
            stroke: null,
            fontSize: 72,
          },
          x: this.gridX.span(8),
          y: this.gridY.span(6),
        },

        messageLabel: {
          className: Label,
          // className: 'phina.display.Label',
          arguments: {
            text: message,
            fill: params.fontColor,
            stroke: null,
            fontSize: 32,
          },
          x: this.gridX.center(),
          y: this.gridY.span(9),
        },

        shareButton: {
          className: Button,
          // className: 'phina.ui.Button',
          arguments: [{
            text: '★',
            width: 128,
            height: 128,
            fontColor: params.fontColor,
            fontSize: 50,
            cornerRadius: 64,
            fill: 'rgba(240, 240, 240, 0.5)',
            // stroke: '#aaa',
            // strokeWidth: 2,
          }],
          x: this.gridX.center(-3),
          y: this.gridY.span(12),
        },
        playButton: {
          className: Button,
          // className: 'phina.ui.Button',
          arguments: [{
            text: '▶',
            width: 128,
            height: 128,
            fontColor: params.fontColor,
            fontSize: 50,
            cornerRadius: 64,
            fill: 'rgba(240, 240, 240, 0.5)',
            // stroke: '#aaa',
            // strokeWidth: 2,
          }],
          x: this.gridX.center(3),
          y: this.gridY.span(12),

          interactive: true,
          onpush: function() {
            this.exit();
          }.bind(this),
        },
      }
    });

    if (params.exitType === 'touch') {
      this.on('pointend', function() {
        this.exit();
      });
    }

    /** @type Button & {onclick: Function} */
    this.shareButton;

    this.shareButton.onclick = function() {
      var text = format.call('Score: {0}\n{1}', params.score, message);
      // var text = 'Score: {0}\n{1}'.format(params.score, message);
      var url = Twitter.createURL({
        text: text,
        hashtags: params.hashtags,
        url: params.url,
      });
      window.open(url, 'share window', 'width=480, height=320');
    };
  }

}

/** @type {ResultSceneOptions} */
ResultScene.defaults = {
  score: 16,

  message: 'this is phina.js project.',
  hashtags: 'phina_js,game,javascript',
  url: phina.global.location && phina.global.location.href,

  fontColor: 'white',
  backgroundColor: 'hsl(200, 80%, 64%)',
  backgroundImage: '',
};

/**
 * デフォルトシーンのオプション統合型
 * @typedef { import("./titlescene").TitleSceneOptions
 * & import("./pausescene").PauseSceneOptions
 * & import("./resultscene").ResultSceneOptions
 * & import("../game/loadingscene").LoadingSceneOptions
 * } DefaultSceneOptions
 */

/**
 * @typedef {{
 *   scenes?: import("./managerscene").SceneData[]
 *   startLabel?: import("../app/scene").SceneLabel
 *   autoPause?: boolean
 *   debug?: boolean
 *   loadingScene?: typeof DisplayScene
 *   pauseScene?: typeof DisplayScene
 * } 
 * & import("../display/canvasapp").CanvasAppOptions
 * } GameAppOptions
 */

/**
 * デフォルトのmain class
 */
class DefaultMainScene extends DisplayScene {
  constructor(options) {
    super(options);
    console.log('This is MainScene');
  }
}
/**
 * クラスがphina.defineによって定義（グローバルに定義）されているかどうかをチェック
 * @param {string} className クラス名。phina.game[className]で定義されているかも調べる
 * @returns {boolean}
 */
function isGameClassDefined(className) {
  if (
    typeof phina.using(className) === 'function'
    || typeof phina.using('phina.game.' + className) === 'function'
  ) {
    return true
  }
  return false;
}

/**
 * @class phina.game.GameApp
 * _extends phina.display.CanvasApp
 */
class GameApp extends CanvasApp {
  /**
   * @param {GameAppOptions & DefaultSceneOptions} [options]
   */
  constructor(options) {
    options = /** @type {GameAppOptions} */($safe.call(options || {}, {
    // options = (options || {}).$safe({
      startLabel: 'title',
    }));
    super(options);

    /** @type {any} dat.GUIインスタンス */
    this.gui = undefined;

    var startLabel = options.startLabel || 'title';

    var scenes = options.scenes || [
      {
        className: isGameClassDefined("SplashScene") ? "SplashScene" : SplashScene,
        label: 'splash',
        nextLabel: 'title',
      },
      {
        className: isGameClassDefined("TitleScene") ? "TitleScene" : TitleScene,
        label: 'title',
        nextLabel: 'main',
      },
      {
        className: isGameClassDefined("MainScene") ? "MainScene" : DefaultMainScene,
        label: 'main',
        nextLabel: 'result',
      },
      {
        className: isGameClassDefined("ResultScene") ? "ResultScene" : ResultScene,
        label: 'result',
        nextLabel: 'title',
      },
    ];

    scenes = each$1.call(scenes, function(s) {
      s.arguments = s.arguments || options;
    });

    var scene = new ManagerScene({
      startLabel: startLabel,
      scenes: scenes,
    });

    if (options.assets) {
      // ローディング：esm版では独自のLoadingSceneはオプションで渡せるようにする

      var loadingOptions = $extend.call({}, options, {
      // var loadingOptions = ({}).$extend(options, {
        exitType: '',
      });
      // グローバル定義のLoadingSceneを探す（従来）
      // -> なければオプションをチェック 
      // -> これもなければデフォルトのLoadingSceneを使う
      var definedLoadingClass = phina.using("LoadingScene") || phina.using("phina.game.LoadingScene");
      var loading = (typeof definedLoadingClass === 'function') 
        ? definedLoadingClass(loadingOptions)
        : (options.loadingScene != null)
          ? new options.loadingScene(loadingOptions) 
          : new LoadingScene(loadingOptions)
      ;
      this.replaceScene(loading);

      loading.onloaded = function() {
        this.replaceScene(scene);
        if (options.debug) {
          this._enableDebugger();
        }
      }.bind(this);
    }
    else {
      this.replaceScene(scene);
      if (options.debug) {
        this._enableDebugger();
      }
    }

    // 自動でポーズする
    // esm版では独自のポーズシーンはオプションで渡す
    // 引数が渡せないのは元から
    if (options.autoPause) {
      this.on('blur', function() {
        var definedPauseScene = phina.using("phina.game.PauseScene");
        var pauseScene = (typeof definedPauseScene === 'function') 
          ? definedPauseScene() 
          : (options.pauseScene) 
            ? new options.pauseScene(options) 
            : new PauseScene();
        this.pushScene(pauseScene);
      });
    }
  }

  /**
   * @private
   */
  _enableDebugger() {
    if (this.gui) return ;

    this.enableDatGUI(
    /**
     * @this {GameApp}
     * @param {{ addFolder: (arg0: string) => any; }} gui Dat.guiインスタンス
     */
    function(gui) {
      var f = gui.addFolder('scenes');
      var funcs = {};
      each$1.call(/** @type {ManagerScene} */(this.rootScene).scenes, function(scene) {
      // this.rootScene.scenes.each(function(scene) {
        funcs[scene.label] = function() {
          this.rootScene.replaceScene(scene.label);
          console.log(this._scenes.length);
        }.bind(this);
        return scene;
      }, this);

      forIn.call(funcs, function(key, value) {
      // funcs.forIn(function(key, value) {
        f.add(funcs, key);
      });
      f.open();

      this.gui = gui;
    }.bind(this));
  }
}

/**
 * Appクラス統合型
 * @typedef {import('../app/baseapp').BaseApp | import('../display/domapp').DomApp | import('../display/canvasapp').CanvasApp | GameApp} AppUnion
 */

/**
 * @typedef {Object} CountSceneOptionExtend
 * @property {number|number[]} [count] カウントダウン回数。配列で渡した場合、その逆順でカウントダウンを行う
 * @property {import("../index.esm").CanvasStyle} [fontColor] フォントの色
 * @property {number} [fontSize] フォントサイズ
 * @property {string} [exitType] 'auto'のとき、自動でpopScene
 * 
 * @typedef {import("../display/displayscene").DisplaySceneOptions & CountSceneOptionExtend} CountSceneOptions
 */

/**
 * @class phina.game.CountScene
 * _extends phina.display.DisplayScene
 * 
 * 自動でカウントダウンを行う一時用Scene
 * メインのシーンでゲーム開始前にpushSceneするのが一般的な使い方
 */
class CountScene extends DisplayScene {

  /**
   * @constructor
   * @param {CountSceneOptions} [options]
   */
  constructor(options) {
    super(options);

    options = $safe.call(options || {}, CountScene.defaults);
    // options = (options || {}).$safe(phina.game.CountScene.defaults);

    this.backgroundColor = options.backgroundColor;

    this.fromJSON({
      children: {
        label: {
          className: Label,
          // className: 'phina.display.Label',
          arguments: {
            fill: options.fontColor,
            fontSize: options.fontSize,
            stroke: false,
          },
          x: this.gridX.center(),
          y: this.gridY.center(),
        },
      }
    });

    /** @type {Label} */
    this.label;

    /** @type {number[]} */
    this.countList;

    if (options.count instanceof Array) {
      this.countList = clone.call(options.count).reverse();
      // this.countList = options.count.clone().reverse();
    }
    else {
      this.countList = range.call([], 1, options.count+1);
      // this.countList = Array.range(1, options.count+1);
    }
    this.counter = this.countList.length;
    this.exitType = options.exitType;

    this._updateCount();
  }

  _updateCount() {
    var endFlag = this.counter <= 0;
    var index = --this.counter;

    this.label.text = this.countList[index];

    this.label.scale.set(1, 1);
    this.label.tweener
      .clear()
      .to({
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
      }, 250)
      .wait(500)
      .to({
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0.0
      }, 250)
      .call(
      /** @this CountScene */
      function() {
        if (this.counter <= 0) {
          this.flare('finish');
          if (this.exitType === 'auto') {
            this.app.popScene();
          }
        }
        else {
          this._updateCount();
        }
      }, this);
  }

}

/** @type {CountSceneOptions} */
CountScene.defaults = {
  count: 3,

  width: 640,
  height: 960,

  fontColor: 'white',
  fontSize: 164,
  backgroundColor: 'rgba(50, 50, 50, 1)',

  exitType: 'auto',
};




/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "XMLLoader": () => (/* reexport module object */ _tiledmap_XMLLoader__WEBPACK_IMPORTED_MODULE_0__),
/* harmony export */   "TileSet": () => (/* reexport module object */ _tiledmap_Tileset__WEBPACK_IMPORTED_MODULE_1__),
/* harmony export */   "TiledMap": () => (/* reexport module object */ _tiledmap_Tiledmap__WEBPACK_IMPORTED_MODULE_2__)
/* harmony export */ });
/* harmony import */ var _tiledmap_XMLLoader__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tiledmap/XMLLoader */ "./src/tiledmap/XMLLoader.js");
/* harmony import */ var _tiledmap_Tileset__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tiledmap/Tileset */ "./src/tiledmap/Tileset.js");
/* harmony import */ var _tiledmap_Tiledmap__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./tiledmap/Tiledmap */ "./src/tiledmap/Tiledmap.js");




})();

/******/ })()
;