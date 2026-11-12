'use strict';
const { test, ok, eq } = require('./harness');
const { bootAll, freshStore } = require('./helpers');

const App = bootAll();
const U = App.util;

function snap() { return App.derive.snap(); }

test('devCard：3 天后截止的项目应标记为临近', async () => {
  const s = await freshStore();
  const T = snap().today;
  await s.put('projects', { name: '校赛 Demo', deadline: U.addDays(T, 3), stage: 'coding', type: 'contest' });
  const card = App.derive.devCard(snap());
  eq(card.daysLeft, 3);
  eq(card.soon, true);
  eq(card.overdue, false);
  eq(card.tone, 'soon');
  eq(card.name, '校赛 Demo');
});

test('devCard：逾期显示负数天并标记 overdue（AC-10）', async () => {
  const s = await freshStore();
  const T = snap().today;
  await s.put('projects', { name: '已过期', deadline: U.addDays(T, -1), stage: 'coding' });
  const card = App.derive.devCard(snap());
  eq(card.daysLeft, -1);
  eq(card.overdue, true);
  eq(card.tone, 'late');
});

test('devCard：只在未完成项目中挑选最近 DDL', async () => {
  const s = await freshStore();
  const T = snap().today;
  await s.put('projects', { name: '远', deadline: U.addDays(T, 20), stage: 'coding' });
  await s.put('projects', { name: '近', deadline: U.addDays(T, 5), stage: 'design' });
  await s.put('projects', { name: '已完成', deadline: U.addDays(T, 1), stage: 'done' });
  eq(App.derive.devCard(snap()).name, '近');
});

test('devCard：没有项目时返回 null', async () => {
  await freshStore();
  eq(App.derive.devCard(snap()), null);
});

test('consultCard：统计待回复条数与最长等待天数（AC-11）', async () => {
  const s = await freshStore();
  const T = snap().today;
  await s.put('consults', { person: 'A', question: 'q1', status: 'waiting', askedAt: U.addDays(T, -3) + 'T09:00:00' });
  await s.put('consults', { person: 'B', question: 'q2', status: 'waiting', askedAt: T + 'T10:00:00' });
  await s.put('consults', { person: 'C', question: 'q3', status: 'replied', askedAt: U.addDays(T, -5) + 'T10:00:00' });
  const card = App.derive.consultCard(snap());
  eq(card.count, 2);
  eq(card.maxWaitDays, 3);
});

test('consultCard：全部回复后为 0', async () => {
  await freshStore();
  eq(App.derive.consultCard(snap()).count, 0);
});

test('mediaCard：今天有排期时优先显示今天的内容', async () => {
  const s = await freshStore();
  const T = snap().today;
  await s.put('contents', { title: '今天的稿子', stage: 'scheduled', planDate: T, platform: 'xiaohongshu' });
  await s.put('contents', { title: '下周的稿子', stage: 'scheduled', planDate: U.addDays(T, 5), platform: 'bilibili' });
  const card = App.derive.mediaCard(snap());
  eq(card.type, 'today');
  eq(card.title, '今天的稿子');
});

test('mediaCard：无今天排期时回落到待发布条数', async () => {
  const s = await freshStore();
  const T = snap().today;
  await s.put('contents', { title: 'a', stage: 'scheduled', planDate: U.addDays(T, 2), platform: 'bilibili' });
  const card = App.derive.mediaCard(snap());
  eq(card.type, 'scheduled');
  eq(card.count, 1);
});

test('mediaCard：什么都没有时为 none', async () => {
  await freshStore();
  eq(App.derive.mediaCard(snap()).type, 'none');
});

test('fitnessCard：休息日显示 rest（AC-25）', async () => {
  const s = await freshStore();
  const T = snap().today;
  await s.put('templates', { weekday: U.weekday(T), name: '休息', isRest: true, exercises: [] });
  const card = App.derive.fitnessCard(snap());
  eq(card.rest, true);
});

test('fitnessCard：正常训练日带动作数与本周完成次数', async () => {
  const s = await freshStore();
  const T = snap().today;
  await s.put('templates', {
    weekday: U.weekday(T), name: '上肢 · 推', isRest: false,
    exercises: [{ name: '卧推', targetSets: 4, targetReps: 8 }, { name: '推举', targetSets: 3, targetReps: 12 }]
  });
  await s.put('sessions', { date: T, exercises: [] });
  const card = App.derive.fitnessCard(snap());
  eq(card.name, '上肢 · 推');
  eq(card.count, 2);
  eq(card.weekDone, 1);
});

test('fitnessCard：没有模板时 hasTemplate=false', async () => {
  await freshStore();
  eq(App.derive.fitnessCard(snap()).hasTemplate, false);
});

