import {XMLLoader} from "./XMLLoader"
import {AssetLoader, AssetManager} from "phina.js";
import {$extend, $safe} from "phina.js/types/core/object";

export class TileSet extends XMLLoader{
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

    loadFromXML(xml) {
      return this._parse(xml);
    }

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

    //アセットに無いイメージデータを読み込み
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
        const image = AssetManager.get('image', imageSource.image);
        if (image) {
          this.image = image;
        } else {
          loadImage = imageSource;
        }

        //ロードリスト作成
        const assets = { image: [] };
        assets.image[imageSource.imageName] = imageSource.imageUrl;

        if (loadImage) {
          const loader = new AssetLoader();
          loader.load(assets);
          loader.on('load', () => {
            //透過色設定反映
            this.image = AssetManager.get('image', imageSource.imageUrl);
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

//ローダーに追加
AssetLoader.assetLoadFunctions.tsx = function(key, path) {
    const tsx = new TileSet();
    return tsx.load(path);
};

