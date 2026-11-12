(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var views = App.views = App.views || {};

  function sumCard(opts) {
    var cls = 'sum-card';
    if (opts.alert) cls += ' alert';
    if (opts.idle) cls += ' idle';
    return '<button class="' + cls + '" data-act="jump" data-to="' + opts.to + '"' +
      (opts.focus ? ' data-focus="' + U.escape(opts.focus) + '"' : '') + '>' +
      '<div class="sum-label">' + U.escape(opts.label) + '</div>' +
      '<div class="sum-main">' + opts.main + '</div>' +
      '<div class="sum-sub">' + opts.sub + '</div>' +
      '</button>';
  }

  function short(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  views.home = {
    title: '首页',
    render: function (snap) {
      var h = App.derive.home(snap);
      var html = '';
      var dateCN = U.fmtDateCN(snap.today);

      html += '<div class="page-head">';
      html += '<div class="grow"><h1>' + U.escape(dateCN) + '</h1>';
      html += '<input type="text" data-enter="save-headline" value="' + U.escape(h.headline) + '" ' +
        'placeholder="今天最重要的一件事" style="border:0;background:transparent;padding:0;margin-top:5px;' +
        'font-size:13px;color:var(--text-2);max-width:440px">';
      html += '</div><div class="page-actions">';
      html += '<button class="btn btn-sm" data-act="quick">⌘K 快速记录</button>';
      html += '<button class="btn btn-sm btn-primary" data-act="jump" data-to="today">去排今天的计划</button>';
      html += '</div></div>';

      // 今日计划
      html += '<div class="grid-2">';
      html += '<div class="card"><div class="card-head"><h3>今日计划</h3>' +
        '<span class="small faint">完成 ' + h.taskCount.done + ' / ' + h.taskCount.total + '</span></div>';
      html += '<div class="card-pad">';
      if (!h.tasks.length) {
        html += '<div class="empty" data-empty="1">' +
          '<div class="empty-title">今天还没有安排</div>' +
          '<div class="empty-hint">排三件最重要的事就够了，剩下的留给意外</div>' +
          '<button class="btn btn-primary btn-sm" data-act="jump" data-to="today">去排今天的计划</button>' +
          '</div>';
      } else {
        h.tasks.forEach(function (t) {
          var done = t.status === 'done';
          html += '<div class="list-row">' +
            '<span class="check" data-act="toggle" data-id="' + t.id + '" data-done="' + (done ? 1 : 0) + '"></span>' +
            '<span class="dot" style="background:' + U.moduleColor(t.moduleTag) + '"></span>' +
            '<span class="grow ' + (done ? 'done-text' : '') + '">' + U.escape(t.title) + '</span>' +
            (t.estMin ? '<span class="tag">' + t.estMin + ' 分</span>' : '') +
            '</div>';
        });
      }
      html += '</div></div>';

      // 快速备忘
      html += '<div class="card"><div class="card-head"><h3>快速备忘</h3>' +
        '<span class="small faint">' + h.memoTotal + ' 条</span></div><div class="card-pad">';
      html += '<input type="text" class="memo-input" data-enter="add-memo" placeholder="想到什么，回车即存">';
      html += '<div style="margin-top:10px">';
      if (!h.memos.length) {
        html += '<div class="small faint" style="padding:8px 2px">没有待处理的备忘。随手记的东西都会先落在这里。</div>';
      } else {
        h.memos.forEach(function (m) {
          html += '<div class="list-row" style="align-items:flex-start">' +
            '<span class="grow" style="line-height:1.5">' + U.escape(m.text) + '</span>' +
            '<button class="btn btn-ghost btn-sm" data-act="memo-to-task" data-id="' + m.id + '">转任务</button>' +
            '<button class="btn btn-ghost btn-sm" data-act="memo-drop" data-id="' + m.id + '">丢掉</button>' +
            '</div>';
        });
        if (h.memoTotal > h.memos.length) {
          html += '<div class="small faint" style="padding:6px 2px">还有 ' + (h.memoTotal - h.memos.length) + ' 条</div>';
        }
      }
      html += '</div></div></div></div>';

      // 六张摘要卡
      html += '<div class="grid-3 home-cards">';

      var dev = h.dev;
      html += sumCard({
        label: '开发工作', to: 'dev', focus: dev ? dev.id : '',
        alert: !!(dev && (dev.overdue || dev.soon)),
        idle: !dev,
        main: dev ? (dev.overdue ? ('已逾期 ' + Math.abs(dev.daysLeft) + ' 天') : ('还剩 ' + dev.daysLeft + ' 天')) : '暂无在做的项目',
        sub: dev ? U.escape(short(dev.name, 12)) : '建一个项目，填上截止日期'
      });

      var cons = h.consult;
      html += sumCard({
        label: '咨询工作', to: 'consult',
        idle: cons.count === 0,
        alert: cons.maxWaitDays >= 2,
        main: cons.count ? (cons.count + ' 条待回复') : '都回完了',
        sub: cons.count ? ('最长等了 ' + cons.maxWaitDays + ' 天') : '没有人在等'
      });

      var media = h.media;
      html += sumCard({
        label: '自媒体', to: 'media',
        idle: media.type === 'none',
        main: media.type === 'today' ? ('今天发：' + U.escape(short(media.title, 10)))
          : media.type === 'scheduled' ? (media.count + ' 条待发布')
            : media.type === 'drafting' ? (media.count + ' 条在写')
              : '暂无排期',
        sub: media.type === 'none' ? '扔 3 个选题进来就有事可做了'
          : (media.platform ? (media.platform + ' · ' + (media.drafting || 0) + ' 条在写') : ((media.drafting || 0) + ' 条在写'))
      });

      var fit = h.fitness;
      html += sumCard({
        label: '健身计划', to: 'fitness',
        idle: !fit.hasTemplate || fit.rest,
        main: fit.rest ? '今天休息' : (fit.hasTemplate ? ('今天：' + U.escape(short(fit.name, 10))) : '还没有周模板'),
        sub: fit.hasTemplate ? ('本周已练 ' + fit.weekDone + ' / ' + fit.weekTarget + ' 次') : '先建周一那套训练'
      });

      var diet = h.diet;
      html += sumCard({
        label: '饮食计划', to: 'diet',
        main: diet.kcal + ' / ' + diet.target + ' kcal',
        sub: diet.nextMeal
          ? ('下一餐 ' + diet.nextMealName + (diet.nextNames.length ? '：' + U.escape(short(diet.nextNames.join('、'), 12)) : ''))
          : '四餐都记完了'
      });

      var games = h.games;
      html += sumCard({
        label: '游戏娱乐', to: 'games',
        alert: games.over,
        main: games.over ? ('超了 ' + U.minutesToHM(games.used - games.goal)) : ('本周剩 ' + U.minutesToHM(games.remain)),
        sub: '已用 ' + U.minutesToHM(games.used) + (games.current ? (' · ' + U.escape(short(games.current, 8))) : '')
      });

      html += '</div>';

      html += '<div class="home-foot"><span>数据已保存</span><span>';
      if (h.backupDue) html += '<span class="backup-hint">已超过 30 天没备份，建议去设置里导出一次 · </span>';
      html += '今天记录了 ' + h.recorded + ' 条</span></div>';

      return html;
    },

    mount: function (root) {
      App.ui.bind(root, {
        acts: {
          quick: function () { App.ui.quickCapture(); },
          jump: function (d) {
            location.hash = '#/' + d.to + (d.focus ? '?focus=' + d.focus : '');
          },
          'add-memo': function (d, el) {
            var val = el.value;
            if (!val.trim()) return;
            App.logic.today.captureMemo(val).then(function () {
              App.ui.toast('已记下');
              App.refresh();
            });
          },
          'memo-to-task': function (d) {
            var memo = App.store.get('memos', d.id);
            if (!memo) return;
            Promise.resolve()
              .then(function () { return App.logic.today.addTask({ title: memo.text, slot: 'inbox' }); })
              .then(function () { return App.store.put('memos', Object.assign({}, memo, { state: 'done' })); })
              .then(function () {
                App.ui.toast('已转到今日计划的未安排区');
                App.refresh();
              });
          },
          'memo-drop': function (d) {
            var memo = App.store.get('memos', d.id);
            if (!memo) return;
            App.store.put('memos', Object.assign({}, memo, { state: 'dropped' })).then(function () {
              App.refresh();
            });
          },
          toggle: function (d) {
            App.logic.today.toggleTask(d.id).then(function () { App.refresh(); });
          },
          'save-headline': function (d, el) {
            App.logic.today.setHeadline(el.value).then(function () {
              App.refresh();
            });
          }
        }
      });
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
