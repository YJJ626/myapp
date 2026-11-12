'use strict';
const { test, eq, ok, includes } = require('./harness');
const { bootAll, freshStore } = require('./helpers');

const App = bootAll();
const U = App.util;
const C = App.logic.consult;

function render() {
  const snap = App.derive.snap();
  return App.views.consult.render(snap, { today: snap.today, params: {}, settings: snap.settings, weekStartKey: snap.weekStartKey });
}

test('新建咨询：没有问题时拒绝，有问题默认等回复', async () => {
  const s = await freshStore();
  eq(await C.add({ question: '   ' }), null);
  const row = await C.add({ person: '小林', channel: 'wechat', question: '这个报错怎么定位' });
  eq(row.status, 'waiting');
  eq(row.person, '小林');
  ok(row.askedAt, '应记录提问时间');
  eq(s.list('consults').length, 1);
});

test('未记名时用占位名', async () => {
  await freshStore();
  const row = await C.add({ question: '问题' });
  eq(row.person, '未记名');
});

test('待回复队列按等待时长倒序', async () => {
  const s = await freshStore();
  const T = C.today();
  await s.put('consults', { person: 'A', question: 'q1', status: 'waiting', askedAt: U.addDays(T, -1) + 'T09:00:00' });
  await s.put('consults', { person: 'B', question: 'q2', status: 'waiting', askedAt: U.addDays(T, -4) + 'T09:00:00' });
  const list = C.waitingSorted();
  eq(list[0].person, 'B');
  eq(C.waitDays(list[0], T), 4);
});

test('回复后离开队列但仍在个人档案里（AC-22）', async () => {
  const s = await freshStore();
  const row = await C.add({ person: '小林', question: '怎么定位空指针' });
  await C.reply(row.id, { conclusion: '先看堆栈最后一行', followUp: '让他把日志发来' });

  eq(C.waiting().length, 0, '队列应为空');
  const saved = s.get('consults', row.id);
  eq(saved.status, 'replied');
  eq(saved.conclusion, '先看堆栈最后一行');
  ok(saved.repliedAt, '应记录回复时间');

  const person = C.byPerson('小林');
  eq(person.length, 1);
  eq(person[0].conclusion, '先看堆栈最后一行');
});

test('回复时可同时存入答案库（AC-23）', async () => {
  const s = await freshStore();
  const row = await C.add({ question: '跨域怎么解决' });
  await C.reply(row.id, { conclusion: '加响应头或走代理', saveToBank: true });
  const answers = s.list('answers');
  eq(answers.length, 1);
  eq(answers[0].question, '跨域怎么解决');
  eq(answers[0].answer, '加响应头或走代理');
});

test('不勾选时不进答案库', async () => {
  const s = await freshStore();
  const row = await C.add({ question: '一次性问题' });
  await C.reply(row.id, { conclusion: '结论', saveToBank: false });
  eq(s.list('answers').length, 0);
});

test('回复不写结论会被前端拦住，逻辑层也接受空结论但不入答案库', async () => {
  const s = await freshStore();
  const row = await C.add({ question: 'q' });
  await C.reply(row.id, { conclusion: '', saveToBank: true });
  eq(s.list('answers').length, 0, '空结论不应存进答案库');
});

test('答案库搜索命中问题与答案内容', async () => {
  const s = await freshStore();
  await C.saveAnswer({ question: 'Git 冲突怎么解', answer: '先 pull 再手动合并' });
  await C.saveAnswer({ question: 'Vue 生命周期', answer: 'mounted 之后再取 DOM' });
  eq(C.searchAnswers('git').length, 1);
  eq(C.searchAnswers('dom').length, 1);
  eq(C.searchAnswers('').length, 2);
  eq(C.searchAnswers('zzz').length, 0);
});

test('答案库缺问题或缺答案不保存', async () => {
  const s = await freshStore();
  eq(await C.saveAnswer({ question: '', answer: 'x' }), null);
  eq(await C.saveAnswer({ question: 'x', answer: '' }), null);
  eq(s.list('answers').length, 0);
});

test('问过的人：统计次数与未回条数', async () => {
  await freshStore();
  const a = await C.add({ person: '小林', question: 'q1' });
  await C.add({ person: '小林', question: 'q2' });
  await C.reply(a.id, { conclusion: '答' });
  const p = C.profiles().filter(x => x.name === '小林')[0];
  eq(p.total, 2);
  eq(p.waiting, 1);
});

test('重新打开后回到待回复', async () => {
  await freshStore();
  const row = await C.add({ question: 'q' });
  await C.reply(row.id, { conclusion: 'a' });
  await C.reopen(row.id);
  eq(C.waiting().length, 1);
  eq(App.store.get('consults', row.id).status, 'waiting');
});

test('咨询页：空队列显示空状态（AC-34）', async () => {
  await freshStore();
  const html = render();
  includes(html, 'data-empty="1"');
  includes(html, '队列是空的');
});

test('咨询页：队列显示人名、问题与等待天数', async () => {
  const s = await freshStore();
  const T = C.today();
  await s.put('consults', { person: '小林', question: '渲染顺序不对', status: 'waiting', channel: 'wechat', askedAt: U.addDays(T, -3) + 'T09:00:00' });
  const html = render();
  includes(html, '小林');
  includes(html, '渲染顺序不对');
  includes(html, '等了 3 天');
  includes(html, 'q-wait warn');
});

test('咨询页：答案库为空时给出解释而不是空白', async () => {
  await freshStore();
  includes(render(), '存进答案库');
});
