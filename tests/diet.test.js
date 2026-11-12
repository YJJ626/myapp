'use strict';
const { test, ok, eq, includes } = require('./harness');
const { bootAll, freshStore } = require('./helpers');

const App = bootAll();
const U = App.util;
const D = App.logic.diet;

function render() {
  const snap = App.derive.snap();
  return App.views.diet.render(snap, { today: snap.today, params: {}, settings: snap.settings, weekStartKey: snap.weekStartKey });
}

test('食物库：没有名称不创建，热量与蛋白转数字', async () => {
  const s = await freshStore();
  eq(await D.addFood({ name: '  ' }), null);
  const f = await D.addFood({ name: '鸡胸饭', kcal: '520', protein: '35' });
  eq(f.kcal, 520);
  eq(f.protein, 35);
  eq(s.list('foods').length, 1);
});

test('记录食物：同一食物累加份数（AC-27）', async () => {
  const s = await freshStore();
  const f = await D.addFood({ name: '鸡胸', kcal: 200, protein: 30 });
  const T = D.today();
  await D.addItem(T, 'lunch', 'actual', f.id, 1);
  await D.addItem(T, 'lunch', 'actual', f.id, 0.5);
  const meal = D.mealOf(T, 'lunch');
  eq(meal.actual.length, 1);
  eq(meal.actual[0].qty, 1.5);
  const totals = App.derive.mealTotals(s.list('meals'), s.list('foods'), T);
  eq(totals.actual.kcal, 300);
});

test('记录食物：计划和实际分开统计', async () => {
  const s = await freshStore();
  const f = await D.addFood({ name: '米饭', kcal: 200, protein: 4 });
  const T = D.today();
  await D.addItem(T, 'lunch', 'plan', f.id, 1);
  await D.addItem(T, 'lunch', 'actual', f.id, 2);
  const totals = App.derive.mealTotals(s.list('meals'), s.list('foods'), T);
  eq(totals.plan.kcal, 200);
  eq(totals.actual.kcal, 400);
});

test('份数为 0 或负数不记录', async () => {
  await freshStore();
  const f = await D.addFood({ name: 'x', kcal: 10, protein: 1 });
  eq(await D.addItem(D.today(), 'lunch', 'actual', f.id, 0), null);
  eq(await D.addItem(D.today(), 'lunch', 'actual', f.id, -1), null);
});

test('删除某一餐里的食物', async () => {
  const s = await freshStore();
  const f = await D.addFood({ name: 'x', kcal: 100, protein: 1 });
  const T = D.today();
  await D.addItem(T, 'dinner', 'actual', f.id, 1);
  const meal = D.mealOf(T, 'dinner');
  await D.removeItem(meal.id, 'actual', f.id);
  eq(D.mealOf(T, 'dinner').actual.length, 0);
});

test('复制昨天某餐到今天', async () => {
  const s = await freshStore();
  const f = await D.addFood({ name: 'x', kcal: 100, protein: 1 });
  const T = D.today();
  const y = U.addDays(T, -1);
  await D.addItem(y, 'breakfast', 'actual', f.id, 2);
  await D.copyMeal(y, 'breakfast', T);
  const meal = D.mealOf(T, 'breakfast');
  eq(meal.actual.length, 1);
  eq(meal.actual[0].qty, 2);
});

test('饮水打卡：点第 N 格设成 N+1，点当前最后一杯则撤回（AC-28）', async () => {
  await freshStore();
  const T = D.today();
  eq(D.water(T), 0);
  await D.toggleWater(T, 2);
  eq(D.water(T), 3);
  await D.toggleWater(T, 2);
  eq(D.water(T), 2);
});

test('饮水上限 8 杯', async () => {
  await freshStore();
  const T = D.today();
  await D.setWater(T, 99);
  eq(D.water(T), 8);
});

test('买菜清单：添加、勾选、清掉已买', async () => {
  const s = await freshStore();
  await D.addShopping('鸡胸');
  const egg = await D.addShopping('鸡蛋');
  eq(s.list('shoppingItems').length, 2);
  await D.toggleShopping(egg.id);
  eq(s.list('shoppingItems').filter(x => x.done).length, 1);
  const n = await D.clearDoneShopping();
  eq(n, 1);
  eq(s.list('shoppingItems').length, 1);
});

test('饮食页：没有食物库时给引导（AC-34）', async () => {
  await freshStore();
  const html = render();
  includes(html, '食物库是空的');
  ['早餐', '午餐', '晚餐', '加餐'].forEach(function (n) { includes(html, n); });
  includes(html, 'data-act="water"');
});

test('饮食页：四餐都渲染计划与实际两栏', async () => {
  await freshStore();
  const html = render();
  includes(html, '计划');
  includes(html, '实际');
  eq((html.match(/data-kind="actual"/g) || []).length >= 4, true);
});

test('饮食页：记录后数字与进度一致', async () => {
  const s = await freshStore();
  const f = await D.addFood({ name: '鸡胸饭', kcal: 520, protein: 35 });
  await D.addItem(D.today(), 'lunch', 'actual', f.id, 1);
  const html = render();
  includes(html, '520 / 1800 kcal');
});
