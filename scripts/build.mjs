import { copyFile, cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const assets = path.join(dist, "assets");
const openapi = path.join(dist, "openapi");
const swagger = path.join(root, "node_modules", "swagger-ui-dist");

await Promise.all([
  mkdir(assets, { recursive: true }),
  mkdir(openapi, { recursive: true }),
]);

await Promise.all([
  copyFile(path.join(root, "src", "index.html"), path.join(dist, "index.html")),
  copyFile(path.join(root, "src", "assets", "app.js"), path.join(assets, "app.js")),
  copyFile(path.join(root, "src", "assets", "styles.css"), path.join(assets, "styles.css")),
  copyFile(path.join(swagger, "swagger-ui.css"), path.join(assets, "swagger-ui.css")),
  copyFile(path.join(swagger, "swagger-ui-bundle.js"), path.join(assets, "swagger-ui-bundle.js")),
  copyFile(path.join(swagger, "swagger-ui-standalone-preset.js"), path.join(assets, "swagger-ui-standalone-preset.js")),
  copyFile(path.join(swagger, "oauth2-redirect.html"), path.join(dist, "oauth2-redirect.html")),
  copyFile(path.join(swagger, "favicon-32x32.png"), path.join(assets, "favicon.png")),
  copyFile(path.join(root, "generated", "api.json"), path.join(openapi, "api.json")),
  copyFile(path.join(root, "generated", "auth.json"), path.join(openapi, "auth.json")),
  cp(path.join(root, "proto"), path.join(dist, "proto"), { recursive: true }),
  writeFile(path.join(dist, ".nojekyll"), "", "utf8"),
]);

console.log("Built GitHub Pages site in dist/");
