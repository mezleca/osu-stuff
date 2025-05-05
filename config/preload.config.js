import path from 'path';
import nodeExternals from "webpack-node-externals";

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
    entry: path.resolve(__dirname, '..', 'src', 'preload', 'index.js'),
    target: 'electron-preload',
    mode: 'production',
    output: {
        filename: 'preload.bundle.js',
        path: path.resolve(__dirname, '..', 'src', 'dist'),
        libraryTarget: 'commonjs2',
    },
    devtool: false,
    module: {
        rules: [{
            test: /\.(js|jsx)$/,
            exclude: /(\.\/node_modules|\.\/app\/node_modules)/,
            use: {
                loader: 'babel-loader',
            },
        }, 
      ],
    },
    optimization: {
        minimize: true
    },
    resolve: {
        extensions: ['.js'],
        modules: [path.resolve(__dirname, 'app/node_modules')],
    },
    externals: [
        nodeExternals({
            modulesFromFile: {
                fileName: path.resolve(__dirname, 'app/package.json'),
            },
        }),
    ],
};
