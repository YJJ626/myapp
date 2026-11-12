'use strict';
const { test, ok, eq } = require('./harness');
const { bootAll, freshStore } = require('./helpers');

const App = bootAll();
const U = App.util;
const L = () => App.logic.today;

test('captureMemo：去掉首尾空格，空内容不写入（AC-31）', async () => {
  const s = await freshStore();
  eq(await L().captureMemo('   '), null);
  const row = await L().captureMemo('  周三前交报名表  ');
  eq(row.text, '周三前交报名表');
  eq(row.state, 'open');
  eq(s.list('memos').length, 1);
});

test('captureMemo：连续记录多条，顺序为最新在前', async () => {
  const s = await freshStore();
  await L().captureMemo('第一条');
  await new Promise(r => setTimeout(r, 5));
  await L().captureMemo('第二条');
  eq(s.list('memos')[0].text, '第二条');
});

test('addTask：默认进未安排区，标题为空则忽略', async () => {
  const s = await freshStore();
  eq(await L().addTask({ title: '  ' }), null);
  const t = await L().addTask({ title: '跑通 Demo' });
  eq(t.slot, 'inbox');
  eq(t.status, 'todo');
  eq(t.date, L().curDate());
  eq(s.list('tasks').length, 1);
});

test('toggleTask：完成与取消来回切换', async () => {
  await freshStore();
  const t = await L().addTask({ title: 'x' });
  await L().toggleTask(t.id);
  eq(App.store.get('tasks', t.id).status, 'done');
  await L().toggleTask(t.id);
  eq(App.store.get('tasks', t.id).status, 'todo');
});

test('moveTask：改时段后排序位置随之变化', async () => {
  const s = await freshStore();
  const t = await L().addTask({ title: 'x', slot: 'am' });
  await L().moveTask(t.id, 'eve');
  eq(s.get('tasks', t.id).slot, 'eve');
});

test('moveToTomorrow：日期加一天', async () => {
  await freshStore();
  const t = await L().addTask({ title: 'x' });
  await L().moveToTomorrow(t.id);
  eq(App.store.get('tasks', t.id).date, U.addDays(L().curDate(), 1));
});

test('昨天未完成：只统计未完成、未放弃的（AC-16）', async () => {
  const s = await freshStore();
  const y = U.addDays(L().curDate(), -1);
  await s.put('tasks', { title: '没做完', date: y, slot: 'am', status: 'todo' });
  await s.put('tasks', { title: '做完了', date: y, slot: 'pm', status: 'done' });
  await s.put('tasks', { title: '放弃了', date: y, slot: 'eve', status: 'dropped' });
  const list = L().yesterdayUnfinished();
  eq(list.length, 1);
  eq(list[0].title, '没做完');
});

test('carryOver：搬到今天且不自动搬（AC-16）', async () => {
  const s = await freshStore();
  const y = U.addDays(L().curDate(), -1);
  await s.put('tasks', { title: 'A', date: y, slot: 'am', status: 'todo' });
  await s.put('tasks', { title: 'B', date: y, slot: 'pm', status: 'todo' });
  const n = await L().carryOver();
  eq(n, 2);
  eq(s.list('tasks').filter(t => t.date === L().curDate()).length, 2);
  eq(L().yesterdayUnfinished().length, 0);
});

test('dropYesterday：标记放弃后不再出现', async () => {
  const s = await freshStore();
  const y = U.addDays(L().curDate(), -1);
  await s.put('tasks', { title: 'A', date: y, slot: 'am', status: 'todo' });
  await L().dropYesterday();
  eq(L().yesterdayUnfinished().length, 0);
  eq(s.list('tasks')[0].status, 'dropped');
});

test('重复项：当天自动生成一次，重复执行不重复生成', async () => {
  const s = await freshStore();
  const T = L().curDate();
  await L().addRepeat({ title: '背单词', slot: 'am', days: [U.weekday(T)] });
  const first = await L().materializeRepeats(T);
  const second = await L().materializeRepeats(T);
  eq(first, 1);
  eq(second, 0, '幂等：第二次不应再生成');
  eq(s.list('tasks').filter(t => t.title === '背单词').length, 1);
});

test('重复项：不匹配的星期不生成', async () => {
  const s = await freshStore();
  const T = L().curDate();
  const other = (U.weekday(T) % 7) + 1;
  await L().addRepeat({ title: '只在别的日子', slot: 'am', days: [other] });
  eq(await L().materializeRepeats(T), 0);
  eq(s.list('tasks').length, 0);
});

test('重复项：没有标题时不创建', async () => {
  await freshStore();
  eq(await L().addRepeat({ title: '   ', days: [1] }), null);
  eq(App.store.list('repeats').length, 0);
});

test('日终回顾：写下明天最重要的事 → 生成明天上午第一条任务（AC-17）', async () => {
  const s = await freshStore();
  const T = L().curDate();
  const tomorrow = U.addDays(T, 1);
  await L().finishReview('把比赛材料交了');
  const tasks = s.list('tasks').filter(t => t.date === tomorrow);
  eq(tasks.length, 1);
  eq(tasks[0].slot, 'am');
  eq(tasks[0].title, '把比赛材料交了');
  eq(s.get('notes', tomorrow).headline, '把比赛材料交了');
});

test('日终回顾：重复保存同一句不会生成多条', async () => {
  const s = await freshStore();
  await L().finishReview('同一句');
  await L().finishReview('同一句');
  eq(s.list('tasks').length, 1);
});

test('今日一句话：手动设定后覆盖任务标题', async () => {
  const s = await freshStore();
  const T = L().curDate();
  await s.put('tasks', { title: '任务标题', date: T, slot: 'am', status: 'todo' });
  await L().setHeadline('我今天只想做完这一件');
  eq(App.derive.headline(App.derive.snap()), '我今天只想做完这一件');
});
