(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var S = function () { return App.store; };
  var diet = App.logic.diet = {};

  diet.MEALS = [
    { key: 'breakfast', name: '早餐' },
    { key: 'lunch', name: '午餐' },
    { key: 'dinner', name: '晚餐' },
    { key: 'snack', name: '加餐' }
  ];

  diet.mealName = function (k) {
    var hit = diet.MEALS.filter(function (m) { return m.key === k; })[0];
    return hit ? hit.name : k;
  };

  diet.today = function () {
    return U.todayKey(new Date(), S().settings.dayCutoffHour);
  };

  diet.addFood = function (opts) {
    opts = opts || {};
    var name = String(opts.name || '').trim();
    if (!name) return Promise.resolve(null);
    return S().put('foods', {
      name: name,
      kcal: Number(opts.kcal) || 0,
      protein: Number(opts.protein) || 0,
      unit: String(opts.unit || '份').trim() || '份'
    });
  };

  diet.removeFood = function (id) { return S().remove('foods', id); };

  diet.mealOf = function (date, type) {
    return S().list('meals').filter(function (m) { return m.date === date && m.type === type; })[0] || null;
  };

  diet.ensureMeal = function (date, type) {
    var existing = diet.mealOf(date, type);
    if (existing) return Promise.resolve(existing);
    return S().put('meals', { date: date, type: type, plan: [], actual: [], note: '' });
  };

  diet.addItem = function (date, type, kind, foodId, qty) {
    var q = qty === '' || qty === undefined ? 1 : Number(qty);
    if (!foodId || !(q > 0)) return Promise.resolve(null);
    return diet.ensureMeal(date, type).then(function (meal) {
      var items = (meal[kind] || []).slice();
      var hit = items.filter(function (it) { return it.foodId === foodId; })[0];
      if (hit) hit.qty = U.round((Number(hit.qty) || 0) + q, 2);
      else items.push({ foodId: foodId, qty: q });
      var patch = {};
      patch[kind] = items;
      return S().put('meals', Object.assign({}, meal, patch));
    });
  };

  diet.removeItem = function (mealId, kind, foodId) {
    var meal = S().get('meals', mealId);
    if (!meal) return Promise.resolve(null);
    var patch = {};
    patch[kind] = (meal[kind] || []).filter(function (it) { return it.foodId !== foodId; });
    return S().put('meals', Object.assign({}, meal, patch));
  };

  diet.setNote = function (mealId, note) {
    var meal = S().get('meals', mealId);
    if (!meal) return Promise.resolve(null);
    return S().put('meals', Object.assign({}, meal, { note: String(note || '') }));
  };

  diet.copyMeal = function (fromDate, type, toDate) {
    var src = diet.mealOf(fromDate, type);
    if (!src) return Promise.resolve(null);
    return diet.ensureMeal(toDate, type).then(function (target) {
      return S().put('meals', Object.assign({}, target, {
        plan: (src.plan || []).map(function (x) { return Object.assign({}, x); }),
        actual: (src.actual || []).map(function (x) { return Object.assign({}, x); }),
        note: src.note || ''
      }));
    });
  };

  diet.water = function (date) {
    var row = S().get('dayMetas', date);
    return row ? (row.waterCups || 0) : 0;
  };

  diet.setWater = function (date, cups) {
    var row = S().get('dayMetas', date) || { id: date };
    return S().put('dayMetas', Object.assign({}, row, { id: date, waterCups: U.clamp(cups, 0, 8) }));
  };

  diet.toggleWater = function (date, index) {
    var cur = diet.water(date);
    var next = index + 1 === cur ? index : index + 1;
    return diet.setWater(date, next);
  };

  diet.shopping = function () {
    return S().list('shoppingItems');
  };

  diet.addShopping = function (text) {
    var t = String(text || '').trim();
    if (!t) return Promise.resolve(null);
    return S().put('shoppingItems', { text: t, done: false, week: diet.today() });
  };

  diet.toggleShopping = function (id) {
    var row = S().get('shoppingItems', id);
    if (!row) return Promise.resolve(null);
    return S().put('shoppingItems', Object.assign({}, row, { done: !row.done }));
  };

  diet.clearDoneShopping = function () {
    var done = diet.shopping().filter(function (x) { return x.done; });
    return done.reduce(function (chain, row) {
      return chain.then(function () { return S().remove('shoppingItems', row.id); });
    }, Promise.resolve()).then(function () { return done.length; });
  };

  // ---------- 某一天的饮食明细 ----------
  diet.dayTotals = function (date) {
    var foods = {};
    S().list('foods').forEach(function (f) { foods[f.id] = f; });
    var out = {
      date: date,
      actual: { kcal: 0, protein: 0 },
      meals: [],
      filled: 0,
      water: diet.water(date)
    };
    diet.MEALS.forEach(function (m) {
      var meal = diet.mealOf(date, m.key);
      var rec = { key: m.key, name: m.name, kcal: 0, items: [] };
      ((meal && meal.actual) || []).forEach(function (it) {
        var f = foods[it.foodId];
        if (!f) return;
        var k = (Number(f.kcal) || 0) * (Number(it.qty) || 0);
        rec.kcal += k;
        rec.items.push({ name: f.name, qty: it.qty, kcal: Math.round(k) });
        out.actual.kcal += k;
        out.actual.protein += (Number(f.protein) || 0) * (Number(it.qty) || 0);
      });
      if (rec.items.length) out.filled++;
      rec.kcal = Math.round(rec.kcal);
      out.meals.push(rec);
    });
    out.actual.kcal = Math.round(out.actual.kcal);
    out.actual.protein = Math.round(out.actual.protein);
    return out;
  };

  // ---------- 月历数据：每天吃了多少 ----------
  diet.monthData = function (monthKey, today, goal) {
    var foods = {};
    S().list('foods').forEach(function (f) { foods[f.id] = f; });
    var byDate = {};
    S().list('meals').forEach(function (m) {
      var row = byDate[m.date] = byDate[m.date] || { kcal: 0, meals: 0 };
      var has = false;
      (m.actual || []).forEach(function (it) {
        var f = foods[it.foodId];
        if (!f) return;
        has = true;
        row.kcal += (Number(f.kcal) || 0) * (Number(it.qty) || 0);
      });
      if (has) row.meals++;
    });
    var metas = {};
    S().list('dayMetas').forEach(function (m) { metas[m.id] = m; });
    var target = (goal && goal.kcal) || S().settings.goals.kcal || 0;

    return U.monthCells(monthKey, S().settings.weekStart).map(function (cell) {
      var row = byDate[cell.date] || { kcal: 0, meals: 0 };
      var kcal = Math.round(row.kcal);
      return Object.assign({}, cell, {
        kcal: kcal,
        meals: row.meals,
        water: metas[cell.date] ? (metas[cell.date].waterCups || 0) : 0,
        isToday: cell.date === today,
        pct: target ? Math.min(100, Math.round(kcal / target * 100)) : 0,
        over: !!(target && kcal > target)
      });
    });
  };

})(typeof window !== 'undefined' ? window : globalThis);
