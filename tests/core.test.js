'use strict';
const { test, ok, eq, near, includes, rejects } = require('./harness');
const { bootCore, freshStore, makeLocalStorage } = require('./helpers');

const App = bootCore();
const U = App.util;

// ---------- 日期与工具（AC-37 / AC-36 的基础） ----------
test('dateKey 输出 YYYY-MM-DD', () => {
  eq(U.dateKey(new Date(2026, 10, 12)), '2026-11-12');
  eq(U.dateKey(new Date(2026, 0, 1)), '2026-01-01');
});

test('parseKey 与 dateKey 互逆', () => {
  eq(U.dateKey(U.parseKey('2026-03-09')), '2026-03-09');
});

test('todayKey：凌晨 4 点前算前一天（AC-37）', () => {
  eq(U.todayKey(new Date(2026, 10, 12, 2, 30), 4), '2026-11-11');
  eq(U.todayKey(new Date(2026, 10, 12, 3, 59), 4), '2026-11-11');
  eq(U.todayKey(new Date(2026, 10, 12, 4, 0), 4), '2026-11-12');
  eq(U.todayKey(new Date(2026, 10, 12, 23, 0), 4), '2026-11-12');
});

test('todayKey：关闭规则后按自然日', () => {
  eq(U.todayKey(new Date(2026, 10, 12, 2, 30), 0), '2026-11-12');
});

test('addDays 跨月与跨年', () => {
  eq(U.addDays('2026-01-31', 1), '2026-02-01');
  eq(U.addDays('2026-12-31', 1), '2027-01-01');
  eq(U.addDays('2026-03-01', -1), '2026-02-28');
});

test('diffDays 正负与跨月', () => {
  eq(U.diffDays('2026-11-12', '2026-11-15'), 3);
  eq(U.diffDays('2026-11-15', '2026-11-12'), -3);
  eq(U.diffDays('2026-10-31', '2026-11-02'), 2);
});

test('weekStart：周一为起始（AC-36）', () => {
  eq(U.weekStart('2026-11-12', 1), '2026-11-09');
  eq(U.weekStart('2026-11-09', 1), '2026-11-09');
  eq(U.weekStart('2026-11-15', 1), '2026-11-09');
});

test('weekStart：周日为起始（AC-36）', () => {
  eq(U.weekStart('2026-11-12', 7), '2026-11-08');
  eq(U.weekStart('2026-11-08', 7), '2026-11-08');
});

test('weekday 周日返回 7', () => {
  eq(U.weekday('2026-11-12'), 4);
  eq(U.weekday('2026-11-15'), 7);
});

test('weekDays 返回 7 个连续日期', () => {
  const d = U.weekDays('2026-11-09');
  eq(d.length, 7);
  eq(d[0], '2026-11-09');
  eq(d[6], '2026-11-15');
});

test('escape 处理 HTML 危险字符', () => {
  eq(U.escape('<b>"x"&\'y\'</b>'), '&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/b&gt;');
});

test('minutesToHM 格式化', () => {
  eq(U.minutesToHM(45), '45 分钟');
  eq(U.minutesToHM(120), '2 小时');
  eq(U.minutesToHM(95), '1 小时 35 分');
  eq(U.minutesToHM(-5), '0 分钟');
});

test('sum 支持取值函数', () => {
  eq(U.sum([{ v: 1 }, { v: 2 }], x => x.v), 3);
});

// ---------- 数据层（AC-01 / AC-02） ----------
test('store.put 写入后可 get 到，并自动补 id 与时间戳', async () => {
  const s = await freshStore();
  const row = await s.put('tasks', { title: '写点东西', date: '2026-11-12', slot: 'am' });
  ok(row.id, '应自动生成 id');
  ok(row.createdAt, '应写入 createdAt');
  eq(s.get('tasks', row.id).title, '写点东西');
});

test('store.list 按规则排序：同日按时段 inbox→am→pm→eve', async () => {
  const s = await freshStore();
  await s.put('tasks', { title: 'c', date: '2026-11-12', slot: 'eve' });
  await s.put('tasks', { title: 'a', date: '2026-11-12', slot: 'am' });
  await s.put('tasks', { title: 'b', date: '2026-11-12', slot: 'pm' });
  await s.put('tasks', { title: 'z', date: '2026-11-12', slot: 'inbox' });
  eq(s.list('tasks').map(t => t.title).join(','), 'z,a,b,c');
});

test('重新初始化后数据仍在（模拟刷新，AC-01/AC-02）', async () => {
  const backing = {};
  const driver = App.db.createMemoryDriver(backing);
  const s1 = await freshStore(driver);
  await s1.put('memos', { text: '第一条备忘' });
  await s1.put('memos', { text: '第二条备忘' });

  App.db.useDriver(driver);
  const s2 = App.store;
  await s2.init();
  eq(s2.list('memos').length, 2, '刷新后条目数应保持');
  ok(s2.list('memos').some(m => m.text === '第一条备忘'), '内容应保持');
});

test('localStorage 驱动下写入可跨实例读回（file:// 模式，AC-02）', async () => {
  const ls = makeLocalStorage();
  const drv = App.db.createLocalStorageDriver(ls);
  const s1 = await freshStore(drv);
  await s1.put('tasks', { title: '双击模式也要能存', date: '2026-11-12', slot: 'pm' });

  App.db.useDriver(App.db.createLocalStorageDriver(ls));
  await App.store.init();
  eq(App.store.list('tasks').length, 1);
  eq(App.store.list('tasks')[0].title, '双击模式也要能存');
});

