'use strict';
const { test, ok, eq, includes } = require('./harness');
const { bootAll, freshStore } = require('./helpers');

const App = bootAll();
const U = App.util;
const F = App.logic.fitness;

function ctxOf(snap) {
  return { today: snap.today, params: {}, settings: snap.settings, weekStartKey: snap.weekStartKey };
}
function render() {
  const snap = App.derive.snap();
  return App.views.fitness.render(snap, ctxOf(snap));
}

test('模板解析：卧推 4x8 → 4 组 8 次', () => {
  const list = F.parseExercises('卧推 4x8\n侧平举');
  eq(list.length, 2);
  eq(list[0].name, '卧推');
  eq(list[0].targetSets, 4);
  eq(list[0].targetReps, 8);
  eq(list[1].name, '侧平举');
  eq(list[1].targetSets, 3);
  eq(list[1].targetReps, 10);
});

test('保存模板：同一天只保留一条', async () => {
  const s = await freshStore();
  await F.saveTemplate({ weekday: 1, name: '推', exercisesText: '卧推 4x8' });
  await F.saveTemplate({ weekday: 1, name: '推日', exercisesText: '卧推 4x8\n上斜 3x10' });
  const all = s.list('templates');
  eq(all.length, 1);
  eq(all[0].name, '推日');
  eq(all[0].exercises.length, 2);
});

test('休息日不保存动作', async () => {
  await freshStore();
  await F.saveTemplate({ weekday: 7, name: '休息', isRest: true, exercisesText: '卧推 4x8' });
  const tpl = F.templateFor(7);
  eq(tpl.isRest, true);
  eq(tpl.exercises.length, 0);
});

test('开始训练：按上次组次重量预填（AC-24）', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  const past = U.addDays(T, -3);
  await s.put('sessions', {
    date: past,
    exercises: [{ name: '卧推', sets: [{ reps: 8, weight: 40, done: true }, { reps: 8, weight: 40, done: true }, { reps: 8, weight: 40, done: true }, { reps: 8, weight: 40, done: true }] }]
  });
  await F.saveTemplate({ weekday: U.weekday(T), name: '推', exercisesText: '卧推 4x8' });

  const session = await F.startSession(T);
  const ex = session.exercises[0];
  eq(ex.name, '卧推');
  eq(ex.sets.length, 4, '应按上次的 4 组');
  eq(ex.sets[0].reps, 8);
  eq(ex.sets[0].weight, 40);
  eq(ex.sets[0].done, false, '新一天应是未完成');
});

test('开始训练：没有历史时按模板组次生成', async () => {
  await freshStore();
  const T = App.derive.snap().today;
  await F.saveTemplate({ weekday: U.weekday(T), name: '腿', exercisesText: '深蹲 5x5' });
  const session = await F.startSession(T);
  eq(session.exercises[0].sets.length, 5);
  eq(session.exercises[0].sets[0].reps, 5);
});

test('开始训练：同一天不会重复创建', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await F.saveTemplate({ weekday: U.weekday(T), name: '推', exercisesText: '卧推 4x8' });
  const a = await F.startSession(T);
  const b = await F.startSession(T);
  eq(a.id, b.id);
  eq(s.list('sessions').length, 1);
});

test('休息日无法开始训练（AC-25）', async () => {
  await freshStore();
  const T = App.derive.snap().today;
  await F.saveTemplate({ weekday: U.weekday(T), name: '休息', isRest: true });
  eq(await F.startSession(T), null);
});

test('勾选组、加组、改进度', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await F.saveTemplate({ weekday: U.weekday(T), name: '推', exercisesText: '卧推 2x8' });
  const session = await F.startSession(T);
  await F.toggleSet(session.id, 0, 0);
  eq(F.progress(s.get('sessions', session.id)).done, 1);
  await F.addSet(session.id, 0);
  eq(s.get('sessions', session.id).exercises[0].sets.length, 3);
  await F.updateSet(session.id, 0, 2, { weight: 45 });
  eq(s.get('sessions', session.id).exercises[0].sets[2].weight, 45);
});

test('保存训练感受', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await F.saveTemplate({ weekday: U.weekday(T), name: '推', exercisesText: '卧推 2x8' });
  const session = await F.startSession(T);
  await F.finishSession(session.id, '状态不错');
  eq(s.get('sessions', session.id).feel, '状态不错');
});

test('本周训练次数统计（AC-26）', async () => {
  const s = await freshStore();
  const snap = App.derive.snap();
  const week = U.weekDays(snap.weekStartKey);
  await s.put('sessions', { date: week[0], exercises: [] });
  await s.put('sessions', { date: week[3], exercises: [] });
  await s.put('sessions', { date: U.addDays(week[0], -3), exercises: [] });
  eq(F.weekDone(snap.weekStartKey), 2);
});

test('热力图：84 天且标记今天', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await s.put('sessions', { date: T, exercises: [] });
  const map = F.heatmap(84, T);
  eq(map.length, 84);
  eq(map[83].date, T);
  eq(map[83].on, true);
  eq(map[83].today, true);
});

test('体重：同一天重复记录会覆盖', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await F.addBodyMetric({ date: T, weight: 60 });
  await F.addBodyMetric({ date: T, weight: 59.5 });
  const list = s.list('bodyMetrics');
  eq(list.length, 1);
  eq(list[0].weight, 59.5);
});

test('体重：空值不写入', async () => {
  await freshStore();
  eq(await F.addBodyMetric({ weight: '', waist: '' }), null);
  eq(App.store.list('bodyMetrics').length, 0);
});

test('健身页：没有模板显示空状态（AC-34）', async () => {
  await freshStore();
  const html = render();
  includes(html, 'data-empty="1"');
  includes(html, '今天还没有安排');
});

test('健身页：休息日显示"今天休息"且无训练入口（AC-25）', async () => {
  await freshStore();
  const T = App.derive.snap().today;
  await F.saveTemplate({ weekday: U.weekday(T), name: '休息', isRest: true });
  const html = render();
  includes(html, '今天休息');
  eq(html.indexOf('开始今天的训练') === -1, true, '休息日不应出现开始训练按钮');
});

test('健身页：有模板时出现开始训练按钮', async () => {
  await freshStore();
  const T = App.derive.snap().today;
  await F.saveTemplate({ weekday: U.weekday(T), name: '上肢 · 推', exercisesText: '卧推 4x8' });
  const html = render();
  includes(html, '上肢 · 推');
  includes(html, '开始今天的训练');
});

test('健身页：训练中显示组次输入与照上次记（AC-24）', async () => {
  const s = await freshStore();
  const T = App.derive.snap().today;
  await s.put('sessions', {
    date: U.addDays(T, -2),
    exercises: [{ name: '卧推', sets: [{ reps: 8, weight: 40, done: true }] }]
  });
  await F.saveTemplate({ weekday: U.weekday(T), name: '推', exercisesText: '卧推 4x8' });
  await F.startSession(T);
  const html = render();
  includes(html, '照上次记');
  includes(html, 'data-change="set-field"');
  includes(html, '完成训练');
});
