'use strict';
const { test, ok, eq, includes, excludes } = require('./harness');
const { bootAll, freshStore } = require('./helpers');

const App = bootAll();
const U = App.util;
const ST = App.logic.settings;

function render() {
  const snap = App.derive.snap();
  return App.views.settings.render(snap, { today: snap.today, params: {}, settings: snap.settings, weekStartKey: snap.weekStartKey });
}

test('解析备份：非法 JSON 给出明确错误（AC-06）', () => {
  const r = ST.parseBackup('{ 坏掉的');
  eq(r.ok, false);
  includes(r.error, 'JSON');
});

test('解析备份：非本应用的文件被拒绝', () => {
  eq(ST.parseBackup(JSON.stringify({ app: 'other', version: 1, data: {} })).ok, false);
  eq(ST.parseBackup(JSON.stringify({ app: 'worklife', data: {} })).ok, false);
  eq(ST.parseBackup(JSON.stringify({ app: 'worklife', version: 1, data: { tasks: 'x' } })).ok, false);
});

test('解析备份：正常文件通过并可用于导入（AC-04）', async () => {
  const s = await freshStore();
  await s.put('tasks', { title: '任务', date: '2026-11-12', slot: 'am' });
  const text = JSON.stringify(s.exportPayload());
  const parsed = ST.parseBackup(text);
  eq(parsed.ok, true);
  eq(parsed.payload.data.tasks.length, 1);
});

test('主题切换：非法值回落为浅色', async () => {
  await freshStore();
  await ST.setTheme('neon');
  eq(App.store.settings.theme, 'light');
  await ST.setTheme('dark');
  eq(App.store.settings.theme, 'dark');
});

test('每周起始日限制在 1-7', async () => {
  await freshStore();
  await ST.setWeekStart(9);
  eq(App.store.settings.weekStart, 7);
  await ST.setWeekStart(0);
  eq(App.store.settings.weekStart, 1);
});

test('凌晨 4 点开关限制在 0-6', async () => {
  await freshStore();
  await ST.setCutoff(0);
  eq(App.store.settings.dayCutoffHour, 0);
  await ST.setCutoff(9);
  eq(App.store.settings.dayCutoffHour, 6);
});

test('目标值写入 settings.goals', async () => {
  await freshStore();
  await ST.setGoal('kcal', 2000);
  await ST.setGoal('protein', 130);
  eq(App.store.settings.goals.kcal, 2000);
  eq(App.store.settings.goals.protein, 130);
});

test('连续记录天数：连续三天有完成任务即为 3（含今天）', async () => {
  await freshStore();
  const T = '2026-11-12';
  const tasks = [
    { date: T, status: 'done' },
    { date: U.addDays(T, -1), status: 'done' },
    { date: U.addDays(T, -2), status: 'done' },
    { date: U.addDays(T, -4), status: 'done' }
  ];
  eq(ST.streak(T, tasks), 3);
});

test('连续记录：今天还没做时从昨天开始算', async () => {
  await freshStore();
  const T = '2026-11-12';
  const tasks = [
    { date: U.addDays(T, -1), status: 'done' },
    { date: U.addDays(T, -2), status: 'done' }
  ];
  eq(ST.streak(T, tasks), 2);
});

test('连续记录：断档后归零', async () => {
  await freshStore();
  eq(ST.streak('2026-11-12', [{ date: '2026-11-09', status: 'done' }]), 0);
});

test('本周完成率只算本周且排除放弃项', async () => {
  await freshStore();
  const week = U.weekDays('2026-11-09');
  const tasks = [
    { date: week[0], status: 'done' },
    { date: week[1], status: 'todo' },
    { date: week[2], status: 'dropped' },
    { date: U.addDays(week[0], 8), status: 'done' }
  ];
  const r = ST.weekRate(tasks, '2026-11-09');
  eq(r.done, 1);
  eq(r.total, 2);
  eq(r.pct, 50);
});

test('备份文件名带日期与时间', () => {
  const name = ST.fileName(new Date(2026, 10, 12, 9, 5));
  eq(name, 'worklife-backup-20261112-0905.json');
});

test('清空单个模块只影响该模块', async () => {
  const s = await freshStore();
  await s.put('tasks', { title: 'a', date: '2026-11-12', slot: 'am' });
  await s.put('memos', { text: 'b' });
  await ST.clearModule('tasks');
  eq(s.list('tasks').length, 0);
  eq(s.list('memos').length, 1, '其它模块不受影响');
});

test('设置页：显示导出、导入、危险区与存储方式', async () => {
  await freshStore();
  const html = render();
  ['数据与设置', '导出备份', '导入并合并', '导入并覆盖', '危险区', '清空全部数据'].forEach(function (t) {
    includes(html, t, '缺少：' + t);
  });
  excludes(html, 'NaN');
});

test('设置页：从未备份时提示超过 30 天', async () => {
  await freshStore();
  includes(render(), '超过 30 天没备份');
});

test('设置页：备份后提示上次备份时间', async () => {
  await freshStore();
  await ST.markBackedUp();
  const html = render();
  includes(html, '上次备份');
  excludes(html, '超过 30 天没备份');
});

test('设置页：主题分段控件反映当前主题', async () => {
  await freshStore();
  await ST.setTheme('dark');
  includes(render(), 'data-key="dark"');
});

test('设置页：数据显示各模块条目数', async () => {
  const s = await freshStore();
  await s.put('tasks', { title: 'a', date: '2026-11-12', slot: 'am' });
  await s.put('projects', { name: 'p', deadline: '2026-11-20', stage: 'coding' });
  const html = render();
  includes(html, '任务');
  includes(html, '项目');
  includes(html, '总条目');
});
