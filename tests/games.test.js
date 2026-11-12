'use strict';
const { test, ok, eq, includes } = require('./harness');
const { bootAll, freshStore } = require('./helpers');

const App = bootAll();
const U = App.util;
const G = App.logic.games;

function render() {
  const snap = App.derive.snap();
  return App.views.games.render(snap, { today: snap.today, params: {}, settings: snap.settings, weekStartKey: snap.weekStartKey });
}

test('加游戏：没名称不创建，默认在玩', async () => {
  const s = await freshStore();
  eq(await G.add({ name: '  ' }), null);
  const g = await G.add({ name: '塞尔达', platform: 'Switch' });
  eq(g.status, 'playing');
  eq(s.list('games').length, 1);
});

test('计时：开始后停止会写入一条记录（AC-29）', async () => {
  const s = await freshStore();
  const g = await G.add({ name: 'x' });
  await G.startTimer(g.id);
  ok(G.timer(), '应存在计时中状态');
  const later = new Date(Date.now() + 5 * 60000);
  const session = await G.stopTimer(later);
  eq(session.minutes, 5);
  eq(session.manual, false);
  eq(session.gameId, g.id);
  eq(G.timer(), null, '停止后应清掉计时状态');
  eq(s.list('playSessions').length, 1);
});

test('计时：没有在计时时停止返回 null', async () => {
  await freshStore();
  eq(await G.stopTimer(), null);
});

test('计时：重复开始不会创建第二个', async () => {
  await freshStore();
  const g = await G.add({ name: 'x' });
  await G.startTimer(g.id);
  await G.startTimer('other');
  eq(App.store.list('meta').filter(m => m.id === 'timer').length, 1);
});

test('手填补录时长（AC-30）', async () => {
  const s = await freshStore();
  const g = await G.add({ name: 'x' });
  const row = await G.addManual(g.id, 30);
  eq(row.minutes, 30);
  eq(row.manual, true);
  eq(s.list('playSessions').length, 1);
});

test('手填：0 或负数不记录', async () => {
  await freshStore();
  eq(await G.addManual('g', 0), null);
  eq(App.store.list('playSessions').length, 0);
});

test('本周已用时长只统计本周', async () => {
  const s = await freshStore();
  const snap = App.derive.snap();
  const week = U.weekDays(snap.weekStartKey);
  await s.put('playSessions', { gameId: 'g', startAt: week[0] + 'T20:00:00', minutes: 60, manual: false });
  await s.put('playSessions', { gameId: 'g', startAt: U.addDays(week[0], -2) + 'T20:00:00', minutes: 120, manual: false });
  eq(G.weekUsed(snap.weekStartKey), 60);
});

test('预算设置带上下限', async () => {
  await freshStore();
  await G.setBudget(300);
  eq(App.store.settings.goals.weeklyGameMin, 300);
  await G.setBudget(-5);
  eq(App.store.settings.goals.weeklyGameMin, 0);
});

test('待玩清单：添加、勾选、删除', async () => {
  const s = await freshStore();
  eq(await G.addWish({ title: ' ' }), null);
  const w = await G.addWish({ title: '进击的巨人', type: 'anime' });
  eq(w.type, 'anime');
  await G.toggleWish(w.id);
  ok(s.get('wishItems', w.id).done);
  await G.removeWish(w.id);
  eq(s.list('wishItems').length, 0);
});

test('游戏页：空库显示空状态（AC-34）', async () => {
  await freshStore();
  const html = render();
  includes(html, 'data-empty="1"');
  includes(html, '还没有游戏');
  includes(html, '开始计时');
});

test('游戏页：预算与剩余时长按周计算展示', async () => {
  const s = await freshStore();
  const snap = App.derive.snap();
  await s.put('playSessions', { gameId: 'g', startAt: snap.today + 'T20:00:00', minutes: 90, manual: false });
  const html = render();
  includes(html, '已用 1 小时 30 分');
  includes(html, '本周还剩');
});

test('游戏页：超出预算时提示超时', async () => {
  const s = await freshStore();
  const snap = App.derive.snap();
  await s.put('playSessions', { gameId: 'g', startAt: snap.today + 'T10:00:00', minutes: 700, manual: true });
  const html = render();
  includes(html, '已经超了');
});
