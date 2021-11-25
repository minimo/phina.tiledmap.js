const { merge } = require('webpack-merge');
const common = require('./webpack.common.js') // 汎用設定をインポート

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  output: {
    path: `${__dirname}/develop`,
    filename: 'phina.tiledmap.js',
  },
  devServer: {
    contentBase: "develop",
    open: true
  },
});
