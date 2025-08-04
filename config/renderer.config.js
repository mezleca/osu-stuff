import path from "path";
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
    entry: {
        app: path.resolve(__dirname, '..', 'src', 'renderer', 'app.js'),
        index: path.resolve(__dirname, '..', 'src', 'renderer', 'gui', 'index.css'),
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, '..', 'out')
    },
    target: 'electron-renderer',
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader'
                ]
            }
        ]
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].min.css'
        })
    ],
    optimization: {
        minimizer: [
            new TerserPlugin(),
            new CssMinimizerPlugin()
        ]
    }
};
