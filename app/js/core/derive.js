(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var d = App.derive = {};

  var MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
  d.MEAL_ORDER = MEAL_ORDER;
  d.MEAL_NAMES = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };

  d.snap = function () {
    var s = App.store;
    var settings = s.settings;
    var today = U.todayKey(new Date(), settings.dayCutoffHour);
    return {
      settings: settings,
      today: today,
      weekStartKey: U.weekStart(today, settings.weekStart),
      tasks: s.list('tasks'),
      memos: s.list('memos'),
      contents: s.list('contents'),
      projects: s.list('projects'),
      consults: s.list('consults'),
      answers: s.list('answers'),
      templates: s.list('templates'),
      sessions: s.list('sessions'),
      bodyMetrics: s.list('bodyMetrics'),
      meals: s.list('meals'),
      foods: s.list('foods'),
      games: s.list('games'),
      playSessions: s.list('playSessions'),
      wishItems: s.list('wishItems'),
      shoppingItems: s.list('shoppingItems'),
      repeats: s.list('repeats'),
      notes: s.list('notes'),
      dayMetas: s.list('dayMetas'),
      meta: s.list('meta')
    };
  };

  function byId(rows) {
    var map = {};
    (rows || []).forEach(function (r) { map[r.id] = r; });
    return map;
  }

  function localDateOf(iso) {
    if (!iso) return null;
    var dt = new Date(iso);
    if (isNaN(dt.getTime())) return null;
    return U.dateKey(dt);
  }

  // ---------- 首页 ----------
  d.headline = function (snap) {
    var note = (snap.notes || []).filter(function (n) { return n.id === snap.today; })[0];
    if (note && note.headline) return note.headline;
    var am = (snap.tasks || []).filter(function (t) {
      return t.date === snap.today && t.slot === 'am';
    })[0];
    return am ? am.title : '';
  };

  d.todayTasks = function (snap, limit) {
    var order = { inbox: 0, am: 1, pm: 2, eve: 3 };
    var list = (snap.tasks || []).filter(function (t) { return t.date === snap.today; });
    list.sort(function (a, b) {
      var ad = a.status === 'done' ? 1 : 0;
      var bd = b.status === 'done' ? 1 : 0;
      if (ad !== bd) return ad - bd;
      if (order[a.slot] !== order[b.slot]) return order[a.slot] - order[b.slot];
      return (a.order || 0) - (b.order || 0);
    });
    return limit ? list.slice(0, limit) : list;
  };

  d.todayDone = function (snap) {
    var list = (snap.tasks || []).filter(function (t) { return t.date === snap.today; });
    return {
      total: list.length,
      done: list.filter(function (t) { return t.status === 'done'; }).length
    };
  };

  d.openMemos = function (snap, limit) {
    var list = (snap.memos || []).filter(function (m) { return m.state !== 'done' && m.state !== 'dropped'; });
    return limit ? list.slice(0, limit) : list;
  };

  d.devCard = function (snap) {
    var active = (snap.projects || []).filter(function (p) { return p.stage !== 'done'; });
    if (!active.length) return null;
    active.sort(function (a, b) { return a.deadline < b.deadline ? -1 : 1; });
    var future = active.filter(function (p) { return U.diffDays(snap.today, p.deadline) >= 0; });
    var pick = future.length ? future[0] : active[0];
    var days = U.diffDays(snap.today, pick.deadline);
    return {
      id: pick.id,
      name: pick.name,
      daysLeft: days,
      overdue: days < 0,
      soon: days >= 0 && days <= 3,
      tone: days < 0 ? 'late' : (days <= 3 ? 'soon' : '')
    };
  };

  d.consultCard = function (snap) {
    var waiting = (snap.consults || []).filter(function (c) { return c.status === 'waiting'; });
    if (!waiting.length) return { count: 0, maxWaitDays: 0 };
    var max = 0;
    waiting.forEach(function (c) {
      var date = localDateOf(c.askedAt) || snap.today;
      var wait = U.diffDays(date, snap.today);
      if (wait > max) max = wait;
    });
    return { count: waiting.length, maxWaitDays: max };
  };

  d.mediaCard = function (snap) {
    var today = (snap.contents || []).filter(function (c) {
      return c.planDate === snap.today && c.stage !== 'published' && c.stage !== 'archived';
    })[0];
    var scheduled = (snap.contents || []).filter(function (c) { return c.stage === 'scheduled'; });
    var drafting = (snap.contents || []).filter(function (c) { return c.stage === 'drafting'; });
    if (today) {
      return { type: 'today', id: today.id, title: today.title, platform: today.platform, scheduled: scheduled.length, drafting: drafting.length };
    }
    if (scheduled.length) {
      return { type: 'scheduled', count: scheduled.length, title: scheduled[0].title, platform: scheduled[0].platform, drafting: drafting.length };
    }
    if (drafting.length) {
      return { type: 'drafting', count: drafting.length, title: drafting[0].title };
    }
    return { type: 'none', scheduled: 0, drafting: 0 };
  };

  d.weekSessions = function (snap, list) {
    var start = snap.weekStartKey || U.weekStart(snap.today, (snap.settings || {}).weekStart || 1);
    var end = U.addDays(start, 6);
    return (list || snap.sessions || []).filter(function (s) {
      return s.date >= start && s.date <= end;
    });
  };

  d.fitnessCard = function (snap) {
    var wd = U.weekday(snap.today);
    var tpl = (snap.templates || []).filter(function (t) { return t.weekday === wd; })[0];
    var done = d.weekSessions(snap).length;
    var target = ((snap.settings || {}).goals || {}).weeklyWorkouts || 3;
    if (!tpl) return { hasTemplate: false, weekDone: done, weekTarget: target };
    if (tpl.isRest) return { rest: true, weekDone: done, weekTarget: target, id: tpl.id };
    return {
      rest: false,
      id: tpl.id,
      name: tpl.name,
      count: (tpl.exercises || []).length,
      weekDone: done,
      weekTarget: target
    };
  };

  d.mealTotals = function (meals, foods, date) {
    var fmap = byId(foods);
    var out = {
      plan: { kcal: 0, protein: 0 },
      actual: { kcal: 0, protein: 0 },
      byMeal: {}
    };
    MEAL_ORDER.forEach(function (t) {
      out.byMeal[t] = { plan: { kcal: 0, protein: 0 }, actual: { kcal: 0, protein: 0 } };
    });
    (meals || []).filter(function (m) { return m.date === date; }).forEach(function (m) {
      ['plan', 'actual'].forEach(function (kind) {
        (m[kind] || []).forEach(function (item) {
          var f = fmap[item.foodId];
          if (!f) return;
          var qty = Number(item.qty) || 0;
          out[kind].kcal += (Number(f.kcal) || 0) * qty;
          out[kind].protein += (Number(f.protein) || 0) * qty;
          if (out.byMeal[m.type]) {
            out.byMeal[m.type][kind].kcal += (Number(f.kcal) || 0) * qty;
            out.byMeal[m.type][kind].protein += (Number(f.protein) || 0) * qty;
          }
        });
      });
    });
    out.plan.kcal = Math.round(out.plan.kcal);
    out.actual.kcal = Math.round(out.actual.kcal);
    out.plan.protein = Math.round(out.plan.protein);
    out.actual.protein = Math.round(out.actual.protein);
    return out;
  };

  d.dietCard = function (snap) {
    var totals = d.mealTotals(snap.meals, snap.foods, snap.today);
    var target = ((snap.settings || {}).goals || {}).kcal || 1800;
    var todayMeals = (snap.meals || []).filter(function (m) { return m.date === snap.today; });
    var next = null;
    for (var i = 0; i < MEAL_ORDER.length; i++) {
      var t = MEAL_ORDER[i];
      var meal = todayMeals.filter(function (m) { return m.type === t; })[0];
      if (!meal || !(meal.actual || []).length) { next = t; break; }
    }
    var nextNames = [];
    if (next) {
      var nm = todayMeals.filter(function (m) { return m.type === next; })[0];
      if (nm && (nm.plan || []).length) {
        var fmap = byId(snap.foods);
        nextNames = nm.plan.map(function (p) { return (fmap[p.foodId] || {}).name || ''; }).filter(Boolean);
      }
    }
    return {
      kcal: totals.actual.kcal,
      protein: totals.actual.protein,
      target: target,
      pct: target ? Math.round(totals.actual.kcal / target * 100) : 0,
      nextMeal: next,
      nextMealName: d.MEAL_NAMES[next] || '',
      nextNames: nextNames
    };
  };

  d.gamesCard = function (snap) {
    var start = snap.weekStartKey || U.weekStart(snap.today, (snap.settings || {}).weekStart || 1);
    var end = U.addDays(start, 6);
    var used = 0;
    (snap.playSessions || []).forEach(function (p) {
      var date = localDateOf(p.startAt);
      if (date && date >= start && date <= end) used += Number(p.minutes) || 0;
    });
    var goal = ((snap.settings || {}).goals || {}).weeklyGameMin || 600;
    var current = (snap.games || []).filter(function (g) { return g.status === 'playing'; })[0];
    return {
      used: used,
      goal: goal,
      remain: Math.max(0, goal - used),
      over: used > goal,
      current: current ? current.name : null,
      currentId: current ? current.id : null
    };
  };

  d.recordedToday = function (snap) {
    var names = ['tasks', 'memos', 'contents', 'projects', 'consults', 'answers', 'templates',
      'sessions', 'bodyMetrics', 'meals', 'foods', 'games', 'playSessions', 'wishItems', 'shoppingItems'];
    var n = 0;
    names.forEach(function (k) {
      (snap[k] || []).forEach(function (row) {
        if (row.updatedAt && localDateOf(row.updatedAt) === snap.today) n++;
      });
    });
    return n;
  };

  d.home = function (snap) {
    return {
      headline: d.headline(snap),
      tasks: d.todayTasks(snap, 6),
      taskCount: d.todayDone(snap),
      memos: d.openMemos(snap, 5),
      memoTotal: d.openMemos(snap).length,
      dev: d.devCard(snap),
      consult: d.consultCard(snap),
      media: d.mediaCard(snap),
      fitness: d.fitnessCard(snap),
      diet: d.dietCard(snap),
      games: d.gamesCard(snap),
      recorded: d.recordedToday(snap),
      backupDue: d.backupDue(snap)
    };
  };

  d.backupDue = function (snap) {
    var last = (snap.settings || {}).lastBackupAt;
    if (!last) return true;
    var date = localDateOf(last);
    if (!date) return true;
    return U.diffDays(date, snap.today) >= 30;
  };

})(typeof window !== 'undefined' ? window : globalThis);
