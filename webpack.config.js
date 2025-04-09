const fs   = require('fs');
const path = require('path');
const glob = require('glob');

const CopyPlugin             = require('copy-webpack-plugin');
const TerserPlugin           = require('terser-webpack-plugin');
const CssMinimizerPlugin     = require('css-minimizer-webpack-plugin');
const HtmlWebpackPlugin      = require('html-webpack-plugin');
const MiniCssExtractPlugin   = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const parseHtmlPages = dir => {
  const files = fs.readdirSync(path.resolve(__dirname, dir));

  return files.reduce((acc, file) => {
    const [name, extension] = file.split('.');
    if (extension) {
      acc.push(new HtmlWebpackPlugin({
        filename: `${name}.html`,
        template: path.resolve(__dirname, `${dir}/${name}.${extension}`),
        inject: true,
      }));
    }
    return acc;
  }, []);
}

const parseHtmlParts = dir => {
  return fs.readdirSync(path.resolve(__dirname, dir)).map(file => {
    const [name, extension] = file.split('.');

    if (extension === 'html') {
      return { from: new RegExp(`^\\/${name}`), to: `/${file}` };
    } else if ( name === 'index' ) {
      return { from: /./, to: `/${name}/index.html` };
    }
    return null;
  }).filter(item => item !== null);
}

// separate and compile every .scss & .js file from root "src" folder
const parseEntries = (type, outputFolder, postfix = '') => {
  return glob.sync(`./src/**.${type}`).reduce((obj, el) => {
    const name = path.parse(el).name;

    obj[`${outputFolder}/${name}${postfix}`] = el;
    return obj;
  }, {});
}

module.exports = {
  entry: {
    ...parseEntries('scss', 'css'),
    ...parseEntries('js', 'js')
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  plugins: [
    new CleanWebpackPlugin({
      protectWebpackAssets: false,
      cleanAfterEveryBuildPatterns: ['*.LICENSE.txt', '**/styles.js'],
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
    new CopyPlugin({
      patterns: [
        {
          from: 'src/fonts',
          to: 'fonts',
          noErrorOnMissing: true,
        },
        {
          from: 'src/images',
          to: 'images',
          noErrorOnMissing: true,
        },
      ],
    }),
  ].concat(
    parseHtmlPages('src/view')
  ),
  devServer: {
    static: {
      directory: path.resolve(__dirname, 'dist'),
    },
    port: 3000,
    open: true,
    hot: true,
    compress: true,
    historyApiFallback: {
      rewrites: parseHtmlParts('src/view'),
    },
  },
  module: {
    rules: [
      {
        test: /\.(sass|scss)$/,
        include: path.resolve(__dirname, 'src/styles'),
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {},
          },
          {
            loader: 'css-loader',
            options: {
              sourceMap: false,
              url: false,
            },
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  require('autoprefixer'),
                ],
              },
            },
          },
          {
            loader: 'sass-loader',
            options: {
              implementation: require('sass'),
              sourceMap: false,
            },
          },
        ],
      },
      {
        test: /\.html$/,
        include: path.resolve(__dirname, 'src/view/parts'),
        use: ['raw-loader'],
      },
      {
        test: /\.html$/,
        include: path.resolve(__dirname, 'src/view/sections'),
        use: ['raw-loader'],
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          compress: false,
          format: {
            comments: false,
            beautify: true,
            quote_style: 0,
          },
          keep_classnames: true, // save classes names
          keep_fnames: true, // save functions names
          mangle: false, // disable names obfuscation
        },
      }),
      new CssMinimizerPlugin({
        minimizerOptions: {
          preset: [
            'default',
            {
              discardComments: { removeAll: true },
            },
          ]
        },
      }),
    ],
  },
}
