const { merge } = require('webpack-merge');
const common = require('./webpack.common.js') // 汎用設定をインポート

module.exports = merge(common, {
  mode: 'production',
  output: {
    path: `${__dirname}/publish`,
    filename: 'main.js',
  },
});