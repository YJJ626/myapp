'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = path.join(__dirname, 'app');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'worklife.json');
const START_PORT = Number(process.env.PORT || 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) return send(res, 403, 'forbidden');
  fs.readFile(filePath, (err, buf) => {
    if (err) return send(res, 404, 'not found');
    send(res, 200, buf, MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  });
}

function handleApi(req, res) {
  if (req.method === 'GET') {
    fs.readFile(DATA_FILE, 'utf8', (err, text) => {
      if (err) return send(res, 200, '{}', MIME['.json']);
      send(res, 200, text, MIME['.json']);
    });
    return;
  }
  if (req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 30 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        JSON.parse(body);
      } catch (e) {
        return send(res, 400, JSON.stringify({ error: 'invalid json' }), MIME['.json']);
      }
      fs.mkdir(DATA_DIR, { recursive: true }, () => {
        fs.writeFile(DATA_FILE, body, 'utf8', err => {
          if (err) return send(res, 500, JSON.stringify({ error: err.message }), MIME['.json']);
          send(res, 200, JSON.stringify({ ok: true }), MIME['.json']);
        });
      });
    });
    return;
  }
  send(res, 405, 'method not allowed');
}

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith('/api/data')) return handleApi(req, res);
  if (req.url && req.url.startsWith('/api/ping')) return send(res, 200, 'pong');
  serveStatic(req, res);
});

function listen(port, tries) {
  server.once('error', err => {
    if (err.code === 'EADDRINUSE' && tries > 0) {
      listen(port + 1, tries - 1);
    } else {
      console.error('启动失败：' + err.message);
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    const url = 'http://127.0.0.1:' + port + '/';
    console.log('工作台已启动：' + url);
    console.log('数据目录：' + DATA_DIR);
    console.log('关闭这个窗口即停止服务。');
    if (process.argv.indexOf('--open') !== -1) {
      if (process.platform === 'win32') exec('start "" "' + url + '"');
      else if (process.platform === 'darwin') exec('open "' + url + '"');
    }
  });
}

listen(START_PORT, 10);
