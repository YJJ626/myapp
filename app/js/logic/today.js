(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var S = function () { return App.store; };
  var today = App.logic = App.logic || {};
  today = today.today = {};

  function curDate() {
    return U.todayKey(new Date(), S().settings.dayCutoffHour);
  }

  today.curDate = curDate;

  today.captureMemo = function (text) {
    var t = String(text || '').trim();
    if (!t) return Promise.resolve(null);
    return S().put('memos', { text: t, state: 'open' });
  };

  today.addTask = function (opts) {
    opts = opts || {};
    var title = String(opts.title || '').trim();
    if (!title) return Promise.resolve(null);
    return S().put('tasks', {
      title: title,
      date: opts.date || curDate(),
      slot: opts.slot || 'inbox',
      moduleTag: opts.moduleTag || 'today',
      estMin: opts.estMin || null,
      status: 'todo',
      order: Date.now() % 100000,
      repeatRule: opts.repeatRule || 'none'
    });
  };

  today.toggleTask = function (id) {
    var row = S().get('tasks', id);
    if (!row) return Promise.resolve(null);
    return S().put('tasks', Object.assign({}, row, { status: row.status === 'done' ? 'todo' : 'done' }));
  };

  today.moveTask = function (id, slot) {
    var row = S().get('tasks', id);
    if (!row) return Promise.resolve(null);
    return S().put('tasks', Object.assign({}, row, { slot: slot }));
  };

  today.moveToDate = function (id, date) {
    var row = S().get('tasks', id);
    if (!row) return Promise.resolve(null);
    return S().put('tasks', Object.assign({}, row, { date: date }));
  };

  today.moveToTomorrow = function (id) {
    return today.moveToDate(id, U.addDays(curDate(), 1));
  };

  today.removeTask = function (id) {
    return S().remove('tasks', id);
  };

  today.setHeadline = function (text) {
    var date = curDate();
    var row = S().get('notes', date) || { id: date };
    return S().put('notes', Object.assign({}, row, { id: date, headline: String(text || '').trim() }));
  };

  today.note = function (date) {
    return S().get('notes', date) || { id: date };
  };

  today.unfinishedOn = function (date) {
    return S().list('tasks').filter(function (t) {
      return t.date === date && t.status !== 'done' && t.status !== 'dropped';
    });
  };

  today.yesterdayUnfinished = function () {
    return today.unfinishedOn(U.addDays(curDate(), -1));
  };

  today.carryOver = function () {
    var rows = today.yesterdayUnfinished();
    var date = curDate();
    return rows.reduce(function (chain, row) {
      return chain.then(function () {
        return S().put('tasks', Object.assign({}, row, { date: date }));
      });
    }, Promise.resolve()).then(function () { return rows.length; });
  };

  today.dropYesterday = function () {
    var rows = today.yesterdayUnfinished();
    return rows.reduce(function (chain, row) {
      return chain.then(function () {
        return S().put('tasks', Object.assign({}, row, { status: 'dropped' }));
      });
    }, Promise.resolve()).then(function () { return rows.length; });
  };

  // 重复项：按周几自动出现在当天（幂等）
  today.materializeRepeats = function (date) {
    date = date || curDate();
    var wd = U.weekday(date);
    var repeats = S().list('repeats').filter(function (r) {
      return (r.days || []).indexOf(wd) !== -1;
    });
    var existing = {};
    S().list('tasks').forEach(function (t) {
      if (t.date === date && t.repeatId) existing[t.repeatId] = true;
    });
    var created = 0;
    return repeats.reduce(function (chain, r) {
      return chain.then(function () {
        if (existing[r.id]) return null;
        created++;
        return S().put('tasks', {
          title: r.title,
          date: date,
          slot: r.slot || 'am',
          moduleTag: r.moduleTag || 'today',
          status: 'todo',
          repeatId: r.id,
          order: 0
        });
      });
    }, Promise.resolve()).then(function () { return created; });
  };

  today.addRepeat = function (opts) {
    opts = opts || {};
    if (!String(opts.title || '').trim()) return Promise.resolve(null);
    return S().put('repeats', {
      title: String(opts.title).trim(),
      slot: opts.slot || 'am',
      moduleTag: opts.moduleTag || 'today',
      days: opts.days && opts.days.length ? opts.days : [1, 2, 3, 4, 5, 6, 7]
    });
  };

  // 日终回顾：写一句"明天最重要的事"，自动成为明天第一条上午任务
  today.finishReview = function (text) {
    var date = curDate();
    var t = String(text || '').trim();
    var chain = S().put('notes', Object.assign({}, today.note(date), { id: date, review: t, reviewedAt: U.nowISO() }));
    if (!t) return chain;
    var tomorrow = U.addDays(date, 1);
    chain = chain.then(function () {
      return S().put('notes', Object.assign({}, today.note(tomorrow), { id: tomorrow, headline: t }));
    }).then(function () {
      var exists = S().list('tasks').filter(function (x) {
        return x.date === tomorrow && x.slot === 'am' && x.title === t;
      })[0];
      if (exists) return null;
      return S().put('tasks', {
        title: t,
        date: tomorrow,
        slot: 'am',
        moduleTag: 'today',
        status: 'todo',
        order: 0
      });
    });
    return chain;
  };

})(typeof window !== 'undefined' ? window : globalThis);
