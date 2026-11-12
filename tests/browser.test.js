'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const { JSDOM, VirtualConsole } = require('jsdom');
const { test, ok, eq, includes } = require('./harness');

const ROOT = path.join(__dirname, '..', 'app');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };

const errors = [];
let dom, win, doc, booted = false, server = null, bootMs = 0;

function startServer() {
  return new Promise(function (resolve) {
    server = http.createServer(function (req, res) {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(file, function (err, buf) {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': (MIME[path.extname(file)] || 'text/plain') + '; charset=utf-8' });
        res.end(buf);
      });
    });
    server.listen(0, '127.0.0.1', function () { resolve(server.address().port); });
  });
}

function wait(fn, timeout) {
  const limit = timeout || 5000;
  return new Promise(function (resolve, reject) {
    const t0 = Date.now();
    const timer = setInterval(function () {
      let v = null;
      try { v = fn(); } catch (e) { }
      if (v) { clearInterval(timer); resolve(v); return; }
      if (Date.now() - t0 > limit) { clearInterval(timer); reject(new Error('等待超时')); }
    }, 20);
  });
}

async function boot() {
  if (booted) return;
  const t0 = Date.now();
  const port = await startServer();
  const vc = new VirtualConsole();
  vc.on('jsdomError', function (e) { errors.push(e.message); });
  vc.on('error', function (m) { errors.push(String(m)); });

  dom = await JSDOM.fromURL('http://127.0.0.1:' + port + '/index.html', {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  win = dom.window;
  doc = win.document;
  win.scrollTo = function () { };
  win.addEventListener('error', function (e) { errors.push('window.onerror: ' + e.message); });
  await new Promise(function (resolve) {
    if (doc.readyState === 'complete') resolve();
    else win.addEventListener('load', resolve, { once: true });
  });
  await wait(function () {
    return win.App && win.App.router && win.App.router.views && doc.querySelectorAll('.nav-item').length === 9;
  });
  bootMs = Date.now() - t0;
  booted = true;
}

function go(route) {
  win.location.hash = '#/' + route;
  return wait(function () {
    return win.App.router.current === route && doc.getElementById('main').innerHTML.length > 80;
  });
}

function key(el, name, extra) {
  const ev = new win.KeyboardEvent('keydown', Object.assign({ key: name, bubbles: true }, extra || {}));
  el.dispatchEvent(ev);
  return ev;
}

function click(el) {
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
}

function lastDrawer() {
  const all = doc.querySelectorAll('.drawer');
  return all.length ? all[all.length - 1] : null;
}
function resetLayers() {
  try { win.App.ui.closeAll(); } catch (e) { }
  Array.from(doc.querySelectorAll('.drawer, .drawer-mask, .modal-mask, .quick')).forEach(function (el) { el.remove(); });
}


test('浏览器启动：导航九项齐全，首页有内容（AC-38）', async () => {
  await boot();
  const navs = Array.from(doc.querySelectorAll('.nav-item')).map(n => n.textContent.trim());
  eq(navs.length, 9);
  includes(navs.join(','), '首页');
  includes(navs.join(','), '数据与设置');
  ok(doc.getElementById('main').innerHTML.length > 200, '首页应有内容');
  eq(errors.length, 0, '启动不应有脚本错误：' + errors.join(' | '));
});

test('浏览器启动：无 indexedDB 时降级到 localStorage（AC-02 基础）', async () => {
  await boot();
  eq(win.App.db.driverName, 'ls');
});

test('浏览器路由：点击导航切换页面并更新 hash', async () => {
  await boot();
  click(doc.querySelector('[data-route="today"]'));
  await wait(function () { return win.App.router.current === 'today'; });
  includes(win.location.hash, '/today');
  includes(doc.getElementById('main').innerHTML, '今日计划');
});

test('浏览器 ⌘K：任意页呼出快速记录并回车入库（AC-31）', async () => {
  await boot();
  await go('dev');
  key(doc.body, 'k', { ctrlKey: true });
  const box = doc.querySelector('.quick');
  ok(box, '应出现快速记录浮层');
  const input = box.querySelector('input');
  input.value = '明天问学长渲染问题';
  key(input, 'Enter');
  await wait(function () { return win.App.store.list('memos').some(m => m.text === '明天问学长渲染问题'); });
  eq(input.value, '', '保存后输入框应清空');
  key(input, 'Escape');
  await wait(function () { return !doc.querySelector('.quick'); });
});

test('浏览器 Esc：抽屉可关闭且不留遮罩（AC-32）', async () => {
  await boot();
  await go('today');
  click(doc.querySelector('[data-act="open-review"]'));
  await wait(function () { return doc.querySelector('.drawer'); });
  ok(doc.querySelector('.drawer-mask'), '应有遮罩');
  key(doc.body, 'Escape');
  await wait(function () { return !doc.querySelector('.drawer'); });
  ok(!doc.querySelector('.drawer-mask'), '遮罩也应移除');
});

test('浏览器联动：新建项目后首页立即显示剩余天数（AC-09/AC-13）', async () => {
  await boot();
  const T = win.App.derive.snap().today;
  await win.App.logic.dev.addProject({ name: '校赛 Demo', deadline: win.App.util.addDays(T, 3) });
  await go('home');
  win.App.refresh();
  await wait(function () { return doc.getElementById('main').innerHTML.indexOf('还剩 3 天') !== -1; });
  includes(doc.getElementById('main').innerHTML, '校赛 Demo');
});

test('浏览器首页：点摘要卡跳到对应模块（AC-14）', async () => {
  await boot();
  await go('home');
  click(doc.querySelector('[data-act="jump"][data-to="consult"]'));
  await wait(function () { return win.App.router.current === 'consult'; });
  includes(win.location.hash, 'consult');
});

test('浏览器今日计划：输入框回车即加任务（AC-01）', async () => {
  await boot();
  await go('today');
  const input = doc.querySelector('[data-enter="add-task"][data-slot="am"]');
  input.value = '把 Demo 跑通';
  key(input, 'Enter');
  await wait(function () {
    return win.App.store.list('tasks').some(t => t.title === '把 Demo 跑通' && t.slot === 'am');
  });
  await wait(function () { return doc.getElementById('main').innerHTML.indexOf('把 Demo 跑通') !== -1; });
});

test('浏览器今日计划：勾选后首页完成数同步（AC-13）', async () => {
  await boot();
  await go('today');
  const check = doc.querySelector('[data-act="toggle"]');
  ok(check, '应有可勾选的任务');
  const id = check.getAttribute('data-id');
  click(check);
  await wait(function () { return win.App.store.get('tasks', id).status === 'done'; });
});

test('浏览器主题：点深色后 html 属性与设置同步（AC-35）', async () => {
  await boot();
  await win.App.logic.settings.setTheme('light');
  await go('settings');
  eq(doc.documentElement.getAttribute('data-theme'), 'light');
  click(doc.querySelector('[data-act="theme"][data-key="dark"]'));
  await wait(function () { return doc.documentElement.getAttribute('data-theme') === 'dark'; });
  eq(win.App.store.settings.theme, 'dark');
  await wait(function () { return win.App.store.settings.theme === 'dark'; });
  await win.App.logic.settings.setTheme('light');
  doc.documentElement.setAttribute('data-theme', 'light');
});

test('浏览器九页巡检：都能渲染且无脚本错误（AC-34/AC-35）', async () => {
  await boot();
  const routes = ['home', 'today', 'media', 'dev', 'consult', 'fitness', 'diet', 'games', 'settings'];
  for (const r of routes) {
    await go(r);
    const html = doc.getElementById('main').innerHTML;
    ok(html.length > 80, r + ' 内容过少');
    eq(html.indexOf('undefined'), -1, r + ' 出现 undefined');
    eq(html.indexOf('NaN'), -1, r + ' 出现 NaN');
    ok(doc.querySelector('.nav-item.active'), r + ' 导航未高亮');
  }
  eq(errors.length, 0, '巡检期间不应有脚本错误：' + errors.join(' | '));
});

test('浏览器刷新：数据写入 localStorage 且重新初始化后仍在（AC-01/AC-02）', async () => {
  await boot();
  await win.App.logic.today.captureMemo('刷新也要在');
  const before = win.App.store.list('memos').length;
  ok(before >= 1);
  const stored = win.localStorage.getItem('worklife/v1/memos');
  ok(stored && stored.indexOf('刷新也要在') !== -1, 'localStorage 里应有这条备忘');
  await win.App.store.init();
  eq(win.App.store.list('memos').length, before);
});

test('浏览器看板：拖到"写作中"后状态落库（AC-18 端到端）', async () => {
  await boot();
  const created = await win.App.logic.media.add({ title: '拖拽测试稿' });
  await go('media');
  await wait(function () { return doc.querySelector('[data-drag-id="' + created.id + '"]'); });
  const card = doc.querySelector('[data-drag-id="' + created.id + '"]');
  const zone = doc.querySelector('[data-drop="col"][data-stage="drafting"]');
  ok(card && zone, '卡片与目标列都应存在');
  const ev = new win.Event('drop', { bubbles: true });
  ev.dataTransfer = { getData: function () { return created.id; }, dropEffect: '' };
  zone.dispatchEvent(ev);
  await wait(function () { return win.App.store.get('contents', created.id).stage === 'drafting'; });
});

test('浏览器清空确认：不输确认词按钮不可用（AC-08）', async () => {
  await boot();
  await go('settings');
  doc.querySelector('[data-act="clear-all"]').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(function () { return doc.querySelector('.modal'); });
  const okBtn = doc.querySelector('[data-ok]');
  const input = doc.querySelector('[data-word]');
  ok(input, '应要求输入确认词');
  eq(okBtn.disabled, true, '未输入时按钮应禁用');
  input.value = '随便写点';
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  eq(okBtn.disabled, true, '词不对时仍禁用');
  input.value = '清空全部';
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  eq(okBtn.disabled, false, '词正确后应可用');
  doc.querySelector('[data-cancel]').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(function () { return !doc.querySelector('.modal'); });
  ok(doc.querySelector('.nav-item'), '取消后页面仍在');
});

test('浏览器重启：关掉页面重开，数据还在（AC-03）', async () => {
  const shared = new Map();
  const ls = {
    getItem: k => (shared.has(k) ? shared.get(k) : null),
    setItem: (k, v) => shared.set(k, String(v)),
    removeItem: k => shared.delete(k),
    clear: () => shared.clear(),
    key: i => Array.from(shared.keys())[i] || null,
    get length() { return shared.size; }
  };
  const port = await startServer();
  const vc = new VirtualConsole();
  vc.on('jsdomError', function () { });

  async function openApp() {
    const d = await JSDOM.fromURL('http://127.0.0.1:' + port + '/index.html', {
      runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
      beforeParse: function (w) {
        Object.defineProperty(w, 'localStorage', { value: ls, configurable: true });
        w.scrollTo = function () { };
      }
    });
    await new Promise(function (r) {
      if (d.window.document.readyState === 'complete') r();
      else d.window.addEventListener('load', r, { once: true });
    });
    await new Promise(function (r) { setTimeout(r, 120); });
    return d;
  }

  const first = await openApp();
  await first.window.App.logic.today.captureMemo('重启后要看见我');
  await first.window.App.logic.dev.addProject({ name: '持久项目', deadline: first.window.App.util.addDays(first.window.App.derive.snap().today, 5) });
  first.window.close();

  const second = await openApp();
  const memos = second.window.App.store.list('memos');
  ok(memos.some(function (m) { return m.text === '重启后要看见我'; }), '备忘应仍在');
  const projects = second.window.App.store.list('projects');
  eq(projects.length, 1, '项目应仍在');
  includes(second.window.document.getElementById('main').innerHTML, '还剩 5 天');
  second.window.close();
});

test('浏览器备忘：点转任务后进未安排区并从备忘消失（AC-15）', async () => {
  await boot();
  await win.App.logic.today.captureMemo('把报名表交了');
  await go('home');
  await wait(function () { return doc.querySelector('[data-act="memo-to-task"]'); });
  const memoRow = Array.from(doc.querySelectorAll('.list-row')).filter(function (r) {
    return r.textContent.indexOf('把报名表交了') !== -1;
  })[0];
  memoRow.querySelector('[data-act="memo-to-task"]').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(function () {
    return win.App.store.list('tasks').some(function (t) { return t.title === '把报名表交了' && t.slot === 'inbox'; });
  });
  await go('home');
  const stillMemo = win.App.store.list('memos').filter(function (m) { return m.text === '把报名表交了' && m.state === 'open'; });
  eq(stillMemo.length, 0, '备忘应被处理掉');
});

test('浏览器自媒体：灵感速记回车即进选题池（AC-19）', async () => {
  await boot();
  await go('media');
  const input = doc.querySelector('[data-enter="idea"]');
  input.value = '宿舍桌面改造';
  input.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await wait(function () {
    return win.App.store.list('contents').some(function (c) { return c.title === '宿舍桌面改造' && c.stage === 'idea'; });
  });
  await wait(function () { return doc.getElementById('main').innerHTML.indexOf('宿舍桌面改造') !== -1; });
});

test('浏览器启动耗时在 2 秒内（AC-38）', async () => {
  await boot();
  ok(bootMs > 0 && bootMs < 2000, '启动超过 2 秒：' + bootMs + 'ms');
  console.log('      · 本次（jsdom）启动耗时 ' + bootMs + 'ms');
});

/* ---------------- 本轮六项改动的端到端验证 ---------------- */

test('浏览器保存：点顶栏「保存」按钮立即落盘并提示（问题6）', async () => {
  await boot();
  resetLayers();
  await go('home');
  ok(doc.querySelector('#tb-save'), '顶栏应有保存状态');
  const btn = doc.querySelector('#tb-save-btn');
  ok(btn, '顶栏应有保存按钮');
  click(btn);
  await wait(function () { return doc.querySelector('.toast'); });
  includes(doc.querySelector('.toast').textContent, '已保存');
  await wait(function () { return /已保存/.test(doc.querySelector('#tb-save-text').textContent); });
});

test('浏览器保存：Ctrl+S 也能保存（问题6）', async () => {
  await boot();
  resetLayers();
  await go('today');
  key(doc.body, 's', { ctrlKey: true });
  await wait(function () { return doc.querySelector('.toast'); });
  includes(doc.querySelector('.toast').textContent, '已保存');
});

test('浏览器开发：快捷输入回车即加进项目（问题3）', async () => {
  await boot();
  resetLayers();
  const p = await win.App.logic.dev.addProject({
    name: '联调项目', deadline: win.App.util.addDays(win.App.derive.snap().today, 5)
  });
  win.App.refresh();
  await go('dev');
  const input = doc.querySelector('[data-work-text]');
  ok(input, '开发页应有快捷输入框');
  const sel = doc.querySelector('[data-work-project]');
  sel.value = p.id;
  input.value = '把登录接口联调完';
  key(input, 'Enter');
  await wait(function () { return win.App.store.get('projects', p.id).todos.length === 1; });
  eq(win.App.store.get('projects', p.id).todos[0].text, '把登录接口联调完');
});

test('浏览器开发：项目卡片上的「加项」能打开新增工作项（问题3）', async () => {
  await boot();
  resetLayers();
  const p = await win.App.logic.dev.addProject({
    name: '卡片加项', deadline: win.App.util.addDays(win.App.derive.snap().today, 4)
  });
  win.App.refresh();
  await go('dev');
  click(doc.querySelector('[data-act="work-to-project"][data-id="' + p.id + '"]'));
  await wait(function () { return doc.querySelector('.drawer'); });
  const d1 = lastDrawer();
  includes(d1.querySelector('.drawer-head').textContent, '新增工作项');
  const ta = d1.querySelector('[data-items]');
  ta.value = '截图存档\n补 README';
  click(doc.querySelector('[data-save]'));
  await wait(function () { return win.App.store.get('projects', p.id).todos.length === 2; });
});

test('浏览器咨询：删除客户后他的记录一起消失（问题4）', async () => {
  await boot();
  resetLayers();
  const C = win.App.logic.consult;
  await C.add({ person: '要被删的人', question: '这条记录应该被删掉' });
  win.App.refresh();
  await go('consult');
  click(doc.querySelector('[data-act="open-person"]'));
  await wait(function () { return doc.querySelector('.drawer'); });
  click(lastDrawer().querySelector('[data-del-person]'));
  await wait(function () { return doc.querySelector('.modal'); });
  click(doc.querySelector('.modal [data-ok]'));
  await wait(function () { return C.byPerson('要被删的人').length === 0; });
  ok(!doc.querySelector('.drawer'), '删除后抽屉应关闭');
});

test('浏览器自媒体：切到「数据」出现图表（问题2）', async () => {
  await boot();
  resetLayers();
  const c = await win.App.logic.media.add({ title: '图表稿', platform: 'bilibili', stage: 'published' });
  await win.App.logic.media.setStats(c.id, { view: 8800, like: 320, fans: 40 });
  win.App.refresh();
  await go('media');
  click(doc.querySelector('[data-act="switch-view"][data-key="data"]'));
  await wait(function () { return doc.querySelector('.col-chart'); });
  ok(doc.querySelector('.kpi-grid'), '应有 KPI 区');
  ok(doc.querySelector('.hbar-track'), '应有条形图');
  includes(doc.getElementById('main').innerHTML, '8800');
});

test('浏览器健身：点月历里的一天能看组次（问题5）', async () => {
  await boot();
  resetLayers();
  const T = win.App.derive.snap().today;
  await win.App.logic.fitness.saveTemplate({
    weekday: win.App.util.weekday(T), name: '上肢 · 推', exercisesText: '卧推 4x8'
  });
  const sess = await win.App.logic.fitness.startSession(T);
  await win.App.logic.fitness.updateSet(sess.id, 0, 0, { reps: 8, weight: 40, done: true });
  win.App.refresh();
  await go('fitness');
  const cell = doc.querySelector('[data-act="fit-day"][data-date="' + T + '"]');
  ok(cell, '月历里应能找到今天');
  click(cell);
  await wait(function () { return doc.querySelector('.drawer'); });
  const text = lastDrawer().textContent;
  includes(text, '卧推');
  includes(text, '@40kg');
  includes(text, '上肢 · 推');
});

test('浏览器饮食：点月历里的一天能看到当天食物（问题5）', async () => {
  await boot();
  resetLayers();
  const T = win.App.derive.snap().today;
  const f = await win.App.store.put('foods', { name: '鸡胸饭', kcal: 520, protein: 35, unit: '份' });
  await win.App.logic.diet.addItem(T, 'lunch', 'actual', f.id, 1);
  win.App.refresh();
  await go('diet');
  const cell = doc.querySelector('[data-act="diet-day"][data-date="' + T + '"]');
  ok(cell, '月历里应能找到今天');
  click(cell);
  await wait(function () { return doc.querySelector('.drawer'); });
  const dt = lastDrawer().textContent;
  includes(dt, '鸡胸饭');
  includes(dt, '520');
});

test('浏览器日历：翻到上个月再回来（问题5）', async () => {
  await boot();
  resetLayers();
  await go('fitness');
  const title = doc.querySelector('.cal-title').textContent;
  click(doc.querySelector('[data-act="fit-month"][data-delta="-1"]'));
  await wait(function () { return doc.querySelector('.cal-title').textContent !== title; });
  const prev = doc.querySelector('.cal-title').textContent;
  click(doc.querySelector('[data-act="fit-month"][data-delta="0"]'));
  await wait(function () { return doc.querySelector('.cal-title').textContent === title; });
  ok(prev !== title, '应能翻到上个月');
});
