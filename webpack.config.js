const fs   = require('fs');
const path = require('path');
const glob = require('glob');

const CopyPlugin             = require('copy-webpack-plugin');
const TerserPlugin           = require('terser-webpack-plugin');
const CssMinimizerPlugin     = require('css-minimizer-webpack-plugin');
const HtmlWebpackPlugin      = require('html-webpack-plugin');
const MiniCssExtractPlugin   = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

// Recursively finds every ".html" page under "dir" (e.g. individual pages tucked away in
// "src/view/examples"), skipping the "parts" folder — it holds partials (header/footer), not
// pages of its own. Every match still builds to a flat "<name>.html" at the dist root, regardless
// of how deep its source file lives, so nesting pages into subfolders never changes their URL.
const findHtmlFiles = dir => {
  const absDir = path.resolve(__dirname, dir);

  return fs.readdirSync(absDir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) {
      return entry.name === 'parts' ? [] : findHtmlFiles(`${dir}/${entry.name}`);
    }
    return entry.name.endsWith('.html') ? [`${dir}/${entry.name}`] : [];
  });
}

const parseHtmlPages = dir => {
  return findHtmlFiles(dir).map(file => new HtmlWebpackPlugin({
    filename: `${path.parse(file).name}.html`,
    template: path.resolve(__dirname, file),
    inject: true,
  }));
}

// Every scss entry under parseEntries('scss', 'css') below (e.g. "css/styles") produces a CSS file
// via MiniCssExtractPlugin but, since every webpack entry is inherently JS, also
// an accompanying (empty) JS chunk — CleanWebpackPlugin's own cleanAfterEveryBuildPatterns already
// deletes every "css/*.js" file post-build, but html-webpack-plugin has already injected a <script>
// tag for it by then, left dangling (404) in every generated page. Strips just that script tag; the
// CSS <link> for the same entry is untouched.
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

// "index" needs no special case: connect-history-api-fallback already falls back to
// "/index.html" on its own for any unmatched, dot-less path (including "/") — a catch-all
// entry here (`from: /./`) would match every request before its turn came up, in whatever
// order fs.readdirSync happens to return entries, silently swallowing every other rewrite
// that follows it in the array.
const parseHtmlParts = dir => {
  return findHtmlFiles(dir).map(file => {
    const name = path.parse(file).name;

    return { from: new RegExp(`^\\/${name}`), to: `/${name}.html` };
  });
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
      cleanAfterEveryBuildPatterns: ['*.LICENSE.txt', 'css/*.js'],
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
        // Emitted as an "asset/source" module (a plain string) instead of run through css-loader,
        // which would otherwise drag its runtime (dist/runtime/api.js, noSourceMaps.js) and array-push
        // wrapper into every entry that imports one — dead weight since nothing here needs url()
        // rewriting or CSS Modules.
        test: /\.(sass|scss)$/,
        resourceQuery: /inline/,
        type: 'asset/source',
        include: path.resolve(__dirname, 'src/styles'),
        use: [
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
