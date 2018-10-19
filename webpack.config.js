const path = require('path');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

const config = {
  mode: 'development',
  entry: './index.js',
  output: {
    path: path.resolve(__dirname,'./dist'),
    filename: 'bundle.js'
  },
module:{
  rules:[{
    test:/\.m?js$/,
    exclude:'/(node_modules| bower_components)/',
    use:{
      loader:'babel-loader'    
    }
  }]
},
optimization: {
  minimizer: [new UglifyJsPlugin()]
},
plugins: [
  new UglifyJsPlugin({
    test: /\.js(\?.*)?$/i
  })
]
  // module: {
  //   rules: [
  //     {
  //       test: /\.tsx?$/,
  //       use: 'ts-loader',
  //       exclude: /node_modules/
  //     }
  //   ]
  // }
}

module.exports = config;