test('dietCard：热量累计严格等于两份食物之和（AC-12/AC-27）', async () => {
  const s = await freshStore();
  const T = snap().today;
  const a = await s.put('foods', { name: '燕麦', kcal: 300, protein: 10, unit: '份' });
  const b = await s.put('foods', { name: '鸡胸饭', kcal: 520, protein: 35, unit: '份' });
  await s.put('meals', { date: T, type: 'breakfast', plan: [], actual: [{ foodId: a.id, qty: 1 }] });
  await s.put('meals', { date: T, type: 'lunch', plan: [], actual: [{ foodId: b.id, qty: 1 }] });
  const card = App.derive.dietCard(snap());
  eq(card.kcal, 820);
  eq(card.protein, 45);
  eq(card.target, 1800);
  eq(card.nextMeal, 'dinner');
});

test('dietCard：份数按倍数计算', async () => {
  const s = await freshStore();
  const T = snap().today;
  const a = await s.put('foods', { name: '鸡胸', kcal: 200, protein: 30, unit: '份' });
  await s.put('meals', { date: T, type: 'lunch', plan: [], actual: [{ foodId: a.id, qty: 1.5 }] });
  eq(App.derive.dietCard(snap()).kcal, 300);
});

test('dietCard：四餐都记完后 nextMeal 为空', async () => {
  const s = await freshStore();
  const T = snap().today;
  const a = await s.put('foods', { name: 'x', kcal: 100, protein: 1, unit: '份' });
  for (const t of ['breakfast', 'lunch', 'dinner', 'snack']) {
    await s.put('meals', { date: T, type: t, plan: [], actual: [{ foodId: a.id, qty: 1 }] });
  }
  eq(App.derive.dietCard(snap()).nextMeal, null);
});

test('gamesCard：本周已用时长与剩余预算（AC-29）', async () => {
  const s = await freshStore();
  const T = snap().today;
  await s.put('playSessions', { gameId: 'g1', startAt: T + 'T20:00:00', minutes: 90, manual: false });
  await s.put('playSessions', { gameId: 'g1', startAt: U.addDays(T, -10) + 'T20:00:00', minutes: 300, manual: false });
  const card = App.derive.gamesCard(snap());
  eq(card.used, 90, '上周的记录不应计入本周');
  eq(card.goal, 600);
  eq(card.remain, 510);
});

test('gamesCard：超出预算时 over=true 且剩余为 0', async () => {
  const s = await freshStore();
  const T = snap().today;
  await s.put('playSessions', { gameId: 'g1', startAt: T + 'T10:00:00', minutes: 700, manual: true });
  const card = App.derive.gamesCard(snap());
  eq(card.over, true);
  eq(card.remain, 0);
});

test('headline：优先取当天笔记的 headline，否则取上午第一条任务', async () => {
  const s = await freshStore();
  const T = snap().today;
  eq(App.derive.headline(snap()), '');
  await s.put('tasks', { title: '跑通 Demo', date: T, slot: 'am', status: 'todo' });
  eq(App.derive.headline(snap()), '跑通 Demo');
  await s.put('notes', { id: T, headline: '把比赛材料交了' });
  eq(App.derive.headline(snap()), '把比赛材料交了');
});

test('todayTasks：最多 6 条且已完成排后面', async () => {
  const s = await freshStore();
  const T = snap().today;
  for (let i = 0; i < 8; i++) {
    await s.put('tasks', { title: 'T' + i, date: T, slot: 'am', status: 'todo', order: i });
  }
  const first = s.list('tasks')[0];
  await s.put('tasks', Object.assign({}, first, { status: 'done', order: -1 }));
  const list = App.derive.todayTasks(snap(), 6);
  eq(list.length, 6);
  ok(list[list.length - 1].status === 'todo', '已完成的应被排到后面');
});

test('recordedToday 统计今天改动过的条目数', async () => {
  const s = await freshStore();
  await s.put('memos', { text: 'a' });
  await s.put('memos', { text: 'b' });
  eq(App.derive.recordedToday(snap()), 2);
});

test('backupDue：从未备份时为 true，今天备份过为 false', async () => {
  const s = await freshStore();
  eq(App.derive.backupDue(snap()), true);
  await s.setSetting('lastBackupAt', new Date().toISOString());
  eq(App.derive.backupDue(snap()), false);
});

test('home 汇总结构完整', async () => {
  await freshStore();
  const h = App.derive.home(snap());
  OK_KEYS(h);
  function OK_KEYS(x) {
    ok('headline' in x);
    ok('dev' in x);
    ok('consult' in x);
    ok('media' in x);
    ok('fitness' in x);
    ok('diet' in x);
    ok('games' in x);
    ok('recorded' in x);
  }
});
