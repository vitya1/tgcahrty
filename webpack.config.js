const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
    //mode: 'development',
    mode: 'production',
    entry: './lib/index',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
        library: 'TgChart'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                loader: 'babel-loader'
            }
        ]
    },
    optimization: {
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    ie8: true,
                    mangle: true,
                    warnings: false,
                    safari10: true
                }
            })
        ]
    }
};
