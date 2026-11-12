'use strict';
const { test, ok, eq, includes } = require('./harness');
const { bootAll, freshStore } = require('./helpers');

const App = bootAll();
const U = App.util;
const M = App.logic.media;

function ctxOf(snap) {
  return { today: snap.today, params: {}, settings: snap.settings, weekStartKey: snap.weekStartKey };
}
function render() {
  const snap = App.derive.snap();
  return App.views.media.render(snap, ctxOf(snap));
}

test('新建内容：没标题不创建，默认进选题池', async () => {
  const s = await freshStore();
  eq(await M.add({ title: '  ' }), null);
  const c = await M.add({ title: '宿舍桌面改造' });
  eq(c.stage, 'idea');
  eq(c.platform, 'xiaohongshu');
  eq(s.list('contents').length, 1);
});

test('状态流转：拖到待发布后持久化（AC-18）', async () => {
  const backing = {};
  const driver = App.db.createMemoryDriver(backing);
  const s = await freshStore(driver);
  const c = await M.add({ title: 'x' });
  await M.move(c.id, 'scheduled');
  eq(s.get('contents', c.id).stage, 'scheduled');

  App.db.useDriver(driver);
  await App.store.init();
  eq(App.store.get('contents', c.id).stage, 'scheduled', '刷新后状态不丢');
});

test('移到已发布时自动记录发布日期', async () => {
  await freshStore();
  const c = await M.add({ title: 'x' });
  const before = App.store.get('contents', c.id).publishedAt;
  eq(before, '');
  await M.move(c.id, 'published');
  ok(App.store.get('contents', c.id).publishedAt, '应写入发布日期');
});

test('各阶段计数正确', async () => {
  await freshStore();
  await M.add({ title: 'a' });
  const b = await M.add({ title: 'b' });
  await M.move(b.id, 'drafting');
  const contents = App.store.list('contents');
  eq(M.byStage(contents, 'idea').length, 1);
  eq(M.byStage(contents, 'drafting').length, 1);
  eq(M.byStage(contents, 'published').length, 0);
});

test('本周排期按七天分桶，归档内容不出现', async () => {
  const s = await freshStore();
  const snap = App.derive.snap();
  const week = U.weekDays(snap.weekStartKey);
  const a = await M.add({ title: '周一发', planDate: week[0] });
  await M.add({ title: '周三发', planDate: week[2] });
  const gone = await M.add({ title: '归档了', planDate: week[1] });
  await M.move(gone.id, 'archived');
  const plan = M.weekPlan(s.list('contents'), snap.weekStartKey);
  eq(plan.length, 7);
  eq(plan[0].items.length, 1);
  eq(plan[0].items[0].title, '周一发');
  eq(plan[1].items.length, 0);
  eq(plan[2].items.length, 1);
  eq(plan[2].items[0].title, '周三发');
});

test('未排期列表排除归档', async () => {
  const s = await freshStore();
  const a = await M.add({ title: '没日期' });
  const b = await M.add({ title: '归档的' });
  await M.move(b.id, 'archived');
  const list = M.unscheduled(s.list('contents'));
  eq(list.length, 1);
  eq(list[0].id, a.id);
});

test('发布数据可手填', async () => {
  await freshStore();
  const c = await M.add({ title: 'x' });
  await M.setStats(c.id, { view: 1200, like: 88, fans: 12 });
  const saved = App.store.get('contents', c.id).stats;
  eq(saved.view, 1200);
  eq(saved.like, 88);
  eq(saved.fans, 12);
});

test('自媒体页：空数据有引导（AC-34）', async () => {
  await freshStore();
  const html = render();
  includes(html, 'data-empty="1"');
  includes(html, '还没有内容');
});

test('自媒体页：看板五列齐全且卡片可拖', async () => {
  const s = await freshStore();
  await s.put('contents', { title: '选题一', platform: 'bilibili', stage: 'idea', planDate: '', stats: {} });
  const html = render();
  ['选题池', '写作中', '待发布', '已发布', '归档'].forEach(function (n) {
    includes(html, n, '缺列：' + n);
  });
  includes(html, 'draggable="true"');
  includes(html, 'data-drop="col"');
  includes(html, '选题一');
});

test('自媒体页：排期视图显示七天且有灵感速记', async () => {
  const s = await freshStore();
  await s.put('contents', { title: 'x', platform: 'bilibili', stage: 'scheduled', planDate: '', stats: {} });
  App.uiState = { mediaView: 'schedule' };
  const html = render();
  includes(html, 'sched-day');
  includes(html, '灵感速记');
  App.uiState = {};
});

test('自媒体页：已发布内容显示播放数', async () => {
  const s = await freshStore();
  await s.put('contents', { title: '爆款', platform: 'douyin', stage: 'published', planDate: '', publishedAt: '2026-11-01', stats: { view: 5200 } });
  includes(render(), '5200 播放');
});
