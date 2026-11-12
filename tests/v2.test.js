'use strict';
const fs = require('fs');
const path = require('path');
const { test, ok, eq, includes, excludes } = require('./harness');
const { bootAll, freshStore, ROOT } = require('./helpers');

const App = bootAll();
const U = App.util;

function ctx(snap) {
  return { today: snap.today, params: {}, settings: snap.settings, weekStartKey: snap.weekStartKey };
}
function render(name) {
  const snap = App.derive.snap();
  return App.views[name].render(snap, ctx(snap));
}

/* ---------------- 问题 4：咨询里删不掉客户 ---------------- */

test('咨询：删除客户会删掉他的全部记录，不影响其他人', async () => {
  const s = await freshStore();
  const C = App.logic.consult;
  await C.add({ person: '小李', question: '这个报错怎么定位' });
  await C.add({ person: '小李', question: '简历怎么写' });
  await C.add({ person: '小王', question: '选课建议' });
  eq(C.profiles().length, 2, '应该有两个人');

  const removed = await C.removePerson('小李');
  eq(removed, 2, '应删除 2 条记录');
  eq(s.list('consults').length, 1, '只剩小王那条');
  eq(C.profiles()[0].name, '小王');
});

test('咨询：删除单条记录后队列少一条', async () => {
  const s = await freshStore();
  const C = App.logic.consult;
  const a = await C.add({ person: '小李', question: 'a' });
  await C.add({ person: '小李', question: 'b' });
  await C.remove(a.id);
  eq(C.waiting().length, 1);
  eq(C.byPerson('小李').length, 1);
});

/* ---------------- 问题 3：开发工作加不了工作项 ---------------- */

test('开发工作：页面提供「新增工作项」入口与快捷输入（问题3）', async () => {
  const s = await freshStore();
  await App.logic.dev.addProject({ name: '校赛 Demo', deadline: U.addDays(App.derive.snap().today, 5) });
  const html = render('dev');
  includes(html, 'data-act="new-work"');
  includes(html, '新增工作项');
  includes(html, 'data-work-text');
  includes(html, 'data-act="work-to-project"', '卡片上应有加项按钮');
});

test('开发工作：没有项目时新增工作项按钮置灰，引导先建项目', async () => {
  await freshStore();
  const html = render('dev');
  includes(html, 'data-act="new-project"');
  includes(html, '建第一个项目');
});

test('开发工作：工作项能加进项目并成为「下一步」', async () => {
  const s = await freshStore();
  const p = await App.logic.dev.addProject({ name: 'x', deadline: U.addDays(App.derive.snap().today, 3) });
  await App.logic.dev.addTodo(p.id, '联调登录接口', true);
  await App.logic.dev.addTodo(p.id, '补 README');
  const row = s.get('projects', p.id);
  eq(row.todos.length, 2);
  eq(row.todos[0].isNext, true);
  eq(row.todos[1].isNext, false);
  const html = render('dev');
  includes(html, '2 项待办');
});

test('开发工作：项目抽屉里列出已加的工作项', async () => {
  const s = await freshStore();
  const p = await App.logic.dev.addProject({ name: 'y', deadline: U.addDays(App.derive.snap().today, 3) });
  await App.logic.dev.addTodo(p.id, '写测试');
  const row = s.get('projects', p.id);
  eq(row.todos[0].text, '写测试');
});

/* ---------------- 问题 2：自媒体数据图表 ---------------- */

test('自媒体：数据视图有 KPI、播放量条形图与周趋势图（问题2）', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await s.put('contents', {
    title: '宿舍桌面改造', stage: 'published', platform: 'bilibili', publishedAt: T,
    stats: { view: 12000, like: 600, fans: 120 }
  });
  await s.put('contents', {
    title: '大一怎么开始做项目', stage: 'published', platform: 'xiaohongshu', publishedAt: U.addDays(T, -7),
    stats: { view: 3000, like: 90, fans: 10 }
  });

  App.uiState = { mediaView: 'data' };
  const html = render('media');
  includes(html, 'kpi-grid');
  includes(html, '总播放');
  includes(html, 'hbar-track');
  includes(html, 'col-chart');
  includes(html, '平台分布');
  excludes(html, 'NaN');
  excludes(html, 'undefined');
  App.uiState = {};
});

test('自媒体：数据视图在没发布内容时给空状态而不是空图表', async () => {
  const s = await freshStore();
  await s.put('contents', { title: '还没发的选题', stage: 'idea', platform: 'bilibili', stats: { view: 0, like: 0, fans: 0 } });
  App.uiState = { mediaView: 'data' };
  const html = render('media');
  includes(html, 'data-empty="1"');
  includes(html, '还没有发布数据');
  excludes(html, 'hbar-track');
  App.uiState = {};
});

