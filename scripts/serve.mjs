import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const root = path.resolve("dist");
const port = Number.parseInt(process.argv[2] ?? "4173", 10);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".proto": "text/plain; charset=utf-8",
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(root, relative);
    if (file !== root && !file.startsWith(root + path.sep)) throw new Error("invalid path");
    const details = await stat(file);
    if (!details.isFile()) throw new Error("not a file");
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log("HorizonSuite API documentation: http://127.0.0.1:" + port);
});
