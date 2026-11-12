'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, ok, eq, includes, excludes } = require('./harness');
const { bootAll, ROOT } = require('./helpers');

const App = bootAll();
const APP = path.join(ROOT, 'app');

function read(rel) { return fs.readFileSync(path.join(APP, rel), 'utf8'); }

test('index.html 引用的脚本与样式文件都存在', () => {
  const html = read('index.html');
  const refs = [];
  html.replace(/<script src="([^"]+)"/g, (m, p) => { refs.push(p); return m; });
  html.replace(/<link rel="stylesheet" href="([^"]+)"/g, (m, p) => { refs.push(p); return m; });
  ok(refs.length >= 12, '引用文件数量异常：' + refs.length);
  refs.forEach(function (p) {
    ok(fs.existsSync(path.join(APP, p)), '缺少文件：' + p);
  });
});

test('九个页面视图全部已注册', () => {
  ['home', 'today', 'media', 'dev', 'consult', 'fitness', 'diet', 'games', 'settings'].forEach(function (n) {
    ok(App.views[n] && typeof App.views[n].render === 'function', '视图缺失：' + n);
    ok(App.router.nav.some(function (x) { return x.key === n; }), '导航缺失：' + n);
  });
  eq(App.router.nav.length, 9);
});

test('所有脚本语法可解析', () => {
  const files = [];
  (function walk(dir) {
    fs.readdirSync(dir).forEach(function (f) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (f.endsWith('.js')) files.push(full);
    });
  })(path.join(APP, 'js'));
  files.push(path.join(ROOT, 'server.js'));
  ok(files.length > 15, '脚本数量异常');
  files.forEach(function (f) {
    try {
      execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    } catch (e) {
      throw new Error('语法错误：' + path.relative(ROOT, f) + ' → ' + String(e.stderr || e.message).slice(0, 200));
    }
  });
});

test('应用代码不发任何外部网络请求（AC-07/AC-39）', () => {
  const files = [];
  (function walk(dir) {
    fs.readdirSync(dir).forEach(function (f) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/\.(js|html)$/.test(f)) files.push(full);
    });
  })(APP);
  files.forEach(function (f) {
    const src = fs.readFileSync(f, 'utf8');
    const bad = src.match(/https?:\/\/(?!127\.0\.0\.1|localhost)[a-z0-9.-]+/gi);
    eq(bad, null, path.basename(f) + ' 含外部地址：' + (bad || []).join(','));
  });
});

test('唯一允许的网络调用是本地数据镜像接口', () => {
  const src = read('js/core/db.js');
  includes(src, '/api/data');
  includes(src, 'mirrorAvailable');
  // 没有 fetch 到其它端点
  const calls = src.match(/fetch\('([^']+)'/g) || [];
  calls.forEach(function (c) { includes(c, '/api/data'); });
});

test('所有数据表都在 store 清单里（15 类实体）', () => {
  const need = ['tasks', 'memos', 'contents', 'projects', 'consults', 'answers', 'templates',
    'sessions', 'bodyMetrics', 'meals', 'foods', 'games', 'playSessions', 'wishItems', 'shoppingItems'];
  need.forEach(function (s) { ok(App.db.STORES.indexOf(s) !== -1, '缺少 store：' + s); });
});

test('浅色与深色两套主题变量都齐全（AC-35）', () => {
  const css = read('styles/base.css');
  ok(css.indexOf(':root') !== -1, '缺少浅色变量');
  ok(css.indexOf('html[data-theme="dark"]') !== -1, '缺少深色变量');
  ['--bg', '--surface', '--text', '--text-2', '--border', '--accent'].forEach(function (v) {
    const count = (css.match(new RegExp(v.replace(/-/g, '\\-') + ':', 'g')) || []).length;
    ok(count >= 2, v + ' 在两套主题里都应定义');
  });
});

test('布局无写死的超宽尺寸，且有窄屏适配（AC-33）', () => {
  const css = read('styles/layout.css');
  const widths = (css.match(/^\s*width:\s*\d{4,}px/gm) || []).filter(function (s) {
    return s.indexOf('max-width') === -1;
  });
  eq(widths.length, 0, '发现写死的大宽度：' + widths.join(','));
  includes(css, '@media (max-width: 1100px)');
  includes(css, 'minmax(0, 1fr)');
});

test('空状态组件带 data-empty 标记，便于验收（AC-34）', () => {
  const src = read('js/core/ui.js');
  includes(src, 'data-empty="1"');
});

test('确认词机制存在且按钮默认禁用（AC-08）', () => {
  const src = read('js/core/ui.js');
  includes(src, 'confirmWord');
  includes(src, 'disabled');
  includes(src, 'input.value.trim() !== needWord');
});

test('备份文件名与结构符合 PRD 7.2', async () => {
  const ST = App.logic.settings;
  eq(ST.fileName(new Date(2026, 0, 5, 8, 7)), 'worklife-backup-20260105-0807.json');
  await App.db.useDriver(App.db.createMemoryDriver());
  await App.store.init();
  const payload = App.store.exportPayload();
  ['app', 'version', 'exportedAt', 'settings', 'data'].forEach(function (k) {
    ok(k in payload, '备份缺少字段：' + k);
  });
});

test('星期起始日改变会影响本周视图的起点（AC-36）', async () => {
  await App.db.useDriver(App.db.createMemoryDriver());
  await App.store.init();
  await App.store.setSetting('weekStart', 7);
  const snap = App.derive.snap();
  eq(App.util.weekday(snap.weekStartKey), 7, '设置周日起始后，本周起点应是周日');
  await App.store.setSetting('weekStart', 1);
  const snap2 = App.derive.snap();
  eq(App.util.weekday(snap2.weekStartKey), 1);
});
