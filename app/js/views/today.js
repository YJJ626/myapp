(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var views = App.views = App.views || {};

  function taskRow(t) {
    var done = t.status === 'done';
    return '<div class="task-row" draggable="true" data-drag-id="' + t.id + '">' +
      '<span class="check" data-act="toggle" data-id="' + t.id + '" data-done="' + (done ? 1 : 0) + '"></span>' +
      '<span class="dot" style="background:' + U.moduleColor(t.moduleTag) + '"></span>' +
      '<span class="task-title ' + (done ? 'done-text' : '') + '">' + U.escape(t.title) + '</span>' +
      (t.estMin ? '<span class="tag">' + t.estMin + ' 分</span>' : '') +
      '<span class="task-actions">' +
      '<button class="btn btn-ghost btn-sm" data-act="tomorrow" data-id="' + t.id + '">明天</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="del" data-id="' + t.id + '">删除</button>' +
      '</span></div>';
  }

  function slotBlock(name, key, tasks, placeholder) {
    var html = '<div class="slot" data-drop="slot" data-slot="' + key + '">';
    html += '<div class="slot-head"><span>' + name + '</span><span class="faint">' +
      (tasks.length ? tasks.filter(function (t) { return t.status === 'done'; }).length + ' / ' + tasks.length : '') +
      '</span></div>';
    tasks.forEach(function (t) { html += taskRow(t); });
    html += '<input type="text" class="inline-add" data-enter="add-task" data-slot="' + key + '" placeholder="' + placeholder + '">';
    html += '</div>';
    return html;
  }

  views.today = {
    title: '今日计划',
    render: function (snap) {
      var date = snap.today;
      var tasks = snap.tasks.filter(function (t) { return t.date === date && t.status !== 'dropped'; });
      var bySlot = { inbox: [], am: [], pm: [], eve: [] };
      tasks.forEach(function (t) { (bySlot[t.slot] || bySlot.inbox).push(t); });
      var done = tasks.filter(function (t) { return t.status === 'done'; }).length;
      var pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
      var yesterday = snap.tasks.filter(function (t) {
        return t.date === U.addDays(date, -1) && t.status !== 'done' && t.status !== 'dropped';
      });
      var notes = snap.notes.filter(function (n) { return n.id === date; })[0] || {};

      var html = '<div class="page-head"><div class="grow"><h1>今日计划</h1>' +
        '<div class="sub">' + U.escape(U.fmtDateCN(date)) + ' · 把事排进上午、下午、晚上</div></div>' +
        '<div class="page-actions">' +
        '<button class="btn btn-sm" data-act="open-repeat">重复项</button>' +
        '<button class="btn btn-sm btn-primary" data-act="open-review">日终回顾</button>' +
        '</div></div>';

      if (yesterday.length) {
        html += '<div class="banner"><span>昨天有 ' + yesterday.length + ' 项未完成，要搬过来吗？</span>' +
          '<span class="row"><button class="btn btn-sm" data-act="drop-yesterday">放弃</button>' +
          '<button class="btn btn-sm btn-primary" data-act="carry-over">移到今天</button></span></div>';
      }

      if (!tasks.length) {
        html += '<div class="empty" data-empty="1" style="border:1px dashed var(--border-strong);border-radius:10px;margin-bottom:12px">' +
          '<div class="empty-title">今天还是一张白纸</div>' +
          '<div class="empty-hint">先写今天最想完成的一件事，下面任一时段的输入框都能直接加</div>' +
          '</div>';
      }

      html += '<div class="grid-2">';
      html += '<div>' + slotBlock('上午', 'am', bySlot.am, '+ 加到上午，回车') +
        slotBlock('下午', 'pm', bySlot.pm, '+ 加到下午，回车') +
        slotBlock('晚上', 'eve', bySlot.eve, '+ 加到晚上，回车') + '</div>';

      html += '<div>';
      html += slotBlock('未安排', 'inbox', bySlot.inbox, '+ 先扔进来，回头再排');

      html += '<div class="card card-pad">' +
        '<div class="row-between" style="margin-bottom:8px"><h3>今日进度</h3>' +
        '<span class="small faint">' + done + ' / ' + tasks.length + '</span></div>' +
        App.ui.bar(pct) +
        '<div class="small muted" style="margin-top:8px">' +
        (tasks.length ? ('完成了 ' + pct + '%，' + (tasks.length - done) + ' 项还没动') : '还没有安排的任务') +
        '</div>' +
        (notes.review ? '<div class="note" style="margin-top:10px">回顾：' + U.escape(notes.review) + '</div>' : '') +
        '</div>';

      html += '<div class="card card-pad" style="margin-top:12px">' +
        '<div class="row-between" style="margin-bottom:8px"><h3>每天/每周固定的事</h3>' +
        '<button class="btn btn-ghost btn-sm" data-act="open-repeat">管理</button></div>';
      if (!snap.repeats.length) {
        html += '<div class="small faint">还没有重复项。像"背单词""写日报"这种，设一次就自动出现。</div>';
      } else {
        snap.repeats.forEach(function (r) {
          html += '<div class="mini-row"><span>' + U.escape(r.title) + '</span>' +
            '<span class="tag">' + U.slotName(r.slot) + '</span>' +
            '<span class="x" data-act="del-repeat" data-id="' + r.id + '">✕</span></div>';
        });
      }
      html += '</div>';

      html += '</div></div>';
      return html;
    },

    mount: function (root, ctx) {
      App.logic.today.materializeRepeats(ctx.today).then(function (n) {
        if (n > 0) App.refresh();
      });

      function openReview() {
        var date = ctx.today;
        var tasks = App.store.list('tasks').filter(function (t) { return t.date === date && t.status !== 'dropped'; });
        var done = tasks.filter(function (t) { return t.status === 'done'; }).length;
        var note = App.logic.today.note(date);
        App.ui.openDrawer({
          title: '日终回顾',
          body:
            '<p class="small muted" style="margin-bottom:12px">今天 ' + done + ' / ' + tasks.length + ' 项完成。</p>' +
            App.ui.field('明天最重要的一件事', '<textarea data-tomorrow placeholder="写成一句话，它会自动变成明天上午的第一条任务">' +
              U.escape(note.review || '') + '</textarea>') +
            '<div class="note">写下之后，明天的第一条上午任务会直接用这句话。</div>',
          foot: '<button class="btn" data-close-x>取消</button><button class="btn btn-primary" data-save>保存</button>',
          onMount: function (panel, close) {
            panel.querySelector('[data-close-x]').addEventListener('click', function () { close(); });
            panel.querySelector('[data-save]').addEventListener('click', function () {
              var text = panel.querySelector('[data-tomorrow]').value;
              App.logic.today.finishReview(text).then(function () {
                close();
                App.ui.toast('已记下，明天见');
                App.refresh();
              });
            });
          }
        });
      }

      function openRepeat() {
        var body = '<div id="repeat-list">';
        var repeats = App.store.list('repeats');
        if (!repeats.length) {
          body += '<p class="small faint" style="margin-bottom:12px">还没有重复项。</p>';
        } else {
          repeats.forEach(function (r) {
            body += '<div class="mini-row"><span>' + U.escape(r.title) + '</span>' +
              '<span class="tag">' + U.slotName(r.slot) + '</span>' +
              '<span class="x" data-del="' + r.id + '">✕</span></div>';
          });
        }
        body += '</div><hr>' +
          App.ui.field('要重复的事', '<input type="text" data-title placeholder="例如：背 30 个单词">') +
          '<div class="field-row">' +
          App.ui.field('放到哪个时段', '<select data-slot>' +
            '<option value="am">上午</option><option value="pm">下午</option><option value="eve">晚上</option></select>') +
          App.ui.field('重复频率', '<select data-days>' +
            '<option value="1,2,3,4,5,6,7">每天</option>' +
            '<option value="1,2,3,4,5">工作日</option>' +
            '<option value="6,7">周末</option></select>') +
          '</div>';

        App.ui.openDrawer({
          title: '重复项',
          body: body,
          foot: '<button class="btn btn-primary" data-add>添加</button>',
          onMount: function (panel, close) {
            panel.querySelector('[data-add]').addEventListener('click', function () {
              var title = panel.querySelector('[data-title]').value;
              if (!title.trim()) { App.ui.toast('先写要重复什么事'); return; }
              var slot = panel.querySelector('[data-slot]').value;
              var days = panel.querySelector('[data-days]').value.split(',').map(Number);
              App.logic.today.addRepeat({ title: title, slot: slot, days: days }).then(function () {
                close();
                App.refresh();
                App.ui.toast('已添加');
              });
            });
            panel.querySelectorAll('[data-del]').forEach(function (btn) {
              btn.addEventListener('click', function () {
                App.store.remove('repeats', btn.getAttribute('data-del')).then(function () {
                  close();
                  App.refresh();
                });
              });
            });
          }
        });
      }

      App.ui.bind(root, {
        acts: {
          toggle: function (d) { App.logic.today.toggleTask(d.id).then(function () { App.refresh(); }); },
          tomorrow: function (d) {
            App.logic.today.moveToTomorrow(d.id).then(function () {
              App.ui.toast('已移到明天');
              App.refresh();
            });
          },
          del: function (d) { App.logic.today.removeTask(d.id).then(function () { App.refresh(); }); },
          'add-task': function (d, el) {
            var val = el.value;
            if (!val.trim()) return;
            App.logic.today.addTask({ title: val, slot: el.getAttribute('data-slot'), date: ctx.today })
              .then(function () { App.refresh(); });
          },
          'carry-over': function () {
            App.logic.today.carryOver().then(function (n) {
              App.ui.toast('已搬过来 ' + n + ' 项');
              App.refresh();
            });
          },
          'drop-yesterday': function () {
            App.logic.today.dropYesterday().then(function () { App.refresh(); });
          },
          'open-review': openReview,
          'open-repeat': openRepeat,
          'del-repeat': function (d) {
            App.store.remove('repeats', d.id).then(function () { App.refresh(); });
          },
          'drop:slot': function (d) {
            if (!d.id) return;
            App.logic.today.moveTask(d.id, d.slot).then(function () { App.refresh(); });
          }
        }
      });
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
