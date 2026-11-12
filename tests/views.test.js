'use strict';
const { test, ok, eq, includes, excludes } = require('./harness');
const { bootAll, freshStore } = require('./helpers');

const App = bootAll();
const U = App.util;

function ctx(snap) {
  return { today: snap.today, params: {}, settings: snap.settings, weekStartKey: snap.weekStartKey };
}

function render(name) {
  const snap = App.derive.snap();
  return App.views[name].render(snap, ctx(snap));
}

test('首页：空数据时显示空状态引导（AC-34）', async () => {
  await freshStore();
  const html = render('home');
  includes(html, 'data-empty="1"');
  includes(html, '今天还没有安排');
});

test('首页：六张摘要卡都在，且不显示假数字', async () => {
  await freshStore();
  const html = render('home');
  ['开发工作', '咨询工作', '自媒体', '健身计划', '饮食计划', '游戏娱乐'].forEach(function (label) {
    includes(html, label, '缺少摘要卡：' + label);
  });
  includes(html, '暂无在做的项目');
  excludes(html, 'NaN');
  excludes(html, 'undefined');
});

test('首页：3 天内截止的项目显示剩余天数并高亮（AC-09）', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await s.put('projects', { name: '校赛 Demo', deadline: U.addDays(T, 3), stage: 'coding' });
  const html = render('home');
  includes(html, '还剩 3 天');
  includes(html, 'sum-card alert');
  includes(html, '校赛 Demo');
});

test('首页：逾期项目显示"已逾期 N 天"（AC-10）', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await s.put('projects', { name: '拖了很久', deadline: U.addDays(T, -2), stage: 'coding' });
  const html = render('home');
  includes(html, '已逾期 2 天');
});

test('首页：备忘显示转任务与丢掉两个动作（AC-15）', async () => {
  const s = await freshStore();
  await s.put('memos', { text: '问一下学长那个渲染问题', state: 'open' });
  const html = render('home');
  includes(html, '问一下学长那个渲染问题');
  includes(html, 'data-act="memo-to-task"');
  includes(html, 'data-act="memo-drop"');
});

test('首页：饮食卡数字与模块计算一致（AC-12）', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  const a = await s.put('foods', { name: '燕麦', kcal: 300, protein: 10, unit: '份' });
  const b = await s.put('foods', { name: '鸡胸饭', kcal: 520, protein: 35, unit: '份' });
  await s.put('meals', { date: T, type: 'breakfast', plan: [], actual: [{ foodId: a.id, qty: 1 }] });
  await s.put('meals', { date: T, type: 'lunch', plan: [], actual: [{ foodId: b.id, qty: 1 }] });
  const html = render('home');
  includes(html, '820 / 1800 kcal');
});

test('首页：页脚显示已保存与今日记录条数', async () => {
  const s = await freshStore();
  await s.put('memos', { text: 'a', state: 'open' });
  const html = render('home');
  includes(html, '数据已保存');
  includes(html, '今天记录了 1 条');
});

test('今日计划：空数据有引导，三个时段都在（AC-34）', async () => {
  await freshStore();
  const html = render('today');
  includes(html, 'data-empty="1"');
  includes(html, '上午');
  includes(html, '下午');
  includes(html, '晚上');
  includes(html, '未安排');
});

test('今日计划：任务出现在对应时段', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await s.put('tasks', { title: '背单词', date: T, slot: 'am', status: 'todo' });
  await s.put('tasks', { title: '跑通联调', date: T, slot: 'pm', status: 'todo' });
  const html = render('today');
  includes(html, '背单词');
  includes(html, '跑通联调');
  includes(html, 'data-drop="slot"');
});

test('今日计划：昨天有未完成时出现提示条（AC-16）', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await s.put('tasks', { title: '昨天没做完', date: U.addDays(T, -1), slot: 'am', status: 'todo' });
  const html = render('today');
  includes(html, '昨天有 1 项未完成');
  includes(html, 'data-act="carry-over"');
});

test('今日计划：完成数与进度条同步', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await s.put('tasks', { title: 'a', date: T, slot: 'am', status: 'done' });
  await s.put('tasks', { title: 'b', date: T, slot: 'am', status: 'todo' });
  const html = render('today');
  includes(html, '完成了 50%');
});

test('所有已实现视图渲染不产生 NaN / undefined', async () => {
  await freshStore();
  ['home', 'today'].forEach(function (name) {
    const html = render(name);
    excludes(html, 'NaN', name + ' 出现 NaN');
    excludes(html, 'undefined', name + ' 出现 undefined');
  });
});
