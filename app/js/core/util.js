(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util = {};

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  U.pad = pad;

  U.dateKey = function (d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };

  U.parseKey = function (key) {
    var p = String(key).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  };

  U.todayKey = function (now, cutoffHour) {
    var d = new Date((now || new Date()).getTime());
    var cut = typeof cutoffHour === 'number' ? cutoffHour : 4;
    if (d.getHours() < cut) d.setDate(d.getDate() - 1);
    return U.dateKey(d);
  };

  U.addDays = function (key, n) {
    var d = U.parseKey(key);
    d.setDate(d.getDate() + n);
    return U.dateKey(d);
  };

  U.diffDays = function (fromKey, toKey) {
    var a = U.parseKey(fromKey);
    var b = U.parseKey(toKey);
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  };

  U.weekday = function (key) {
    var d = U.parseKey(key).getDay();
    return d === 0 ? 7 : d;
  };

  U.weekStart = function (key, weekStartDay) {
    var start = weekStartDay || 1;
    var dow = U.weekday(key);
    var back = ((dow - start) % 7 + 7) % 7;
    return U.addDays(key, -back);
  };

  U.weekDays = function (startKey) {
    var out = [];
    for (var i = 0; i < 7; i++) out.push(U.addDays(startKey, i));
    return out;
  };

  U.uid = function () {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  };

  U.escape = function (s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  U.clamp = function (n, min, max) {
    n = Number(n) || 0;
    return Math.min(max, Math.max(min, n));
  };

  U.round = function (n, digits) {
    var f = Math.pow(10, digits || 0);
    return Math.round((Number(n) || 0) * f) / f;
  };

  U.debounce = function (fn, wait) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, wait || 300);
    };
  };

  U.sum = function (arr, pick) {
    return (arr || []).reduce(function (acc, it) {
      var v = pick ? pick(it) : it;
      return acc + (Number(v) || 0);
    }, 0);
  };

  U.minutesToHM = function (min) {
    min = Math.max(0, Math.round(Number(min) || 0));
    var h = Math.floor(min / 60);
    var m = min % 60;
    if (h === 0) return m + ' 分钟';
    if (m === 0) return h + ' 小时';
    return h + ' 小时 ' + m + ' 分';
  };

  var WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  U.WEEK_CN = WEEK_CN;

  U.fmtDateCN = function (key) {
    var d = U.parseKey(key);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK_CN[d.getDay()];
  };

  U.fmtShort = function (key) {
    var d = U.parseKey(key);
    return (d.getMonth() + 1) + '/' + d.getDate();
  };

  U.fmtClock = function (date) {
    var d = date instanceof Date ? date : new Date(date);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  };

  U.nowISO = function () {
    return new Date().toISOString();
  };

  U.MODULE_COLORS = {
    today: '#5F5E5A',
    media: '#993556',
    dev: '#534AB7',
    consult: '#185FA5',
    fitness: '#0F6E56',
    diet: '#854F0B',
    games: '#3B6D11'
  };

  U.moduleColor = function (tag) {
    return U.MODULE_COLORS[tag] || '#888780';
  };

  U.SLOTS = [
    { key: 'inbox', name: '未安排' },
    { key: 'am', name: '上午' },
    { key: 'pm', name: '下午' },
    { key: 'eve', name: '晚上' }
  ];

  U.slotName = function (key) {
    for (var i = 0; i < U.SLOTS.length; i++) if (U.SLOTS[i].key === key) return U.SLOTS[i].name;
    return '未安排';
  };

  U.sortBy = function (arr, fn, dir) {
    var d = dir === 'desc' ? -1 : 1;
    return (arr || []).slice().sort(function (a, b) {
      var av = fn(a), bv = fn(b);
      if (av === bv) return 0;
      return av > bv ? d : -d;
    });
  };

})(typeof window !== 'undefined' ? window : globalThis);
