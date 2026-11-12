(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var S = function () { return App.store; };
  var fit = App.logic.fitness = {};

  fit.WEEK_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  fit.weekName = function (weekday) { return fit.WEEK_NAMES[(weekday || 1) - 1]; };

  fit.templateFor = function (weekday) {
    return S().list('templates').filter(function (t) { return t.weekday === weekday; })[0] || null;
  };

  fit.allTemplates = function () { return S().list('templates'); };

  fit.parseExercises = function (text) {
    return String(text || '').split('\n').map(function (line) {
      var s = line.trim();
      if (!s) return null;
      var m = s.match(/^(.+?)[\s,，]+(\d+)\s*[x×*]\s*(\d+)$/);
      if (m) return { name: m[1].trim(), targetSets: Number(m[2]), targetReps: Number(m[3]) };
      return { name: s, targetSets: 3, targetReps: 10 };
    }).filter(Boolean);
  };

  fit.formatExercises = function (exercises) {
    return (exercises || []).map(function (e) {
      return e.name + ' ' + (e.targetSets || 3) + 'x' + (e.targetReps || 10);
    }).join('\n');
  };

  fit.saveTemplate = function (opts) {
    opts = opts || {};
    var weekday = Number(opts.weekday) || 1;
    var existing = fit.templateFor(weekday);
    var row = Object.assign({}, existing || {}, {
      weekday: weekday,
      name: String(opts.name || '').trim() || (opts.isRest ? '休息' : '训练'),
      isRest: !!opts.isRest,
      exercises: opts.isRest ? [] : fit.parseExercises(opts.exercisesText || '')
    });
    return S().put('templates', row);
  };

  fit.removeTemplate = function (id) { return S().remove('templates', id); };

  // 上一次同名动作的组次，用于"照上次记"（AC-24）
  fit.lastSets = function (sessions, exerciseName) {
    var list = (sessions || []).slice().sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });
    for (var i = 0; i < list.length; i++) {
      var ex = (list[i].exercises || []).filter(function (e) { return e.name === exerciseName; })[0];
      if (ex && (ex.sets || []).length) return ex.sets;
    }
    return null;
  };

  fit.buildSession = function (template, sessions, date) {
    var exercises = (template.exercises || []).map(function (e) {
      var last = fit.lastSets(sessions, e.name);
      var sets = last
        ? last.map(function (s) { return { reps: s.reps, weight: s.weight, done: false }; })
        : new Array(e.targetSets || 3).fill(0).map(function () {
          return { reps: e.targetReps || 10, weight: '', done: false };
        });
      return { name: e.name, sets: sets, lastText: last ? fit.setsText(last) : '' };
    });
    return {
      date: date,
      templateId: template.id,
      exercises: exercises,
      durationMin: null,
      feel: ''
    };
  };

  fit.setsText = function (sets) {
    if (!sets || !sets.length) return '';
    var first = sets[0];
    return sets.length + ' 组 × ' + first.reps + ' 次' + (first.weight !== '' && first.weight !== null ? (' @' + first.weight + 'kg') : '');
  };

  fit.todaySession = function (date) {
    return S().list('sessions').filter(function (s) { return s.date === date; })[0] || null;
  };

  // 今天开始训练：已有当天记录就复用，避免重复
  fit.startSession = function (date) {
    var existing = fit.todaySession(date);
    if (existing) return Promise.resolve(existing);
    var tpl = fit.templateFor(U.weekday(date));
    if (!tpl || tpl.isRest) return Promise.resolve(null);
    var session = fit.buildSession(tpl, S().list('sessions'), date);
    return S().put('sessions', session);
  };

  fit.updateSet = function (sessionId, exIndex, setIndex, patch) {
    var s = S().get('sessions', sessionId);
    if (!s) return Promise.resolve(null);
    var exercises = (s.exercises || []).map(function (ex, i) {
      if (i !== exIndex) return ex;
      var sets = (ex.sets || []).map(function (set, j) {
        return j === setIndex ? Object.assign({}, set, patch) : set;
      });
      return Object.assign({}, ex, { sets: sets });
    });
    return S().put('sessions', Object.assign({}, s, { exercises: exercises }));
  };

  fit.toggleSet = function (sessionId, exIndex, setIndex) {
    var s = S().get('sessions', sessionId);
    if (!s) return Promise.resolve(null);
    var cur = s.exercises[exIndex].sets[setIndex];
    return fit.updateSet(sessionId, exIndex, setIndex, { done: !cur.done });
  };

  fit.addSet = function (sessionId, exIndex) {
    var s = S().get('sessions', sessionId);
    if (!s) return Promise.resolve(null);
    var exercises = s.exercises.map(function (ex, i) {
      if (i !== exIndex) return ex;
      var last = ex.sets[ex.sets.length - 1] || { reps: 10, weight: '' };
      return Object.assign({}, ex, {
        sets: ex.sets.concat([{ reps: last.reps, weight: last.weight, done: false }])
      });
    });
    return S().put('sessions', Object.assign({}, s, { exercises: exercises }));
  };

  fit.finishSession = function (id, feel) {
    var s = S().get('sessions', id);
    if (!s) return Promise.resolve(null);
    return S().put('sessions', Object.assign({}, s, { feel: String(feel || '').trim() }));
  };

  fit.progress = function (session) {
    var total = 0, done = 0;
    (session.exercises || []).forEach(function (ex) {
      (ex.sets || []).forEach(function (set) {
        total++;
        if (set.done) done++;
      });
    });
    return { total: total, done: done };
  };

  fit.weekDone = function (weekStartKey) {
    var end = U.addDays(weekStartKey, 6);
    return S().list('sessions').filter(function (s) { return s.date >= weekStartKey && s.date <= end; }).length;
  };

  fit.heatmap = function (days, today) {
    days = days || 84;
    var out = [];
    var start = U.addDays(today, -(days - 1));
    var doneMap = {};
    S().list('sessions').forEach(function (s) { doneMap[s.date] = true; });
    for (var i = 0; i < days; i++) {
      var key = U.addDays(start, i);
      out.push({ date: key, on: !!doneMap[key], today: key === today });
    }
    return out;
  };

  fit.addBodyMetric = function (opts) {
    opts = opts || {};
    var date = opts.date || U.todayKey(new Date(), S().settings.dayCutoffHour);
    var existing = S().list('bodyMetrics').filter(function (m) { return m.date === date; })[0];
    if (opts.weight === '' && opts.waist === '') return Promise.resolve(null);
    return S().put('bodyMetrics', Object.assign({}, existing || {}, {
      date: date,
      weight: opts.weight === '' ? (existing ? existing.weight : '') : Number(opts.weight),
      waist: opts.waist === '' ? (existing ? existing.waist : '') : Number(opts.waist)
    }));
  };

  fit.weightSeries = function (limit) {
    var list = S().list('bodyMetrics').slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return list.slice(-(limit || 7)).map(function (m) {
      return { date: m.date, weight: m.weight === '' ? null : Number(m.weight) };
    });
  };

  // ---------- 训练概况：某天的部位 / 动作 / 组次 ----------
  fit.sessionInfo = function (session, template, tpls) {
    var parts = tpls || S().list('templates');
    var part = '';
    if (session) {
      var tpl = parts.filter(function (t) { return t.id === session.templateId; })[0];
      part = (tpl && tpl.name) || session.part || '训练';
    } else if (template && !template.isRest) {
      part = template.name;
    }
    var names = [];
    var setCount = 0, doneSets = 0, volume = 0;
    var source = session ? (session.exercises || []) : ((template && template.exercises) || []);
    source.forEach(function (ex) {
      names.push(ex.name);
      if (session) {
        (ex.sets || []).forEach(function (set) {
          setCount++;
          if (set.done) doneSets++;
          volume += (Number(set.reps) || 0) * (Number(set.weight) || 0);
        });
      } else {
        setCount += ex.targetSets || 0;
      }
    });
    return {
      hasSession: !!session,
      part: part,
      names: names,
      exerciseCount: names.length,
      setCount: setCount,
      doneSets: doneSets,
      volume: Math.round(volume)
    };
  };

  // 月历数据：每天带上部位、动作数、组数与是否休息
  fit.monthData = function (monthKey, today) {
    var sessions = S().list('sessions');
    var tpls = S().list('templates');
    var byDate = {};
    sessions.forEach(function (s) { byDate[s.date] = s; });
    var tplByDay = {};
    tpls.forEach(function (t) { tplByDay[t.weekday] = t; });

    return U.monthCells(monthKey, S().settings.weekStart).map(function (cell) {
      var session = byDate[cell.date] || null;
      var tpl = tplByDay[U.weekday(cell.date)] || null;
      return Object.assign({}, cell, fit.sessionInfo(session, tpl, tpls), {
        isToday: cell.date === today,
        planned: !!(tpl && !tpl.isRest),
        rest: !!(tpl && tpl.isRest) && !session
      });
    });
  };

  // 点开某一天看到的明细
  fit.dayDetail = function (date, today) {
    var session = fit.todaySession(date);
    var tpl = fit.templateFor(U.weekday(date));
    var info = fit.sessionInfo(session, tpl);
    var exercises = [];
    if (session) {
      (session.exercises || []).forEach(function (ex) {
        exercises.push({
          name: ex.name,
          sets: (ex.sets || []).map(function (s) {
            return {
              reps: s.reps === '' ? '' : Number(s.reps),
              weight: s.weight === '' ? '' : Number(s.weight),
              done: !!s.done
            };
          })
        });
      });
    } else if (tpl && !tpl.isRest) {
      (tpl.exercises || []).forEach(function (ex) {
        var sets = [];
        for (var i = 0; i < (ex.targetSets || 3); i++) {
          sets.push({ reps: ex.targetReps || 10, weight: '', done: false });
        }
        exercises.push({ name: ex.name, plan: true, sets: sets });
      });
    }
    return Object.assign({
      date: date,
      isToday: date === today,
      template: tpl,
      session: session,
      exercises: exercises,
      feel: session ? session.feel : ''
    }, info);
  };

})(typeof window !== 'undefined' ? window : globalThis);
