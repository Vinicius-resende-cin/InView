// Standalone web build for InView.
// Reuses the exact same React app (DependencyView) as the Chrome extension,
// but builds a self-contained single-page app served over HTTP instead of
// injecting into GitHub's PR page. The extension build (webpack.config.js) is
// untouched and continues to work independently.
//
// Two modes, selected by webpack's --env flag:
//   * default        -> talks to the analysis backend (SERVER_URL / :4000)
//   * --env local    -> no backend; a dev-server middleware serves analysis
//                       JSON files from a local folder (--env dir=<path>).
const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const HTMLPlugin = require("html-webpack-plugin");
const Dotenv = require("dotenv-webpack");

module.exports = (env = {}) => {
  const localMode = Boolean(env.local);
  const analysisDir = path.resolve(env.dir || "./analysis-output");

  const plugins = [
    new HTMLPlugin({
      template: "./src/web/index.html",
      filename: "index.html",
      chunks: ["index"]
    })
  ];

  if (localMode) {
    // No backend: talk to the current origin (the dev server) and flag the app.
    plugins.push(
      new webpack.DefinePlugin({
        "process.env.LOCAL_MODE": JSON.stringify("true"),
        "process.env.SERVER_URL": JSON.stringify("")
      })
    );
  } else {
    // Backend mode: SERVER_URL comes from .env, local mode is off.
    plugins.push(new Dotenv());
    plugins.push(
      new webpack.DefinePlugin({
        "process.env.LOCAL_MODE": JSON.stringify("false")
      })
    );
  }

  return {
    entry: {
      index: "./src/web/index.tsx"
    },
    mode: "production",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: "ts-loader",
              options: {
                compilerOptions: { noEmit: false }
              }
            }
          ],
          exclude: /node_modules/
        },
        {
          // Note: unlike the extension build, node_modules is NOT excluded here,
          // so third-party CSS (diff2html, react-sigma) imported by the app loads.
          test: /\.css$/i,
          use: ["style-loader", "css-loader"]
        }
      ]
    },
    plugins,
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      alias: {
        "@src": path.resolve(__dirname, "src"),
        "@extension": path.resolve(__dirname, "src", "extension")
      }
    },
    output: {
      path: path.join(__dirname, "dist-web"),
      filename: "[name].js",
      clean: true
    },
    devServer: {
      static: { directory: path.join(__dirname, "dist-web") },
      port: 3000,
      open: true,
      hot: true,
      // In local mode, emulate the backend from a local folder so the unchanged
      // DependencyView / AnalysisService / SettingsService work as-is.
      setupMiddlewares: localMode
        ? (middlewares, devServer) => setupLocalApi(middlewares, devServer, analysisDir)
        : undefined
    }
  };
};

/**
 * Registers the local-folder API on the dev server:
 *   GET  /local-api/files          -> { dir, files: [*.json in the folder] }
 *   GET  /analysis?owner=<file>    -> parsed contents of <file> (an analysis output)
 *   GET  /settings                 -> default (empty) settings
 *   POST|PUT /settings             -> accepted no-op (local mode does not persist)
 */
function setupLocalApi(middlewares, devServer, analysisDir) {
  const app = devServer.app;

  console.log(`[InView local mode] serving analysis files from: ${analysisDir}`);

  // Resolve a user-provided file name to a safe path inside analysisDir.
  const safeFilePath = (name) => {
    if (!name) return null;
    const resolved = path.resolve(analysisDir, path.basename(String(name)));
    if (path.dirname(resolved) !== analysisDir) return null; // reject traversal
    return resolved;
  };

  app.get("/local-api/files", (_req, res) => {
    fs.readdir(analysisDir, (err, entries) => {
      if (err) {
        res.status(500).json({ error: `Cannot read folder: ${err.message}`, dir: analysisDir });
        return;
      }
      const files = entries.filter((name) => name.toLowerCase().endsWith(".json")).sort();
      res.json({ dir: analysisDir, files });
    });
  });

  app.get("/analysis", (req, res) => {
    // The selected file name is carried in the `owner` query param.
    const filePath = safeFilePath(req.query.owner);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: "Analysis file not found" });
      return;
    }
    fs.readFile(filePath, "utf-8", (err, content) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      try {
        res.json(JSON.parse(content));
      } catch (parseErr) {
        res.status(500).json({ error: `Invalid JSON in ${req.query.owner}: ${parseErr.message}` });
      }
    });
  });

  app.get("/settings", (req, res) => {
    res.json({
      uuid: "local",
      owner: String(req.query.owner || ""),
      repository: String(req.query.repo || "local"),
      pull_number: Number(req.query.pull_number || 0),
      mainClass: "",
      mainMethod: "",
      baseClass: ""
    });
  });

  // Settings persistence is a no-op in local mode.
  app.post("/settings", (_req, res) => res.json({ ok: true }));
  app.put("/settings", (_req, res) => res.json({ ok: true }));

  return middlewares;
}
