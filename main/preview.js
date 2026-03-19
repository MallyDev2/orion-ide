"use strict";
/**
 * preview.js — lightweight HTTP static server for HTML previews.
 */
const http = require("http");
const fs   = require("fs/promises");
const path = require("path");
const logger = require("./logger");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm":  "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".cjs":  "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".txt":  "text/plain; charset=utf-8",
  ".xml":  "application/xml; charset=utf-8",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
};

const servers = new Map(); // normalizedRoot -> { server, port, url }

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function ensureServer(rootDir) {
  const root = path.resolve(rootDir);
  if (servers.has(root)) return servers.get(root);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const safe = path.normalize(rel).replace(/^(\.\.([/\\]|$))+/, "");
      const abs  = path.join(root, safe.replace(/^[/\\]+/, ""));

      // Path traversal guard
      if (!abs.startsWith(root)) {
        res.writeHead(403); res.end("Forbidden"); return;
      }

      const stat = await fs.stat(abs);
      const target = stat.isDirectory() ? path.join(abs, "index.html") : abs;
      const data = await fs.readFile(target);
      res.writeHead(200, { "Content-Type": contentType(target), "Cache-Control": "no-cache" });
      res.end(data);
    } catch {
      res.writeHead(404); res.end("Not found");
    }
  });

  const info = await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, port: addr.port, url: `http://127.0.0.1:${addr.port}` });
    });
  });

  server.on("close", () => servers.delete(root));
  servers.set(root, info);
  logger.info(`Preview server started on ${info.url} for ${root}`);
  return info;
}

function closeAll() {
  for (const { server } of servers.values()) {
    try { server.close(); } catch { /* ignore */ }
  }
}

module.exports = { ensureServer, closeAll };
