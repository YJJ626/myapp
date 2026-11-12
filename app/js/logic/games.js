(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var S = function () { return App.store; };
  var games = App.logic.games = {};

  games.STATUS = { playing: '在玩', paused: '搁置', cleared: '已通关' };

  games.today = function () {
    return U.todayKey(new Date(), S().settings.dayCutoffHour);
  };

  games.add = function (opts) {
    opts = opts || {};
    var name = String(opts.name || '').trim();
    if (!name) return Promise.resolve(null);
    return S().put('games', {
      name: name,
      platform: String(opts.platform || '').trim(),
      status: opts.status || 'playing',
      progress: String(opts.progress || '').trim(),
      startedAt: games.today(),
      rating: null,
      review: ''
    });
  };

  games.update = function (id, patch) {
    var row = S().get('games', id);
    if (!row) return Promise.resolve(null);
    return S().put('games', Object.assign({}, row, patch));
  };

  games.remove = function (id) { return S().remove('games', id); };

  games.byStatus = function (status) {
    return S().list('games').filter(function (g) { return g.status === status; });
  };

  games.setBudget = function (minutes) {
    return S().setSetting('goals.weeklyGameMin', U.clamp(Number(minutes) || 0, 0, 10080));
  };

  // ---------- 计时 ----------
  games.timer = function () {
    return S().get('meta', 'timer');
  };

  games.startTimer = function (gameId) {
    var existing = games.timer();
    if (existing) return Promise.resolve(existing);
    return S().put('meta', { id: 'timer', gameId: gameId || '', startAt: U.nowISO() });
  };

  games.elapsedMinutes = function (timer, now) {
    if (!timer) return 0;
    var start = new Date(timer.startAt).getTime();
    var end = (now || new Date()).getTime();
    return Math.max(0, Math.round((end - start) / 60000));
  };

  games.stopTimer = function (now) {
    var timer = games.timer();
    if (!timer) return Promise.resolve(null);
    var minutes = Math.max(1, games.elapsedMinutes(timer, now));
    var endAt = (now || new Date()).toISOString();
    return S().remove('meta', 'timer').then(function () {
      return S().put('playSessions', {
        gameId: timer.gameId || '',
        startAt: timer.startAt,
        endAt: endAt,
        minutes: minutes,
        manual: false
      });
    });
  };

  games.addManual = function (gameId, minutes, date) {
    var m = Number(minutes);
    if (!(m > 0)) return Promise.resolve(null);
    var day = date || games.today();
    return S().put('playSessions', {
      gameId: gameId || '',
      startAt: day + 'T12:00:00',
      endAt: day + 'T12:00:00',
      minutes: Math.round(m),
      manual: true
    });
  };

  games.weekUsed = function (weekStartKey, playSessions) {
    var start = weekStartKey;
    var end = U.addDays(start, 6);
    var sum = 0;
    (playSessions || S().list('playSessions')).forEach(function (p) {
      var key = p.startAt ? U.dateKey(new Date(p.startAt)) : null;
      if (key && key >= start && key <= end) sum += Number(p.minutes) || 0;
    });
    return sum;
  };

  // ---------- 待玩清单 ----------
  games.addWish = function (opts) {
    opts = opts || {};
    var title = String(opts.title || '').trim();
    if (!title) return Promise.resolve(null);
    return S().put('wishItems', { title: title, type: opts.type || 'game', done: false });
  };

  games.toggleWish = function (id) {
    var row = S().get('wishItems', id);
    if (!row) return Promise.resolve(null);
    return S().put('wishItems', Object.assign({}, row, { done: !row.done }));
  };

  games.removeWish = function (id) { return S().remove('wishItems', id); };

  games.wishTypes = { game: '游戏', show: '剧', anime: '番' };

})(typeof window !== 'undefined' ? window : globalThis);