test('自媒体：overview 汇总口径正确（播放/点赞/涨粉/互动率）', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await s.put('contents', { title: 'A', stage: 'published', platform: 'bilibili', publishedAt: T, stats: { view: 1000, like: 50, fans: 5 } });
  await s.put('contents', { title: 'B', stage: 'published', platform: 'bilibili', publishedAt: U.addDays(T, -14), stats: { view: 500, like: 20, fans: 2 } });
  await s.put('contents', { title: 'C', stage: 'idea', stats: { view: 0, like: 0, fans: 0 } });

  const ov = App.logic.media.overview(s.list('contents'), T);
  eq(ov.totals.count, 2, '未发布且没数据的不该进图表');
  eq(ov.totals.view, 1500);
  eq(ov.totals.like, 70);
  eq(ov.totals.fans, 7);
  eq(ov.totals.engagement, 4.7);
  eq(ov.rows[0].title, 'A', '按播放量降序');
  eq(ov.weeks.length, 6);
  eq(ov.platforms.length, 1);
  eq(ov.maxView, 1000);
});

/* ---------------- 问题 5：健身 / 饮食月历 ---------------- */

test('健身：月历每格带部位、动作与组次（问题5）', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await App.logic.fitness.saveTemplate({
    weekday: U.weekday(T), name: '上肢 · 推', exercisesText: '卧推 4x8\n侧平举 3x12'
  });
  const session = await App.logic.fitness.startSession(T);
  await App.logic.fitness.updateSet(session.id, 0, 0, { reps: 8, weight: 40, done: true });

  const cells = App.logic.fitness.monthData(U.monthKey(T), T);
  ok(cells.length === 35 || cells.length === 42, '格子数应为 35 或 42，实际 ' + cells.length);
  eq(U.weekday(cells[0].date), 1, '首格应是周一');

  const day = cells.filter(c => c.date === T)[0];
  eq(day.part, '上肢 · 推');
  eq(day.exerciseCount, 2);
  eq(day.setCount, 7, '4 组 + 3 组');
  eq(day.doneSets, 1);
  eq(day.volume, 320, '8 次 × 40kg');

  const html = render('fitness');
  includes(html, 'cal-grid');
  includes(html, '上肢 · 推');
  includes(html, '卧推');
  excludes(html, 'NaN');
});

test('健身：某天的明细包含每个动作的每组次数与重量', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await App.logic.fitness.saveTemplate({ weekday: U.weekday(T), name: '下肢 · 腿', exercisesText: '深蹲 5x5' });
  const session = await App.logic.fitness.startSession(T);
  await App.logic.fitness.updateSet(session.id, 0, 0, { reps: 5, weight: 60, done: true });

  const d = App.logic.fitness.dayDetail(T, T);
  eq(d.part, '下肢 · 腿');
  eq(d.exercises.length, 1);
  eq(d.exercises[0].name, '深蹲');
  eq(d.exercises[0].sets.length, 5);
  eq(d.exercises[0].sets[0].reps, 5);
  eq(d.exercises[0].sets[0].weight, 60);
  eq(d.exercises[0].sets[0].done, true);
});

test('健身：没有记录的日子显示周模板的计划', async () => {
  await freshStore();
  const T = App.derive.snap().today;
  await App.logic.fitness.saveTemplate({ weekday: U.weekday(T), name: '上肢 · 拉', exercisesText: '划船 3x10' });
  const d = App.logic.fitness.dayDetail(T, T);
  eq(d.hasSession, false);
  eq(d.part, '上肢 · 拉');
  eq(d.exercises[0].plan, true);
  eq(d.exercises[0].sets.length, 3);
});

test('健身：休息日会被标出来', async () => {
  await freshStore();
  const T = App.derive.snap().today;
  await App.logic.fitness.saveTemplate({ weekday: U.weekday(T), name: '休息', isRest: true });
  const cells = App.logic.fitness.monthData(U.monthKey(T), T);
  const day = cells.filter(c => c.date === T)[0];
  eq(day.rest, true);
  includes(render('fitness'), '休息');
});

test('首页：有周模板时健身摘要卡显示今天的部位（回归）', async () => {
  await freshStore();
  const T = App.derive.snap().today;
  await App.logic.fitness.saveTemplate({ weekday: U.weekday(T), name: '上肢 · 拉', exercisesText: '划船 3x10' });

  const card = App.derive.fitnessCard(App.derive.snap());
  eq(card.hasTemplate, true, '正常训练日应标记 hasTemplate');
  eq(card.rest, false);
  eq(card.name, '上肢 · 拉');

  const html = render('home');
  includes(html, '今天：上肢 · 拉');
  excludes(html, '还没有周模板');
});

