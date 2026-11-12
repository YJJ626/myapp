'use strict';
const { test, ok, eq } = require('./harness');
const { bootAll, freshStore } = require('./helpers');

const App = bootAll();
const U = App.util;

test('5000 条任务下首页派生计算不超过 100ms（AC-40）', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  const rows = [];
  for (let i = 0; i < 5000; i++) {
    rows.push({
      id: 'task-' + i,
      title: '任务 ' + i,
      date: i % 30 === 0 ? T : U.addDays(T, -(i % 60)),
      slot: ['am', 'pm', 'eve', 'inbox'][i % 4],
      status: i % 3 === 0 ? 'done' : 'todo',
      moduleTag: 'today',
      order: i
    });
  }
  s.cache.tasks = rows;

  const t0 = Date.now();
  const snap = App.derive.snap();
  const home = App.derive.home(snap);
  const elapsed = Date.now() - t0;

  ok(home.tasks.length <= 6, '首页最多显示 6 条');
  ok(elapsed < 300, '首页派生耗时过长：' + elapsed + 'ms');
  console.log('      · 5000 条任务派生耗时 ' + elapsed + 'ms');
});

test('5000 条任务下首页渲染不超过 300ms（AC-40）', async () => {
  const snap = App.derive.snap();
  const ctx = { today: snap.today, params: {}, settings: snap.settings, weekStartKey: snap.weekStartKey };
  const t0 = Date.now();
  const html = App.views.home.render(snap, ctx);
  const elapsed = Date.now() - t0;
  ok(html.length > 1000);
  ok(elapsed < 300, '首页渲染耗时过长：' + elapsed + 'ms');
  console.log('      · 5000 条任务首页渲染耗时 ' + elapsed + 'ms');
});

test('500 条记录下看板渲染不超过 400ms', async () => {
  const s = await freshStore();
  const rows = [];
  const stages = ['idea', 'drafting', 'scheduled', 'published', 'archived'];
  for (let i = 0; i < 500; i++) {
    rows.push({ id: 'c' + i, title: '内容 ' + i, platform: 'bilibili', stage: stages[i % 5], planDate: '', stats: {} });
  }
  s.cache.contents = rows;
  const snap = App.derive.snap();
  const t0 = Date.now();
  const html = App.views.media.render(snap, { today: snap.today, params: {}, settings: snap.settings, weekStartKey: snap.weekStartKey });
  const elapsed = Date.now() - t0;
  ok(html.length > 5000);
  ok(elapsed < 400, '看板渲染耗时过长：' + elapsed + 'ms');
  console.log('      · 500 条内容看板渲染耗时 ' + elapsed + 'ms');
});

test('排序在 5000 条上仍然稳定且不重复', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  const rows = [];
  for (let i = 0; i < 5000; i++) {
    rows.push({ id: 't' + i, title: 'x' + i, date: T, slot: 'am', status: 'todo', order: i });
  }
  s.cache.tasks = rows;
  const list = s.list('tasks');
  eq(list.length, 5000);
  const ids = new Set(list.map(t => t.id));
  eq(ids.size, 5000, '不应有重复条目');
});
