import {XMLLoader} from "./XMLLoader"
import {AssetLoader, AssetManager, Canvas, Texture, $safe, $extend} from "phina.js";

export class TiledMap extends XMLLoader{
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
     * @returns {Promise<unknown>}
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
            resolve();
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
     * @returns {Promise<unknown>|Promise<void>}
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
          const tsx = AssetManager.get('tsx', e.image);
          if (!tsx) {
            //アセットになかったのでロードリストに追加
            loadImage.push(e);
          }
        } else {
          const image = AssetManager.get('image', e.image);
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
          const loader = new AssetLoader();
          loader.load(assets);
          loader.on('load', () => {
            this.tilesets.forEach(e => {
              e.tsx = AssetManager.get('tsx', e.source);
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
      const canvas = new Canvas().setSize(width, height);

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
            const image = AssetManager.get('image', this.layers[i].image.source);
            canvas.context.drawImage(image.domElement, this.layers[i].x, this.layers[i].y);
          }
        }
      }

      const texture = new Texture();
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
      const image = AssetManager.get('image', chip.image);
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
AssetLoader.assetLoadFunctions.tmx = (key, path) => {
    const tmx = new TiledMap();
    return tmx.load(path);
}