test('默认设置：每周起始周一、凌晨 4 点、目标值齐全', async () => {
  const s = await freshStore();
  eq(s.settings.weekStart, 1);
  eq(s.settings.dayCutoffHour, 4);
  eq(s.settings.goals.kcal, 1800);
  ok(s.settings.theme === 'light' || s.settings.theme === 'dark');
});

test('setSetting 支持嵌套 goals 并持久化', async () => {
  const s = await freshStore();
  await s.setSetting('goals.kcal', 2000);
  eq(s.settings.goals.kcal, 2000);
  eq(s.settings.goals.protein, 120, '其它 goal 不应丢失');
  await s.init();
  eq(s.settings.goals.kcal, 2000, '重新加载后仍生效');
});

test('remove 与 clear 生效并同步到驱动', async () => {
  const s = await freshStore();
  const a = await s.put('memos', { text: 'a' });
  await s.put('memos', { text: 'b' });
  await s.remove('memos', a.id);
  eq(s.list('memos').length, 1);
  await s.clear('memos');
  eq(s.list('memos').length, 0);
  await s.init();
  eq(s.list('memos').length, 0, '清除后重新加载仍为空');
});

// ---------- 备份导出 / 导入（AC-04 / AC-05 / AC-06 / AC-08） ----------
async function seed(s) {
  await s.put('tasks', { title: '任务一', date: '2026-11-12', slot: 'am' });
  await s.put('projects', { name: '校赛 Demo', deadline: '2026-11-15', type: 'contest', stage: 'coding', progress: 40 });
  await s.put('foods', { name: '鸡胸', kcal: 200, protein: 30, unit: '份' });
}

test('exportPayload 结构符合 PRD 7.2', async () => {
  const s = await freshStore();
  await seed(s);
  const p = s.exportPayload();
  eq(p.app, 'worklife');
  eq(p.version, 1);
  ok(p.exportedAt, '应有导出时间');
  ok(p.settings, '应含 settings');
  eq(p.data.tasks.length, 1);
  eq(p.data.projects.length, 1);
  ok(Array.isArray(p.data.consults), '空模块应导出为空数组');
});

test('导出 → 清空 → 覆盖导入，数据完全还原（AC-04）', async () => {
  const s = await freshStore();
  await seed(s);
  const payload = JSON.parse(JSON.stringify(s.exportPayload()));
  await s.clearAll();
  eq(s.list('tasks').length, 0);

  const r = await s.importPayload(payload, 'overwrite');
  eq(r.mode, 'overwrite');
  eq(s.list('tasks').length, 1);
  eq(s.list('tasks')[0].title, '任务一');
  eq(s.list('projects')[0].deadline, '2026-11-15');
  eq(s.list('foods')[0].kcal, 200);
});

test('合并导入：已存在的跳过，新的追加（AC-05）', async () => {
  const s = await freshStore();
  await seed(s);
  const payload = JSON.parse(JSON.stringify(s.exportPayload()));
  await s.put('tasks', { title: '原有任务', date: '2026-11-13', slot: 'pm' });

  const preview = s.importPreview(payload, 'merge');
  eq(preview.added, 0);
  eq(preview.skipped, 3);

  payload.data.tasks.push({ id: 'extra-1', title: '备份里的新任务', date: '2026-11-14', slot: 'am' });
  const r = await s.importPayload(payload, 'merge');
  eq(r.added, 1);
  eq(r.skipped, 3);
  eq(s.list('tasks').length, 3, '原有 2 条 + 新增 1 条');
  ok(s.list('tasks').some(t => t.title === '原有任务'), '原有修改不被覆盖');
});

test('导入损坏文件报错且不改动现有数据（AC-06）', async () => {
  const s = await freshStore();
  await seed(s);
  const before = s.list('tasks').length;

  await rejects(s.importPayload(null, 'merge'), '空对象应被拒绝');
  await rejects(s.importPayload({ app: 'other', version: 1, data: {} }, 'merge'), '非本应用应被拒绝');
  await rejects(s.importPayload({ app: 'worklife', data: {} }, 'merge'), '缺版本号应被拒绝');
  await rejects(s.importPayload({ app: 'worklife', version: 9, data: {} }, 'merge'), '高版本应被拒绝');
  await rejects(s.importPayload({ app: 'worklife', version: 1, data: { tasks: 'x' } }, 'merge'), '结构异常应被拒绝');

  eq(s.list('tasks').length, before, '失败导入不得改动现有数据');
  ok(s.validateBackup({ app: 'worklife', version: 1, data: {} }).ok, '合法结构应通过校验');
});

test('clearAll 后各模块归零且设置回到默认（AC-08 的数据层部分）', async () => {
  const s = await freshStore();
  await seed(s);
  await s.setSetting('goals.kcal', 2200);
  await s.clearAll();
  const counts = s.counts();
  eq(counts.tasks, 0);
  eq(counts.projects, 0);
  eq(s.settings.goals.kcal, 1800, '清空后设置应回默认');
});

test('counts 统计各模块条目数', async () => {
  const s = await freshStore();
  await seed(s);
  const c = s.counts();
  eq(c.tasks, 1);
  eq(c.projects, 1);
  eq(c.foods, 1);
  eq(c.consults, 0);
});