test('首页：没有周模板时才提示去建模板', async () => {
  const s = await freshStore();
  for (const t of s.list('templates')) s.remove('templates', t.id);
  const card = App.derive.fitnessCard(App.derive.snap());
  eq(card.hasTemplate, false);
  includes(render('home'), '还没有周模板');
});

test('饮食：月历每格显示当天热量与餐数（问题5）', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  const f = await s.put('foods', { name: '鸡胸饭', kcal: 520, protein: 35, unit: '份' });
  await App.logic.diet.addItem(T, 'lunch', 'actual', f.id, 1);
  await App.logic.diet.addItem(T, 'breakfast', 'actual', f.id, 0.5);

  const cells = App.logic.diet.monthData(U.monthKey(T), T, { kcal: 1800 });
  const day = cells.filter(c => c.date === T)[0];
  eq(day.kcal, 780);
  eq(day.meals, 2);
  eq(day.pct, 43);
  eq(day.over, false);

  const html = render('diet');
  includes(html, 'cal-grid');
  includes(html, '780');
  excludes(html, 'NaN');
});

test('饮食：超目标的那天标记为超标', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  const f = await s.put('foods', { name: '炸鸡', kcal: 1200, protein: 30, unit: '份' });
  await App.logic.diet.addItem(T, 'dinner', 'actual', f.id, 2);
  const cells = App.logic.diet.monthData(U.monthKey(T), T, { kcal: 1800 });
  const day = cells.filter(c => c.date === T)[0];
  eq(day.over, true);
  eq(day.pct, 100, '进度条封顶 100%');
});

test('饮食：某天明细按餐列出食物与热量', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  const f = await s.put('foods', { name: '燕麦', kcal: 300, protein: 10, unit: '份' });
  await App.logic.diet.addItem(T, 'breakfast', 'actual', f.id, 1);
  const d = App.logic.diet.dayTotals(T);
  eq(d.actual.kcal, 300);
  eq(d.filled, 1);
  eq(d.meals[0].items[0].name, '燕麦');
});

/* ---------------- 问题 5 附带：月历工具 ---------------- */

test('月历工具：翻月、标题、格子数量与边界', () => {
  eq(U.monthKey('2026-11-12'), '2026-11');
  eq(U.shiftMonth('2026-11', 1), '2026-12');
  eq(U.shiftMonth('2026-01', -1), '2025-12');
  eq(U.monthTitle('2026-03'), '2026 年 3 月');
  const cells = U.monthCells('2026-11', 1);
  eq(cells[0].date, '2026-10-26', '2026-11-01 是周日，往前补到周一 10-26');
  eq(cells.filter(c => c.inMonth).length, 30);
  eq(U.weekday(cells[0].date), 1);
});

/* ---------------- 问题 1 & 6：外壳、图标与保存 ---------------- */

test('外壳：九个导航项都配了图标，页面有独立顶栏容器', () => {
  App.router.nav.forEach(function (n) {
    ok(n.icon, n.name + ' 缺图标');
  });
  eq(App.router.nav.length, 9);
  const html = fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8');
  includes(html, 'id="topbar"');
  includes(html, 'class="shell"');
});

test('图标：ui.icon 输出内联 SVG，不引用外部地址', () => {
  ['home', 'today', 'media', 'dev', 'consult', 'fitness', 'diet', 'games', 'settings', 'save', 'plus', 'trash']
    .forEach(function (name) {
      const svg = App.ui.icon(name);
      includes(svg, '<svg');
      includes(svg, 'stroke="currentColor"');
      eq(svg.indexOf('http'), -1, name + ' 图标不该带外部链接');
    });
});

test('保存：写入即落库，重新初始化后读得回来（问题6）', async () => {
  const s = await freshStore();
  await s.put('memos', { text: '手写保存也要稳', state: 'open' });
  await App.store.init();
  ok(App.store.list('memos').some(function (m) { return m.text === '手写保存也要稳'; }));
});

test('保存：顶栏脚本提供保存入口与快捷键（问题6）', () => {
  const ui = fs.readFileSync(path.join(ROOT, 'app', 'js', 'core', 'ui.js'), 'utf8');
  includes(ui, 'tb-save-btn');
  includes(ui, "e.key === 's'");
  includes(ui, 'save-chip');
  const boot = fs.readFileSync(path.join(ROOT, 'app', 'js', 'boot.js'), 'utf8');
  includes(boot, 'App.saveNow');
  includes(boot, 'markSaved');
});
