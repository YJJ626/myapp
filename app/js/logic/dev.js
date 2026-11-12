(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var S = function () { return App.store; };
  var dev = App.logic.dev = {};

  dev.STAGES = [
    { key: 'req', name: '需求' },
    { key: 'design', name: '设计' },
    { key: 'coding', name: '编码' },
    { key: 'debug', name: '联调' },
    { key: 'submit', name: '提交' },
    { key: 'done', name: '完成' }
  ];
  dev.TYPES = { course: '课程', contest: '比赛', self: '自研' };

  dev.stageName = function (key) {
    var hit = dev.STAGES.filter(function (s) { return s.key === key; })[0];
    return hit ? hit.name : '未设阶段';
  };

  dev.stageIndex = function (key) {
    for (var i = 0; i < dev.STAGES.length; i++) if (dev.STAGES[i].key === key) return i;
    return 0;
  };

  dev.addProject = function (opts) {
    opts = opts || {};
    var name = String(opts.name || '').trim();
    if (!name) return Promise.resolve(null);
    return S().put('projects', {
      name: name,
      type: opts.type || 'course',
      deadline: opts.deadline || U.addDays(U.todayKey(new Date(), S().settings.dayCutoffHour), 14),
      stage: 'req',
      progress: 0,
      nextStep: '',
      links: [],
      todos: [],
      logs: [],
      pitfalls: []
    });
  };

  dev.get = function (id) { return S().get('projects', id); };

  dev.update = function (id, patch) {
    var p = S().get('projects', id);
    if (!p) return Promise.resolve(null);
    return S().put('projects', Object.assign({}, p, patch));
  };

  dev.setStage = function (id, stage) {
    var p = S().get('projects', id);
    if (!p) return Promise.resolve(null);
    var idx = dev.stageIndex(stage);
    var patch = { stage: stage };
    if (stage === 'done') patch.progress = 100;
    else if (p.progress === 100) patch.progress = 90;
    return dev.update(id, patch);
  };

  dev.setProgress = function (id, value) {
    return dev.update(id, { progress: U.clamp(value, 0, 100) });
  };

  dev.addTodo = function (id, text, isNext) {
    var p = S().get('projects', id);
    var t = String(text || '').trim();
    if (!p || !t) return Promise.resolve(null);
    var todos = (p.todos || []).slice();
    if (isNext) todos.forEach(function (x) { x.isNext = false; });
    todos.push({ id: U.uid(), text: t, done: false, isNext: !!isNext });
    return S().put('projects', Object.assign({}, p, { todos: todos }));
  };

  dev.setNextStep = function (id, todoId) {
    var p = S().get('projects', id);
    if (!p) return Promise.resolve(null);
    var todos = (p.todos || []).map(function (t) {
      return Object.assign({}, t, { isNext: t.id === todoId });
    });
    var target = todos.filter(function (t) { return t.id === todoId; })[0];
    return S().put('projects', Object.assign({}, p, {
      todos: todos,
      nextStep: target ? target.text : ''
    }));
  };

  dev.toggleTodo = function (id, todoId) {
    var p = S().get('projects', id);
    if (!p) return Promise.resolve(null);
    var todos = (p.todos || []).map(function (t) {
      return t.id === todoId ? Object.assign({}, t, { done: !t.done }) : t;
    });
    return S().put('projects', Object.assign({}, p, { todos: todos }));
  };

  dev.removeTodo = function (id, todoId) {
    var p = S().get('projects', id);
    if (!p) return Promise.resolve(null);
    return S().put('projects', Object.assign({}, p, {
      todos: (p.todos || []).filter(function (t) { return t.id !== todoId; })
    }));
  };

  dev.addLog = function (id, text, date) {
    var p = S().get('projects', id);
    var t = String(text || '').trim();
    if (!p || !t) return Promise.resolve(null);
    var logs = (p.logs || []).slice();
    logs.unshift({ id: U.uid(), date: date || U.todayKey(new Date(), S().settings.dayCutoffHour), text: t });
    return S().put('projects', Object.assign({}, p, { logs: logs }));
  };

  dev.addPitfall = function (id, data) {
    var p = S().get('projects', id);
    data = data || {};
    var problem = String(data.problem || '').trim();
    if (!p || !problem) return Promise.resolve(null);
    var pitfalls = (p.pitfalls || []).slice();
    pitfalls.unshift({
      id: U.uid(),
      problem: problem,
      cause: String(data.cause || '').trim(),
      solution: String(data.solution || '').trim()
    });
    return S().put('projects', Object.assign({}, p, { pitfalls: pitfalls }));
  };

  dev.removePitfall = function (id, pid) {
    var p = S().get('projects', id);
    if (!p) return Promise.resolve(null);
    return S().put('projects', Object.assign({}, p, {
      pitfalls: (p.pitfalls || []).filter(function (x) { return x.id !== pid; })
    }));
  };

  dev.searchPitfalls = function (projects, q) {
    var key = String(q || '').trim().toLowerCase();
    var out = [];
    (projects || []).forEach(function (p) {
      (p.pitfalls || []).forEach(function (x) {
        var hay = (x.problem + ' ' + x.cause + ' ' + x.solution).toLowerCase();
        if (!key || hay.indexOf(key) !== -1) {
          out.push({ projectId: p.id, projectName: p.name, problem: x.problem, cause: x.cause, solution: x.solution });
        }
      });
    });
    return out;
  };

  dev.daysLeft = function (project, today) {
    return U.diffDays(today || U.todayKey(new Date(), S().settings.dayCutoffHour), project.deadline);
  };

  dev.types = dev.TYPES;

})(typeof window !== 'undefined' ? window : globalThis);
