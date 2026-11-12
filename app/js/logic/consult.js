(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var S = function () { return App.store; };
  var consult = App.logic.consult = {};

  consult.CHANNELS = { wechat: '微信', group: '群里', offline: '当面', other: '其它' };

  consult.channelName = function (k) { return consult.CHANNELS[k] || '其它'; };

  consult.add = function (opts) {
    opts = opts || {};
    var question = String(opts.question || '').trim();
    if (!question) return Promise.resolve(null);
    return S().put('consults', {
      person: String(opts.person || '').trim() || '未记名',
      channel: opts.channel || 'wechat',
      question: question,
      detail: String(opts.detail || '').trim(),
      status: 'waiting',
      askedAt: U.nowISO(),
      repliedAt: null,
      conclusion: '',
      followUp: ''
    });
  };

  consult.reply = function (id, data) {
    var row = S().get('consults', id);
    if (!row) return Promise.resolve(null);
    data = data || {};
    var conclusion = String(data.conclusion || '').trim();
    var next = Object.assign({}, row, {
      status: 'replied',
      repliedAt: U.nowISO(),
      conclusion: conclusion,
      followUp: String(data.followUp || '').trim()
    });
    return S().put('consults', next).then(function () {
      if (!data.saveToBank || !conclusion) return null;
      return consult.saveAnswer({ question: row.question, answer: conclusion });
    });
  };

  consult.reopen = function (id) {
    var row = S().get('consults', id);
    if (!row) return Promise.resolve(null);
    return S().put('consults', Object.assign({}, row, { status: 'waiting', repliedAt: null }));
  };

  consult.remove = function (id) { return S().remove('consults', id); };

  // 删除一个人：连同他的全部咨询记录一起清掉，返回删除条数
  consult.removePerson = function (name) {
    var rows = S().list('consults').filter(function (c) { return c.person === name; });
    return rows.reduce(function (chain, row) {
      return chain.then(function () { return S().remove('consults', row.id); });
    }, Promise.resolve()).then(function () { return rows.length; });
  };

  consult.waiting = function () {
    return S().list('consults').filter(function (c) { return c.status === 'waiting'; });
  };

  consult.waitDays = function (c, today) {
    var date = c.askedAt ? U.dateKey(new Date(c.askedAt)) : (today || consult.today());
    return U.diffDays(date, today || consult.today());
  };

  consult.today = function () {
    return U.todayKey(new Date(), S().settings.dayCutoffHour);
  };

  consult.waitingSorted = function () {
    var t = consult.today();
    return consult.waiting().slice().sort(function (a, b) {
      return consult.waitDays(b, t) - consult.waitDays(a, t);
    });
  };

  consult.byPerson = function (name) {
    var t = consult.today();
    return S().list('consults').filter(function (c) { return c.person === name; }).map(function (c) {
      return Object.assign({}, c, { waitDays: consult.waitDays(c, t) });
    }).sort(function (a, b) {
      return a.askedAt < b.askedAt ? 1 : -1;
    });
  };

  consult.profiles = function () {
    var map = {};
    S().list('consults').forEach(function (c) {
      if (!map[c.person]) map[c.person] = { name: c.person, total: 0, waiting: 0, lastAskedAt: '', lastConclusion: '' };
      var p = map[c.person];
      p.total++;
      if (c.status === 'waiting') p.waiting++;
      if (!p.lastAskedAt || c.askedAt > p.lastAskedAt) {
        p.lastAskedAt = c.askedAt;
        p.lastConclusion = c.conclusion || '';
      }
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
      return a.lastAskedAt < b.lastAskedAt ? 1 : -1;
    });
  };

  consult.saveAnswer = function (opts) {
    opts = opts || {};
    var question = String(opts.question || '').trim();
    var answer = String(opts.answer || '').trim();
    if (!question || !answer) return Promise.resolve(null);
    return S().put('answers', {
      question: question,
      answer: answer,
      tags: opts.tags || [],
      useCount: 0
    });
  };

  consult.searchAnswers = function (q) {
    var key = String(q || '').trim().toLowerCase();
    return S().list('answers').filter(function (a) {
      if (!key) return true;
      return (a.question + ' ' + a.answer + ' ' + (a.tags || []).join(' ')).toLowerCase().indexOf(key) !== -1;
    });
  };

  consult.markUsed = function (id) {
    var row = S().get('answers', id);
    if (!row) return Promise.resolve(null);
    return S().put('answers', Object.assign({}, row, { useCount: (row.useCount || 0) + 1 }));
  };

})(typeof window !== 'undefined' ? window : globalThis);
