(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var views = App.views = App.views || {};
  var G = App.logic.games;

  views.games = {
    title: '游戏娱乐',
    render: function (snap, ctx) {
      var goal = (snap.settings.goals || {}).weeklyGameMin || 600;
      var used = G.weekUsed(ctx.weekStartKey, snap.playSessions);
      var remain = Math.max(0, goal - used);
      var over = used > goal;
      var timer = (snap.meta || []).filter(function (m) { return m.id === 'timer'; })[0];
      var runningGame = timer ? (snap.games || []).filter(function (g) { return g.id === timer.gameId; })[0] : null;

      var html = '<div class="page-head"><div class="grow"><h1>游戏娱乐</h1>' +
        '<div class="sub">这周玩了 ' + U.minutesToHM(used) + '，预算是 ' + U.minutesToHM(goal) + '</div></div>' +
        '<div class="page-actions">' +
        '<button class="btn btn-sm" data-act="set-budget">设预算</button>' +
        '<button class="btn btn-sm btn-primary" data-act="new-game">加一个游戏</button>' +
        '</div></div>';

      html += '<div class="card card-pad" style="margin-bottom:14px">' +
        '<div class="row-between wrap" style="margin-bottom:10px">' +
        '<div><div class="small faint">本周还剩</div>' +
        '<div class="budget"><span class="budget-num" ' + (over ? 'style="color:var(--danger)"' : '') + '>' +
        U.minutesToHM(remain) + '</span></div></div>' +
        '<div class="right small muted">' +
        (over ? ('已经超了 ' + U.minutesToHM(used - goal)) : ('已用 ' + U.minutesToHM(used) + ' / ' + U.minutesToHM(goal))) +
        '</div></div>' +
        App.ui.bar(goal ? used / goal * 100 : 0, over ? 'danger' : '') +
        '<div class="row-between" style="margin-top:12px">';

      if (timer) {
        html += '<div class="row" style="gap:8px"><span class="timer-num" data-timer>' +
          U.minutesToHM(G.elapsedMinutes(timer)) + '</span>' +
          '<span class="small muted">' + (runningGame ? U.escape(runningGame.name) : '正在计时') + '</span></div>' +
          '<button class="btn btn-primary btn-sm" data-act="stop-timer">停止并记录</button>';
      } else {
        html += '<div class="small muted">没在玩的时候，这里什么都不用管。</div>' +
          '<button class="btn btn-sm" data-act="start-timer">开始计时</button>';
      }
      html += '</div></div>';

      html += '<div class="split">';
      html += '<div class="card"><div class="card-head"><h3>游戏库</h3>' +
        '<span class="small faint">' + (snap.games || []).length + ' 个</span></div><div class="card-pad">';
      if (!(snap.games || []).length) {
        html += '<div class="empty" data-empty="1"><div class="empty-title">还没有游戏</div>' +
          '<div class="empty-hint">加一个正在玩的，记个进度和时长</div>' +
          '<button class="btn btn-primary btn-sm" data-act="new-game">加一个游戏</button></div>';
      } else {
        (snap.games || []).forEach(function (g) {
          html += '<div class="list-row" data-act="open-game" data-id="' + g.id + '" style="cursor:pointer">' +
            '<span class="grow"><span class="bold">' + U.escape(g.name) + '</span>' +
            '<span class="tiny faint">' + (g.platform ? ' · ' + U.escape(g.platform) : '') +
            (g.progress ? ' · ' + U.escape(g.progress) : '') + '</span></span>' +
            '<span class="tag ' + (g.status === 'playing' ? 'tag-accent' : '') + '">' + U.escape(G.STATUS[g.status] || '在玩') + '</span>' +
            '</div>';
        });
      }
      html += '</div></div>';

      html += '<div class="stack">';
      html += '<div class="card card-pad"><div class="row-between" style="margin-bottom:8px"><h3>还欠着的</h3>' +
        '<span class="tiny faint">游戏 / 剧 / 番</span></div>' +
        '<input type="text" data-enter="add-wish" placeholder="想玩的想看的，回车">' +
        '<div style="margin-top:8px">';
      if (!(snap.wishItems || []).length) {
        html += '<div class="tiny faint">清单是空的。</div>';
      }
      (snap.wishItems || []).forEach(function (w) {
        html += '<div class="list-row">' +
          '<span class="check" data-act="toggle-wish" data-id="' + w.id + '" data-done="' + (w.done ? 1 : 0) + '"></span>' +
          '<span class="grow ' + (w.done ? 'done-text' : '') + '">' + U.escape(w.title) + '</span>' +
          '<span class="tag">' + U.escape(G.wishTypes[w.type] || '游戏') + '</span></div>';
      });
      html += '</div></div>';

      html += '<div class="card card-pad"><h3 style="margin-bottom:8px">最近玩的</h3>';
      var recent = (snap.playSessions || []).slice(0, 6);
      if (!recent.length) {
        html += '<div class="tiny faint">还没有记录。</div>';
      }
      recent.forEach(function (p) {
        var g = (snap.games || []).filter(function (x) { return x.id === p.gameId; })[0];
        html += '<div class="row-between small" style="padding:3px 0">' +
          '<span>' + U.escape(g ? g.name : '未指定游戏') + (p.manual ? '（手填）' : '') + '</span>' +
          '<span class="faint">' + U.minutesToHM(p.minutes) + '</span></div>';
      });
      html += '</div>';
      html += '</div></div>';

      return html;
    },

    mount: function (root, ctx) {
      if (App.uiState && App.uiState.timerInt) {
        clearInterval(App.uiState.timerInt);
        App.uiState.timerInt = null;
      }
      var timer = G.timer();
      if (timer) {
        App.uiState = App.uiState || {};
        App.uiState.timerInt = setInterval(function () {
          var el = root.querySelector('[data-timer]');
          if (!el) { clearInterval(App.uiState.timerInt); return; }
          el.textContent = U.minutesToHM(G.elapsedMinutes(G.timer()));
        }, 30000);
      }

      function openBudget() {
        var goal = App.store.settings.goals.weeklyGameMin || 600;
        App.ui.openDrawer({
          title: '本周娱乐预算',
          body: App.ui.field('每周最多玩（小时）', '<input type="number" step="0.5" data-hours value="' +
            Math.round(goal / 6) / 10 + '">') +
            '<div class="note">超了不会拦你，只是首页会提醒一声。</div>',
          foot: '<button class="btn btn-primary" data-save>保存</button>',
          onMount: function (panel, close) {
            panel.querySelector('[data-save]').addEventListener('click', function () {
              var hours = Number(panel.querySelector('[data-hours]').value) || 0;
              G.setBudget(Math.round(hours * 60)).then(function () {
                close();
                App.refresh();
              });
            });
          }
        });
      }

      function openGame(id) {
        var g = App.store.get('games', id);
        if (!g) return;
        var body = '<div class="field-row">' +
          App.ui.field('平台', '<input type="text" data-platform value="' + U.escape(g.platform || '') + '">') +
          App.ui.field('状态', '<select data-status>' + Object.keys(G.STATUS).map(function (k) {
            return '<option value="' + k + '"' + (g.status === k ? ' selected' : '') + '>' + G.STATUS[k] + '</option>';
          }).join('') + '</select>') +
          '</div>' +
          App.ui.field('进度', '<input type="text" data-progress value="' + U.escape(g.progress || '') +
            '" placeholder="第三章 / 62%">') +
          App.ui.field('评分（1-5，可空）', '<input type="number" min="1" max="5" data-rating value="' +
            (g.rating || '') + '">') +
          App.ui.field('短评', '<textarea data-review placeholder="通关之后想说的话">' + U.escape(g.review || '') + '</textarea>');

        App.ui.openDrawer({
          title: g.name,
          body: body,
          foot: '<button class="btn btn-danger" data-del>删除</button><button class="btn btn-primary" data-save>保存</button>',
          onMount: function (panel, close) {
            panel.querySelector('[data-save]').addEventListener('click', function () {
              G.update(id, {
                platform: panel.querySelector('[data-platform]').value,
                status: panel.querySelector('[data-status]').value,
                progress: panel.querySelector('[data-progress]').value,
                rating: panel.querySelector('[data-rating]').value === '' ? null : Number(panel.querySelector('[data-rating]').value),
                review: panel.querySelector('[data-review]').value
              }).then(function () {
                close();
                App.refresh();
                App.ui.toast('已保存');
              });
            });
            panel.querySelector('[data-del]').addEventListener('click', function () {
              App.ui.confirm({
                title: '删除游戏', message: '「' + g.name + '」会从库里移除。', okLabel: '删除',
                onOk: function () { G.remove(id).then(function () { close(); App.refresh(); }); }
              });
            });
          }
        });
      }

      function openNewGame() {
        App.ui.openDrawer({
          title: '加一个游戏',
          body: App.ui.field('名称', '<input type="text" data-name placeholder="例如：塞尔达">') +
            App.ui.field('平台（可空）', '<input type="text" data-platform placeholder="Switch / Steam / 手机">') +
            App.ui.field('进度（可空）', '<input type="text" data-progress placeholder="刚开局">'),
          foot: '<button class="btn btn-primary" data-save>添加</button>',
          onMount: function (panel, close) {
            panel.querySelector('[data-name]').focus();
            panel.querySelector('[data-save]').addEventListener('click', function () {
              G.add({
                name: panel.querySelector('[data-name]').value,
                platform: panel.querySelector('[data-platform]').value,
                progress: panel.querySelector('[data-progress]').value
              }).then(function (row) {
                if (!row) { App.ui.toast('先写名字'); return; }
                close();
                App.refresh();
              });
            });
          }
        });
      }

      function pickStartGame() {
        var games = App.store.list('games').filter(function (g) { return g.status !== 'cleared'; });
        if (!games.length) { openNewGame(); return; }
        App.ui.openDrawer({
          title: '在玩哪个',
          body: '<div class="pick-list">' + games.map(function (g) {
            return '<div class="pick-row" data-game="' + g.id + '"><span class="grow">' + U.escape(g.name) + '</span>' +
              '<span class="tiny faint">' + U.escape(g.progress || '') + '</span></div>';
          }).join('') + '</div>',
          onMount: function (panel, close) {
            panel.querySelectorAll('[data-game]').forEach(function (el) {
              el.addEventListener('click', function () {
                G.startTimer(el.getAttribute('data-game')).then(function () {
                  close();
                  App.refresh();
                  App.ui.toast('开始计时');
                });
              });
            });
          }
        });
      }

      App.ui.bind(root, {
        acts: {
          'set-budget': openBudget,
          'new-game': openNewGame,
          'open-game': function (d) { openGame(d.id); },
          'start-timer': pickStartGame,
          'stop-timer': function () {
            G.stopTimer().then(function (session) {
              App.refresh();
              if (session) App.ui.toast('记了 ' + U.minutesToHM(session.minutes));
            });
          },
          'add-wish': function (d, el) {
            if (!el.value.trim()) return;
            G.addWish({ title: el.value }).then(function () {
              el.value = '';
              App.refresh();
            });
          },
          'toggle-wish': function (d) {
            G.toggleWish(d.id).then(function () { App.refresh(); });
          }
        }
      });
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
