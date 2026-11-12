(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var db = App.db;

  var DEFAULT_SETTINGS = {
    id: 'app',
    theme: 'light',
    weekStart: 1,
    dayCutoffHour: 4,
    goals: { kcal: 1800, protein: 120, weeklyWorkouts: 3, weeklyGameMin: 600 },
    lastBackupAt: null
  };

  var SORTS = {
    tasks: function (a, b) {
      var order = { inbox: 0, am: 1, pm: 2, eve: 3 };
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if (order[a.slot] !== order[b.slot]) return order[a.slot] - order[b.slot];
      return (a.order || 0) - (b.order || 0);
    },
    memos: function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; },
    contents: function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; },
    projects: function (a, b) { return a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0; },
    consults: function (a, b) { return a.askedAt < b.askedAt ? -1 : a.askedAt > b.askedAt ? 1 : 0; },
    answers: function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; },
    templates: function (a, b) { return a.weekday - b.weekday; },
    sessions: function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; },
    bodyMetrics: function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; },
    meals: function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; },
    foods: function (a, b) { return a.name < b.name ? -1 : 1; },
    games: function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; },
    playSessions: function (a, b) { return a.startAt < b.startAt ? 1 : a.startAt > b.startAt ? -1 : 0; },
    wishItems: function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; },
    shoppingItems: function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; },
    repeats: function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; },
    notes: function (a, b) { return a.id < b.id ? 1 : -1; },
    dayMetas: function (a, b) { return a.id < b.id ? 1 : -1; },
    settings: function () { return 0; },
    meta: function () { return 0; }
  };

  var store = App.store = {
    cache: {},
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    listeners: [],
    today: null,

    init: function () {
      var self = this;
      return Promise.all(db.STORES.map(function (s) {
        return db.all(s).then(function (rows) { self.cache[s] = rows || []; });
      })).then(function () {
        var row = (self.cache.settings || []).filter(function (r) { return r.id === 'app'; })[0];
        var isNew = !row;
        if (isNew) row = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        self.cache.settings = [row];
        self.settings = Object.assign({}, DEFAULT_SETTINGS, row);
        self.settings.goals = Object.assign({}, DEFAULT_SETTINGS.goals, row.goals || {});
        self.today = U.todayKey(new Date(), self.settings.dayCutoffHour);
        return isNew ? db.put('settings', row) : null;
      }).then(function () {
        return self;
      });
    },

    list: function (name) {
      var rows = (this.cache[name] || []).slice();
      var fn = SORTS[name];
      return fn ? rows.sort(fn) : rows;
    },

    get: function (name, id) {
      var rows = this.cache[name] || [];
      for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
      return null;
    },

    put: function (name, rec) {
      var self = this;
      var now = U.nowISO();
      var row = Object.assign({}, rec);
      if (!row.id) row.id = U.uid();
      if (!row.createdAt) row.createdAt = now;
      row.updatedAt = now;
      this.cache[name] = this.cache[name] || [];
      var idx = -1;
      for (var i = 0; i < this.cache[name].length; i++) if (this.cache[name][i].id === row.id) { idx = i; break; }
      if (idx >= 0) this.cache[name][idx] = row;
      else this.cache[name].push(row);
      return db.put(name, row).then(function () {
        self.emit(name);
        return row;
      });
    },

    remove: function (name, id) {
      var self = this;
      this.cache[name] = (this.cache[name] || []).filter(function (r) { return r.id !== id; });
      return db.remove(name, id).then(function () {
        self.emit(name);
        return true;
      });
    },

    clear: function (name) {
      var self = this;
      this.cache[name] = [];
      return db.clear(name).then(function () {
        self.emit(name);
        return true;
      });
    },

    clearAll: function () {
      var self = this;
      return db.clearAll().then(function () {
        Object.keys(self.cache).forEach(function (k) { self.cache[k] = []; });
        var row = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        self.cache.settings = [row];
        self.settings = row;
        return db.put('settings', row);
      }).then(function () {
        self.emit('all');
        return true;
      });
    },

    setSetting: function (key, value) {
      var self = this;
      var next = Object.assign({}, this.settings);
      if (key === 'goals.kcal' || key === 'goals.protein' || key === 'goals.weeklyWorkouts' || key === 'goals.weeklyGameMin') {
        next.goals = Object.assign({}, next.goals);
        next.goals[key.split('.')[1]] = value;
      } else {
        next[key] = value;
      }
      this.settings = next;
      this.cache.settings = [next];
      return db.put('settings', next).then(function () {
        self.emit('settings');
        return next;
      });
    },

    reloadSettings: function () {
      var row = (this.cache.settings || [])[0];
      if (row) {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, row);
        this.settings.goals = Object.assign({}, DEFAULT_SETTINGS.goals, row.goals || {});
      }
    },

    onChange: function (fn) { this.listeners.push(fn); },

    emit: function (name) {
      this.listeners.forEach(function (fn) {
        try { fn(name); } catch (e) { /* 单个订阅者异常不影响其它 */ }
      });
      if (App.store.onPersist) App.store.onPersist(name);
    },

    // ---------- 备份 ----------
    exportPayload: function () {
      var data = {};
      db.STORES.forEach(function (s) {
        if (s === 'settings' || s === 'meta') return;
        data[s] = (store.cache[s] || []).slice();
      });
      return {
        app: 'worklife',
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: JSON.parse(JSON.stringify(this.settings)),
        data: data
      };
    },

    validateBackup: function (payload) {
      if (!payload || typeof payload !== 'object') return { ok: false, error: '文件不是有效的 JSON 对象' };
      if (payload.app !== 'worklife') return { ok: false, error: '不是本应用导出的备份文件' };
      if (typeof payload.version !== 'number') return { ok: false, error: '备份文件缺少版本号' };
      if (payload.version > 1) return { ok: false, error: '备份版本 ' + payload.version + ' 高于当前应用支持的版本' };
      if (!payload.data || typeof payload.data !== 'object') return { ok: false, error: '备份文件缺少数据段' };
      var bad = null;
      db.STORES.forEach(function (s) {
        if (s === 'settings' || s === 'meta') return;
        var rows = payload.data[s];
        if (rows === undefined) return;
        if (!Array.isArray(rows)) { bad = s; return; }
        rows.forEach(function (r) { if (!r || typeof r.id !== 'string') bad = s; });
      });
      if (bad) return { ok: false, error: '备份文件结构异常：' + bad };
      return { ok: true };
    },

    importPreview: function (payload, mode) {
      var data = payload.data || {};
      var added = 0, skipped = 0;
      db.STORES.forEach(function (s) {
        if (s === 'settings' || s === 'meta') return;
        var rows = data[s] || [];
        if (mode === 'overwrite') { added += rows.length; return; }
        var existing = {};
        (store.cache[s] || []).forEach(function (r) { existing[r.id] = true; });
        rows.forEach(function (r) { if (existing[r.id]) skipped++; else added++; });
      });
      return { added: added, skipped: skipped };
    },

    importPayload: function (payload, mode) {
      var self = this;
      var check = this.validateBackup(payload);
      if (!check.ok) return Promise.reject(new Error(check.error));
      var preview = this.importPreview(payload, mode);
      var data = payload.data || {};

      var chain = Promise.resolve();
      if (mode === 'overwrite') chain = chain.then(function () { return self.clearAll(); });

      db.STORES.forEach(function (s) {
        if (s === 'settings') return;
        var rows = data[s] || [];
        rows.forEach(function (r) {
          if (mode !== 'overwrite' && self.get(s, r.id)) return;
          chain = chain.then(function () {
            self.cache[s] = self.cache[s] || [];
            self.cache[s].push(r);
            return db.put(s, r);
          });
        });
      });

      if (payload.settings) {
        chain = chain.then(function () {
          var s = Object.assign({}, payload.settings, { id: 'app' });
          self.cache.settings = [s];
          self.settings = Object.assign({}, DEFAULT_SETTINGS, s);
          self.settings.goals = Object.assign({}, DEFAULT_SETTINGS.goals, s.goals || {});
          return db.put('settings', s);
        });
      }

      return chain.then(function () {
        self.emit('all');
        return { added: preview.added, skipped: preview.skipped, mode: mode };
      });
    },

    counts: function () {
      var out = {};
      var self = this;
      ['tasks', 'memos', 'contents', 'projects', 'consults', 'answers', 'sessions',
        'meals', 'games', 'playSessions', 'wishItems', 'bodyMetrics', 'foods'].forEach(function (s) {
        out[s] = (self.cache[s] || []).length;
      });
      return out;
    }
  };

  App.DEFAULT_SETTINGS = DEFAULT_SETTINGS;

})(typeof window !== 'undefined' ? window : globalThis);
