'use strict';
const { test, ok, eq, includes } = require('./harness');
const { bootAll, freshStore } = require('./helpers');

const App = bootAll();
const U = App.util;
const D = App.logic.dev;

function render() {
  const snap = App.derive.snap();
  return App.views.dev.render(snap, { today: snap.today, params: {}, settings: snap.settings, weekStartKey: snap.weekStartKey });
}

test('新建项目：没有名称不创建，有名称则默认需求阶段', async () => {
  const s = await freshStore();
  eq(await D.addProject({ name: '  ' }), null);
  const p = await D.addProject({ name: '校赛 Demo', deadline: '2026-11-20', type: 'contest' });
  eq(p.stage, 'req');
  eq(p.progress, 0);
  eq(p.type, 'contest');
  eq(s.list('projects').length, 1);
});

test('改阶段为完成时进度自动 100', async () => {
  await freshStore();
  const p = await D.addProject({ name: 'x', deadline: '2026-11-20' });
  await D.setStage(p.id, 'done');
  const after = App.store.get('projects', p.id);
  eq(after.stage, 'done');
  eq(after.progress, 100);
});

test('进度被限制在 0-100', async () => {
  await freshStore();
  const p = await D.addProject({ name: 'x', deadline: '2026-11-20' });
  await D.setProgress(p.id, 150);
  eq(App.store.get('projects', p.id).progress, 100);
  await D.setProgress(p.id, -20);
  eq(App.store.get('projects', p.id).progress, 0);
});

test('下一步唯一：设置新的会取消旧的（AC-21）', async () => {
  const s = await freshStore();
  const p = await D.addProject({ name: 'x', deadline: '2026-11-20' });
  await D.addTodo(p.id, '第一步');
  await D.addTodo(p.id, '第二步');
  const todos = s.get('projects', p.id).todos;
  await D.setNextStep(p.id, todos[0].id);
  await D.setNextStep(p.id, todos[1].id);
  const after = s.get('projects', p.id);
  eq(after.todos.filter(t => t.isNext).length, 1, '有且只有一条是下一步');
  eq(after.todos.filter(t => t.isNext)[0].text, '第二步');
  eq(after.nextStep, '第二步');
});

test('待办可以勾选与删除', async () => {
  const s = await freshStore();
  const p = await D.addProject({ name: 'x', deadline: '2026-11-20' });
  await D.addTodo(p.id, 'a');
  const t = s.get('projects', p.id).todos[0];
  await D.toggleTodo(p.id, t.id);
  ok(s.get('projects', p.id).todos[0].done);
  await D.removeTodo(p.id, t.id);
  eq(s.get('projects', p.id).todos.length, 0);
});

test('开发日志：新记录排最前并带日期', async () => {
  const s = await freshStore();
  const p = await D.addProject({ name: 'x', deadline: '2026-11-20' });
  await D.addLog(p.id, '把接口接通了');
  await new Promise(r => setTimeout(r, 5));
  await D.addLog(p.id, '修掉一个空指针');
  const logs = s.get('projects', p.id).logs;
  eq(logs.length, 2);
  eq(logs[0].text, '修掉一个空指针');
  ok(logs[0].date, '应带日期');
});

test('踩坑检索：按问题、原因、解法都能命中且不区分大小写（AC-20）', async () => {
  const s = await freshStore();
  const p = await D.addProject({ name: '校赛', deadline: '2026-11-20' });
  await D.addPitfall(p.id, { problem: 'CORS 报错', cause: 'Missing Header', solution: '加 Access-Control-Allow-Origin' });
  await D.addPitfall(p.id, { problem: '时区差一天', cause: '用了 toISOString', solution: '改成本地日期字符串' });

  eq(D.searchPitfalls(s.list('projects'), 'cors').length, 1);
  eq(D.searchPitfalls(s.list('projects'), 'toISOString').length, 1);
  eq(D.searchPitfalls(s.list('projects'), '时区').length, 1);
  eq(D.searchPitfalls(s.list('projects'), '不存在的词').length, 0);
  eq(D.searchPitfalls(s.list('projects'), '').length, 2);
});

test('踩坑没有问题时不允许保存', async () => {
  await freshStore();
  const p = await D.addProject({ name: 'x', deadline: '2026-11-20' });
  eq(await D.addPitfall(p.id, { problem: '  ' }), null);
  eq(App.store.get('projects', p.id).pitfalls.length, 0);
});

test('daysLeft 按截止日期算', async () => {
  await freshStore();
  const p = await D.addProject({ name: 'x', deadline: '2026-11-20' });
  eq(D.daysLeft(p, '2026-11-17'), 3);
});

test('开发页：无项目显示空状态（AC-34）', async () => {
  await freshStore();
  const html = render();
  includes(html, 'data-empty="1"');
  includes(html, '还没有项目');
});

test('开发页：项目卡显示剩余天数、阶段与下一步', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  const p = await D.addProject({ name: '校赛 Demo', deadline: U.addDays(T, 3) });
  await D.addTodo(p.id, '把联调跑通', true);
  await D.setStage(p.id, 'coding');
  const html = render();
  includes(html, '校赛 Demo');
  includes(html, '还剩 3 天');
  includes(html, '下一步：把联调跑通');
  includes(html, 'ms-step current');
});

test('开发页：逾期显示已逾期', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await s.put('projects', { name: '拖了', deadline: U.addDays(T, -2), stage: 'coding', progress: 20, todos: [], logs: [], pitfalls: [] });
  includes(render(), '已逾期 2 天');
});
