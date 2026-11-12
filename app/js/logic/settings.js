(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var S = function () { return App.store; };
  var settings = App.logic.settings = {};

  settings.themeLabel = { light: '浅色', dark: '深色' };

  settings.setTheme = function (theme) {
    return S().setSetting('theme', theme === 'dark' ? 'dark' : 'light');
  };

  settings.setWeekStart = function (day) {
    return S().setSetting('weekStart', U.clamp(Number(day) || 1, 1, 7));
  };

  settings.setCutoff = function (hour) {
    return S().setSetting('dayCutoffHour', U.clamp(Number(hour) || 0, 0, 6));
  };

  settings.setGoal = function (key, value) {
    return S().setSetting('goals.' + key, Number(value) || 0);
  };

  settings.buildExport = function () {
    return S().exportPayload();
  };

  settings.parseBackup = function (text) {
    var payload;
    try {
      payload = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: '文件不是有效的 JSON' };
    }
    var check = S().validateBackup(payload);
    if (!check.ok) return { ok: false, error: check.error };
    return { ok: true, payload: payload };
  };

  settings.previewImport = function (payload, mode) {
    return S().importPreview(payload, mode);
  };

  settings.applyImport = function (payload, mode) {
    return S().importPayload(payload, mode);
  };

  settings.markBackedUp = function () {
    return S().setSetting('lastBackupAt', U.nowISO());
  };

  settings.fileName = function (now) {
    var d = now || new Date();
    return 'worklife-backup-' + U.dateKey(d).replace(/-/g, '') + '-' +
      U.pad(d.getHours()) + U.pad(d.getMinutes()) + '.json';
  };

  // 连续记录天数：从今天（今天没做就从昨天）往前数，有完成任务的连续天数
  settings.streak = function (today, tasks) {
    var doneDays = {};
    (tasks || []).forEach(function (t) {
      if (t.status === 'done' && t.date) doneDays[t.date] = true;
    });
    var cursor = doneDays[today] ? today : U.addDays(today, -1);
    var count = 0;
    while (doneDays[cursor]) {
      count++;
      cursor = U.addDays(cursor, -1);
      if (count > 3650) break;
    }
    return count;
  };

  settings.weekRate = function (tasks, weekStartKey) {
    var end = U.addDays(weekStartKey, 6);
    var list = (tasks || []).filter(function (t) {
      return t.date >= weekStartKey && t.date <= end && t.status !== 'dropped';
    });
    var done = list.filter(function (t) { return t.status === 'done'; }).length;
    return { done: done, total: list.length, pct: list.length ? Math.round(done / list.length * 100) : 0 };
  };

  settings.moduleCounts = function () {
    var counts = S().counts();
    return [
      { name: '任务', n: counts.tasks },
      { name: '备忘', n: counts.memos },
      { name: '内容', n: counts.contents },
      { name: '项目', n: counts.projects },
      { name: '咨询', n: counts.consults },
      { name: '答案', n: counts.answers },
      { name: '训练', n: counts.sessions },
      { name: '餐次', n: counts.meals },
      { name: '游戏', n: counts.games },
      { name: '游玩记录', n: counts.playSessions }
    ];
  };

  settings.clearModule = function (name) {
    return S().clear(name);
  };

  settings.clearAll = function () {
    return S().clearAll();
  };

})(typeof window !== 'undefined' ? window : globalThis);
