import path from "path";
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
    entry: {
        app: './src/js/app.js',
        index: './src/gui/index.css'
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'src', 'dist'),
        clean: true
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
