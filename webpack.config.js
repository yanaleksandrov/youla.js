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

// The scss entries under parseEntries('scss', 'css') below (e.g. "css/styles") produce a CSS file
// via MiniCssExtractPlugin but, since every webpack entry is inherently JS, also an accompanying
// (empty) JS chunk — CleanWebpackPlugin's own cleanAfterEveryBuildPatterns already deletes that
// "**/styles.js" file post-build, but html-webpack-plugin has already injected a <script> tag for it
// by then, left dangling (404) in every generated page. Strips just that script tag; the CSS <link>
// for the same entry is untouched.
class StripCssScriptTagsPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('StripCssScriptTagsPlugin', (compilation) => {
      HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tap('StripCssScriptTagsPlugin', (data) => {
        const isDanglingCssScript = tag => tag.tagName === 'script' && /^css\//.test(tag.attributes?.src || '');

        data.headTags = data.headTags.filter(tag => !isDanglingCssScript(tag));
        data.bodyTags = data.bodyTags.filter(tag => !isDanglingCssScript(tag));
        return data;
      });
    });
  }
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
    new StripCssScriptTagsPlugin(),
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
        // `import css from './x.scss?inline'` — the raw compiled CSS as a JS string, for components
        // that inject their own styles into a shadow root instead of shipping a global stylesheet.
        test: /\.(sass|scss)$/,
        resourceQuery: /inline/,
        include: path.resolve(__dirname, 'src/styles'),
        use: [
          {
            loader: 'css-loader',
            options: {
              sourceMap: false,
              url: false,
              exportType: 'string',
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
        test: /\.(sass|scss)$/,
        resourceQuery: { not: [/inline/] },
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
        include: path.resolve(__dirname, 'src/view/parts') + path.sep,
        use: ['raw-loader'],
      },
      {
        test: /\.html$/,
        include: path.resolve(__dirname, 'src/view/editrix') + path.sep,
        use: ['raw-loader'],
      },
      {
        // Each editrix control's own template — src/editrix/control/<name>/index.html — sits next to its JS, not under src/view.
        test: /\.html$/,
        include: path.resolve(__dirname, 'src/editrix/control') + path.sep,
        use: ['raw-loader'],
      },
      {
        // Each block's own template — src/editrix/blocks/<type>/index.html — a "<template id=...>",
        // required from view/editrix.html the same way control templates are (see webpack.config.js's
        // own comment above), and cloned at runtime via editrix/controls/template.js.
        test: /\.html$/,
        include: path.resolve(__dirname, 'src/editrix/blocks') + path.sep,
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
