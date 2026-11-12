(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var views = App.views = App.views || {};
  var F = App.logic.fitness;

  function weekStrip(snap, ctx) {
    var html = '<div class="week-strip">';
    var tpls = snap.templates || [];
    for (var i = 1; i <= 7; i++) {
      var tpl = tpls.filter(function (t) { return t.weekday === i; })[0];
      var isToday = U.weekday(ctx.today) === i;
      var cls = 'wday' + (isToday ? ' today' : '') + (tpl && tpl.isRest ? ' rest' : '');
      html += '<div class="' + cls + '" data-act="edit-template" data-weekday="' + i + '">' +
        '<div class="wday-name">' + F.weekName(i) + '</div>' +
        '<div>' + (tpl ? U.escape(tpl.isRest ? '休息' : tpl.name) : '未设置') + '</div>' +
        '</div>';
    }
    return html + '</div>';
  }

  function sparkline(points) {
    if (points.length < 2) return '<div class="small faint">至少记两天才能看趋势</div>';
    var values = points.map(function (p) { return p.weight; });
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var span = max - min || 1;
    var w = 220, h = 56;
    var d = points.map(function (p, i) {
      var x = (i / (points.length - 1)) * (w - 8) + 4;
      var y = h - 4 - ((p.weight - min) / span) * (h - 12);
      return (i === 0 ? 'M' : 'L') + U.round(x, 1) + ' ' + U.round(y, 1);
    }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="56" preserveAspectRatio="none">' +
      '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"/>' +
      '</svg>';
  }

  views.fitness = {
    title: '健身计划',
    render: function (snap, ctx) {
      var target = (snap.settings.goals || {}).weeklyWorkouts || 3;
      var weekDone = F.weekDone(ctx.weekStartKey);
      var todayTpl = (snap.templates || []).filter(function (t) { return t.weekday === U.weekday(ctx.today); })[0];
      var session = (snap.sessions || []).filter(function (s) { return s.date === ctx.today; })[0];

      var html = '<div class="page-head"><div class="grow"><h1>健身计划</h1>' +
        '<div class="sub">本周已练 ' + weekDone + ' / ' + target + ' 次</div></div>' +
        '<div class="page-actions"><button class="btn btn-sm" data-act="edit-template" data-weekday="' + U.weekday(ctx.today) + '">改今天的模板</button></div></div>';

      html += weekStrip(snap, ctx);

      html += '<div class="grid-2" style="margin-top:14px">';

      html += '<div class="card"><div class="card-head"><h3>今天的训练</h3>' +
        (session ? '<span class="small faint">' + (function () {
          var p = F.progress(session);
          return p.done + ' / ' + p.total + ' 组';
        })() + '</span>' : '') + '</div><div class="card-pad">';

      if (!todayTpl) {
        html += '<div class="empty" data-empty="1"><div class="empty-title">今天还没有安排</div>' +
          '<div class="empty-hint">先给' + F.weekName(U.weekday(ctx.today)) + '定一套训练，或者标成休息日</div>' +
          '<button class="btn btn-primary btn-sm" data-act="edit-template" data-weekday="' + U.weekday(ctx.today) + '">设置今天</button></div>';
      } else if (todayTpl.isRest) {
        html += '<div class="empty" data-empty="1"><div class="empty-title">今天休息</div>' +
          '<div class="empty-hint">休息也是计划的一部分。想练的话可以改模板。</div></div>';
      } else if (!session) {
        html += '<div class="row-between" style="margin-bottom:10px">' +
          '<span class="bold">' + U.escape(todayTpl.name) + '</span>' +
          '<span class="small faint">' + (todayTpl.exercises || []).length + ' 个动作</span></div>';
        (todayTpl.exercises || []).forEach(function (e) {
          var last = F.lastSets(snap.sessions, e.name);
          html += '<div class="row-between small" style="padding:4px 0;border-bottom:1px solid var(--border)">' +
            '<span>' + U.escape(e.name) + '</span>' +
            '<span class="faint">' + e.targetSets + ' 组 × ' + e.targetReps + ' 次' +
            (last ? ' · 上次 ' + F.setsText(last) : '') + '</span></div>';
        });
        html += '<button class="btn btn-primary" data-act="start" style="margin-top:12px;width:100%">开始今天的训练</button>';
      } else {
        var prog = F.progress(session);
        html += '<div style="margin-bottom:10px">' + App.ui.bar(prog.total ? prog.done / prog.total * 100 : 0) + '</div>';
        (session.exercises || []).forEach(function (ex, ei) {
          var last = F.lastSets(snap.sessions.filter(function (s) { return s.id !== session.id; }), ex.name);
          html += '<div class="ex-block">' +
            '<div class="row-between"><span class="bold">' + U.escape(ex.name) + '</span>' +
            (last ? '<button class="btn btn-ghost btn-sm" data-act="use-last" data-ex="' + ei + '">照上次记</button>' : '') +
            '</div>';
          if (last) {
            html += '<div class="tiny faint">上次：' + U.escape(F.setsText(last)) + '</div>';
          }
          html += '<div class="set-grid">';
          (ex.sets || []).forEach(function (set, si) {
            html += '<span class="set-chip" data-act="toggle-set" data-ex="' + ei + '" data-set="' + si + '" data-done="' + (set.done ? 1 : 0) + '">' +
              '<span class="dot" style="background:' + (set.done ? 'var(--accent)' : 'var(--border-strong)') + '"></span>' +
              '<input type="number" data-change="set-field" data-ex="' + ei + '" data-set="' + si + '" data-field="reps" ' +
              'value="' + (set.reps === '' ? '' : set.reps) + '" style="width:38px;padding:1px 3px;border:0;background:transparent;text-align:center">次' +
              '<input type="number" data-change="set-field" data-ex="' + ei + '" data-set="' + si + '" data-field="weight" ' +
              'value="' + (set.weight === '' ? '' : set.weight) + '" style="width:42px;padding:1px 3px;border:0;background:transparent;text-align:center">kg' +
              '</span>';
          });
          html += '<button class="btn btn-ghost btn-sm" data-act="add-set" data-ex="' + ei + '">+ 一组</button>';
          html += '</div></div>';
        });
        html += '<button class="btn btn-primary" data-act="finish" style="margin-top:10px;width:100%">完成训练</button>';
      }
      html += '</div></div>';

      html += '<div class="stack">';
      html += '<div class="card card-pad"><div class="row-between" style="margin-bottom:8px"><h3>打卡日历</h3>' +
        '<span class="tiny faint">近 12 周</span></div><div class="heat">';
      F.heatmap(84, ctx.today).forEach(function (d) {
        html += '<i class="' + (d.on ? 'on' : '') + (d.today ? ' today' : '') + '" title="' + d.date + '"></i>';
      });
      html += '</div></div>';

      html += '<div class="card card-pad"><div class="row-between" style="margin-bottom:8px"><h3>体重</h3>' +
        '<span class="tiny faint">最近 7 次</span></div>';
      var series = (snap.bodyMetrics || []).slice(-7);
      html += sparkline(series);
      html += '<div class="row" style="margin-top:8px">' +
        '<input type="number" step="0.1" data-weight placeholder="体重 kg" value="' +
        (series.length ? series[series.length - 1].weight : '') + '">' +
        '<button class="btn btn-sm" data-act="save-weight">记录</button></div>';
      html += '</div>';
      html += '</div></div>';
      return html;
    },

    mount: function (root, ctx) {
      function openTemplate(weekday) {
        var tpl = F.templateFor(weekday);
        App.ui.openDrawer({
          title: F.weekName(weekday) + ' 的安排',
          body:
            App.ui.field('这套训练叫什么', '<input type="text" data-name value="' +
              U.escape(tpl ? tpl.name : '') + '" placeholder="例如：上肢 · 推">') +
            '<label class="row small" style="gap:7px;margin-bottom:12px;cursor:pointer">' +
            '<input type="checkbox" data-rest ' + (tpl && tpl.isRest ? 'checked' : '') + ' style="width:auto"> 这天休息</label>' +
            App.ui.field('动作（一行一个，格式：卧推 4x8）',
              '<textarea data-exercises style="min-height:120px" placeholder="卧推 4x8&#10;上斜卧推 3x10&#10;侧平举 3x12">' +
              U.escape(tpl ? F.formatExercises(tpl.exercises) : '') + '</textarea>') +
            '<div class="note">只写名字也行，默认 3 组 × 10 次。</div>',
          foot: '<button class="btn btn-danger" data-del>清除</button><button class="btn btn-primary" data-save>保存</button>',
          onMount: function (panel, close) {
            panel.querySelector('[data-save]').addEventListener('click', function () {
              F.saveTemplate({
                weekday: weekday,
                name: panel.querySelector('[data-name]').value,
                isRest: panel.querySelector('[data-rest]').checked,
                exercisesText: panel.querySelector('[data-exercises]').value
              }).then(function () {
                close();
                App.refresh();
                App.ui.toast('已保存');
              });
            });
            panel.querySelector('[data-del]').addEventListener('click', function () {
              if (!tpl) { close(); return; }
              F.removeTemplate(tpl.id).then(function () { close(); App.refresh(); });
            });
          }
        });
      }

      App.ui.bind(root, {
        acts: {
          'edit-template': function (d) { openTemplate(Number(d.weekday)); },
          start: function () {
            F.startSession(ctx.today).then(function (s) {
              if (!s) { App.ui.toast('今天没有训练安排'); return; }
              App.refresh();
            });
          },
          'toggle-set': function (d, el, e) {
            if (e.target.tagName === 'INPUT') return;
            var session = F.todaySession(ctx.today);
            if (!session) return;
            F.toggleSet(session.id, Number(d.ex), Number(d.set)).then(function () { App.refresh(); });
          },
          'set-field': function (d, el) {
            var session = F.todaySession(ctx.today);
            if (!session) return;
            var patch = {};
            patch[d.field] = el.value === '' ? '' : Number(el.value);
            F.updateSet(session.id, Number(d.ex), Number(d.set), patch).then(function () {
              if (el.getAttribute('data-field') !== 'reps') App.refresh();
            });
          },
          'add-set': function (d) {
            var session = F.todaySession(ctx.today);
            if (!session) return;
            F.addSet(session.id, Number(d.ex)).then(function () { App.refresh(); });
          },
          'use-last': function (d) {
            var session = F.todaySession(ctx.today);
            if (!session) return;
            var ex = session.exercises[Number(d.ex)];
            var last = F.lastSets(App.store.list('sessions').filter(function (s) { return s.id !== session.id; }), ex.name);
            if (!last) { App.ui.toast('没有上次记录'); return; }
            var chain = Promise.resolve();
            last.forEach(function (set, i) {
              chain = chain.then(function () {
                return F.updateSet(session.id, Number(d.ex), i, { reps: set.reps, weight: set.weight });
              });
            });
            chain.then(function () {
              App.ui.toast('已按上次填好，只改有变化的那组');
              App.refresh();
            });
          },
          finish: function () {
            var session = F.todaySession(ctx.today);
            if (!session) return;
            var prog = F.progress(session);
            App.ui.openDrawer({
              title: '完成训练',
              body: '<p class="small muted" style="margin-bottom:12px">完成 ' + prog.done + ' / ' + prog.total + ' 组。</p>' +
                App.ui.field('今天感觉怎么样（可空）', '<textarea data-feel placeholder="状态好 / 有点累 / 哪个动作卡住了">' +
                  U.escape(session.feel || '') + '</textarea>'),
              foot: '<button class="btn" data-cancel>再练会儿</button><button class="btn btn-primary" data-save>保存</button>',
              onMount: function (panel, close) {
                panel.querySelector('[data-cancel]').addEventListener('click', close);
                panel.querySelector('[data-save]').addEventListener('click', function () {
                  F.finishSession(session.id, panel.querySelector('[data-feel]').value).then(function () {
                    close();
                    App.refresh();
                    App.ui.toast('今天的训练记下了');
                  });
                });
              }
            });
          },
          'save-weight': function (d, el) {
            var input = root.querySelector('[data-weight]');
            F.addBodyMetric({ weight: input.value }).then(function () {
              App.ui.toast('已记录');
              App.refresh();
            });
          }
        }
      });
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
