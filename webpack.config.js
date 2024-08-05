const path = require('path');

module.exports = {
  entry: './src/js/app.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'src', 'dist'),
  },
  target: 'electron-renderer',
  mode: 'production',
};