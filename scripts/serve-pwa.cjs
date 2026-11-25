// Minimal static server for trying the PWA locally: `npm run serve` then open http://localhost:8080 (localhost counts as a secure origin).
// For a real phone you need HTTPS hosting (GitHub Pages workflow included) because browsers only install PWAs from secure origins.
const http = require('http'); const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '../www'); const port = Number(process.env.PORT || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
function serve(port) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
      const f = path.normalize(path.join(root, p));
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
    });
    srv.listen(port, () => resolve(srv));
  });
}
module.exports = { serve };
if (require.main === module) serve(port).then(() => console.log('Site Inspector PWA: http://localhost:' + port));
