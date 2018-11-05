const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const config = {
  mode: 'development',
  entry: './src/index.js',
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
plugins: [
  new HtmlWebpackPlugin({
    template: "./index.html",
    title: "Test"
  })
]
}

module.exports = config;