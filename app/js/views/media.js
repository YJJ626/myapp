(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var views = App.views = App.views || {};
  var M = App.logic.media;

  var PLATFORM_COLOR = {
    bilibili: '#378ADD',
    xiaohongshu: '#D4537E',
    wechat: '#1D9E75',
    douyin: '#5F5E5A'
  };

  function card(c) {
    return '<div class="kcard" draggable="true" data-drag-id="' + c.id + '" data-act="open" data-id="' + c.id + '">' +
      '<div class="kcard-title">' + U.escape(c.title) + '</div>' +
      '<div class="kcard-meta"><span class="dot" style="background:' + (PLATFORM_COLOR[c.platform] || '#888') + '"></span>' +
      U.escape(M.platformName(c.platform)) +
      (c.planDate ? ' · ' + U.escape(U.fmtShort(c.planDate)) : '') +
      (c.stage === 'published' && c.stats && c.stats.view ? ' · ' + c.stats.view + ' 播放' : '') +
      '</div></div>';
  }

  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 10000) {
      var v = U.round(n / 10000, 2);
      return (v % 1 === 0 ? v.toFixed(1) : String(v)) + ' 万';
    }
    return String(n);
  }

  function kpi(label, val, sub) {
    return '<div class="kpi"><div class="kpi-label">' + U.escape(label) + '</div>' +
      '<div class="kpi-val">' + val + '</div>' +
      '<div class="kpi-sub">' + sub + '</div></div>';
  }

  function statsView(snap, ctx) {
    var ov = M.overview(snap.contents, ctx.today);
    if (!ov.rows.length) {
      return '<div class="card">' + App.ui.empty({
        title: '还没有发布数据',
        hint: '把内容拖到「已发布」，再填上播放、点赞、涨粉，这里就会出现图表',
        action: 'new',
        actionLabel: '先建一条内容'
      }) + '</div>';
    }

    var html = '<div class="kpi-grid">';
    html += kpi('总播放', fmtNum(ov.totals.view), ov.totals.count + ' 条已发布');
    html += kpi('总点赞', fmtNum(ov.totals.like), '互动率 ' + ov.totals.engagement + '%');
    html += kpi('净涨粉', (ov.totals.fans > 0 ? '+' : '') + fmtNum(ov.totals.fans), '按手填数据累计');
    html += kpi('篇均播放', fmtNum(ov.totals.avgView), '最高 ' + fmtNum(ov.maxView));
    html += '</div>';

    // 每条内容的播放量
    html += '<div class="card" style="margin-top:14px"><div class="card-head">' +
      '<span class="head-icon">' + App.ui.icon('chart', 15) + '<h3>每条内容的播放量</h3></span>' +
      '<span class="small faint">点一下去补或改数据</span></div><div class="card-pad">' +
      '<div class="hbar-list">';
    ov.rows.slice(0, 10).forEach(function (r) {
      var pct = ov.maxView ? Math.max(3, Math.round(r.view / ov.maxView * 100)) : 0;
      html += '<div class="hbar-row" data-act="open" data-id="' + r.id + '" style="cursor:pointer">' +
        '<span class="hbar-label">' + U.escape(r.title) +
        '<span class="plat">' + U.escape(r.platformName) + '</span></span>' +
        '<span class="hbar-track"><i style="width:' + pct + '%;background:' + (PLATFORM_COLOR[r.platform] || 'var(--accent)') + '"></i></span>' +
        '<span class="hbar-val">' + fmtNum(r.view) + '</span>' +
        '</div>';
    });
    html += '</div></div></div>';

    // 近六周趋势
    html += '<div class="card" style="margin-top:14px"><div class="card-head">' +
      '<span class="head-icon">' + App.ui.icon('clock', 15) + '<h3>近 6 周发布与播放</h3></span>' +
      '<span class="small faint">柱高＝播放 · 数字＝发布条数</span></div><div class="card-pad">';
    html += '<div class="col-chart">';
    ov.weeks.forEach(function (w) {
      var h = ov.maxWeekView ? Math.max(w.view ? 6 : 0, Math.round(w.view / ov.maxWeekView * 100)) : 0;
      html += '<div class="col" title="' + U.escape(w.key) + '：' + w.count + ' 条 · ' + w.view + ' 播放">' +
        '<span class="col-y">' + (w.count || '') + '</span>' +
        '<span class="col-bar ' + (w.view ? '' : 'zero') + '" style="height:' + h + '%"></span>' +
        '<span class="col-x">' + U.escape(w.label) + '</span>' +
        '</div>';
    });
    html += '</div>';
    html += '<div class="legend-row" style="margin-top:10px"><span><i style="background:var(--accent)"></i>本周播放量</span>' +
      '<span><i style="background:var(--surface-3)"></i>这周没发东西</span></div>';
    html += '</div></div>';

    // 平台分布
    html += '<div class="card" style="margin-top:14px"><div class="card-head"><h3>平台分布</h3>' +
      '<span class="small faint">按播放量排序</span></div><div class="card-pad"><div class="hbar-list">';
    var maxP = ov.platforms.length ? ov.platforms[0].view : 0;
    ov.platforms.forEach(function (p) {
      var pct = maxP ? Math.max(3, Math.round(p.view / maxP * 100)) : 0;
      html += '<div class="hbar-row">' +
        '<span class="hbar-label">' + U.escape(p.name) + '<span class="plat">' + p.count + ' 条</span></span>' +
        '<span class="hbar-track"><i style="width:' + pct + '%;background:' + (PLATFORM_COLOR[p.key] || 'var(--accent)') + '"></i></span>' +
        '<span class="hbar-val">' + fmtNum(p.view) + '</span></div>';
    });
    html += '</div></div></div>';

    return html;
  }

  views.media = {
    title: '自媒体',

    render: function (snap, ctx) {
      App.uiState = App.uiState || {};
      var view = (ctx.params && ctx.params.view) || App.uiState.mediaView || 'board';
      if (view !== 'board' && view !== 'schedule' && view !== 'data') view = 'board';
      App.uiState.mediaView = view;
      var contents = snap.contents || [];

      var html = '<div class="page-head"><div class="grow"><h1>自媒体</h1>' +
        '<div class="sub">' + contents.length + ' 条内容 · ' +
        M.byStage(contents, 'scheduled').length + ' 条待发布</div></div>' +
        '<div class="page-actions">' +
        App.ui.seg([{ key: 'board', name: '看板' }, { key: 'schedule', name: '本周排期' }, { key: 'data', name: '数据' }], view, 'switch-view') +
        '<button class="btn btn-sm btn-primary" data-act="new">新建内容</button>' +
        '</div></div>';

      if (!contents.length) {
        html += '<div class="card">' + App.ui.empty({
          title: '还没有内容',
          hint: '先扔 3 个选题进来，选一个写成稿，排个日期',
          action: 'new',
          actionLabel: '加第一个选题'
        }) + '</div>';
      } else if (view === 'board') {
        html += '<div class="kanban">';
        M.STAGES.forEach(function (st) {
          var list = M.byStage(contents, st.key);
          html += '<div class="kcol" data-drop="col" data-stage="' + st.key + '">' +
            '<div class="kcol-head"><span>' + st.name + '</span><span>' + list.length + '</span></div>';
          list.forEach(function (c) { html += card(c); });
          if (!list.length) html += '<div class="tiny faint" style="padding:6px 4px">拖到这里</div>';
          html += '</div>';
        });
        html += '</div>';
      } else if (view === 'data') {
        html += statsView(snap, ctx);
      } else {
        var plan = M.weekPlan(contents, ctx.weekStartKey);
        html += '<div class="sched">';
        plan.forEach(function (day) {
          var isToday = day.date === ctx.today;
          html += '<div class="sched-day ' + (isToday ? 'today' : '') + '">' +
            '<div class="sched-head">' + U.escape(U.fmtShort(day.date)) + ' ' +
            U.WEEK_CN[U.parseKey(day.date).getDay()] + (isToday ? ' · 今天' : '') + '</div>';
          if (!day.items.length) html += '<div class="tiny faint">空</div>';
          day.items.forEach(function (c) {
            html += '<div class="sched-item" data-act="open" data-id="' + c.id + '" ' +
              'style="border-left-color:' + (PLATFORM_COLOR[c.platform] || '#888') + '">' +
              U.escape(c.title) + '<div class="tiny faint">' + U.escape(M.platformName(c.platform)) + ' · ' +
              U.escape(M.stageName(c.stage)) + '</div></div>';
          });
          html += '</div>';
        });
        html += '</div>';

        var unscheduled = M.unscheduled(contents);
        if (unscheduled.length) {
          html += '<div class="card card-pad" style="margin-top:14px">' +
            '<h3 style="margin-bottom:8px">还没排期的（' + unscheduled.length + '）</h3>' +
            '<div class="mini-list">';
          unscheduled.forEach(function (c) {
            html += '<div class="mini-row" data-act="open" data-id="' + c.id + '" style="cursor:pointer">' +
              U.escape(c.title) + '<span class="tag">' + U.escape(M.stageName(c.stage)) + '</span></div>';
          });
          html += '</div></div>';
        }
      }

      html += '<div class="card card-pad" style="margin-top:14px">' +
        '<div class="row-between"><h3>灵感速记</h3><span class="tiny faint">回车即进选题池</span></div>' +
        '<input type="text" data-enter="idea" placeholder="一句话想法，比如：宿舍桌面改造" style="margin-top:8px">' +
        '</div>';

      return html;
    },

    mount: function (root, ctx) {
      function openNew() {
        App.ui.openDrawer({
          title: '新建内容',
          body:
            App.ui.field('标题（先写个能记起来的）', '<input type="text" data-title placeholder="例如：大一怎么开始做项目">') +
            '<div class="field-row">' +
            App.ui.field('平台', '<select data-platform>' +
              Object.keys(M.PLATFORMS).map(function (k) {
                return '<option value="' + k + '">' + M.PLATFORMS[k] + '</option>';
              }).join('') + '</select>') +
            App.ui.field('计划发布日期（可空）', '<input type="date" data-plan>') +
            '</div>' +
            App.ui.field('一句话钩子（可空）', '<input type="text" data-hook placeholder="看完能得到什么">'),
          foot: '<button class="btn" data-cancel>取消</button><button class="btn btn-primary" data-save>创建</button>',
          onMount: function (panel, close) {
            panel.querySelector('[data-cancel]').addEventListener('click', close);
            panel.querySelector('[data-title]').focus();
            panel.querySelector('[data-save]').addEventListener('click', function () {
              var title = panel.querySelector('[data-title]').value;
              if (!title.trim()) { App.ui.toast('先写个标题'); return; }
              M.add({
                title: title,
                platform: panel.querySelector('[data-platform]').value,
                planDate: panel.querySelector('[data-plan]').value,
                hook: panel.querySelector('[data-hook]').value
              }).then(function () {
                close();
                App.refresh();
              });
            });
          }
        });
      }

      function openContent(id) {
        var c = App.store.get('contents', id);
        if (!c) return;
        var body = '';
        body += App.ui.field('标题', '<input type="text" data-title value="' + U.escape(c.title) + '">');
        body += '<div class="field-row">' +
          App.ui.field('平台', '<select data-platform>' + Object.keys(M.PLATFORMS).map(function (k) {
            return '<option value="' + k + '"' + (c.platform === k ? ' selected' : '') + '>' + M.PLATFORMS[k] + '</option>';
          }).join('') + '</select>') +
          App.ui.field('状态', '<select data-stage>' + M.STAGES.map(function (s) {
            return '<option value="' + s.key + '"' + (c.stage === s.key ? ' selected' : '') + '>' + s.name + '</option>';
          }).join('') + '</select>') +
          '</div>';
        body += '<div class="field-row">' +
          App.ui.field('计划发布', '<input type="date" data-plan value="' + (c.planDate || '') + '">') +
          App.ui.field('已发布时间', '<input type="text" value="' + U.escape(c.publishedAt || '未发布') + '" disabled>') +
          '</div>';
        body += App.ui.field('钩子', '<input type="text" data-hook value="' + U.escape(c.hook || '') + '">');
        body += App.ui.field('脚本 / 大纲', '<textarea data-script style="min-height:120px">' + U.escape(c.script || '') + '</textarea>');
        body += App.ui.field('素材链接（一行一个）', '<textarea data-links>' + U.escape((c.links || []).join('\n')) + '</textarea>');

        if (c.stage === 'published' || (c.stats && c.stats.view)) {
          body += '<hr><h3 style="margin-bottom:8px">发布数据（手填）</h3><div class="field-row">' +
            App.ui.field('播放/阅读', '<input type="number" data-view value="' + ((c.stats || {}).view || 0) + '">') +
            App.ui.field('点赞', '<input type="number" data-like value="' + ((c.stats || {}).like || 0) + '">') +
            App.ui.field('涨粉', '<input type="number" data-fans value="' + ((c.stats || {}).fans || 0) + '">') +
            '</div>' +
            App.ui.field('这次的判断（一句话）', '<input type="text" data-retro value="' + U.escape(c.retro || '') + '">');
        }

        App.ui.openDrawer({
          title: c.title,
          body: body,
          foot: '<button class="btn btn-danger" data-del>删除</button>' +
            '<button class="btn btn-primary" data-save>保存</button>',
          onMount: function (panel, close) {
            panel.querySelector('[data-save]').addEventListener('click', function () {
              var stats = panel.querySelector('[data-view]');
              var patch = {
                title: panel.querySelector('[data-title]').value,
                platform: panel.querySelector('[data-platform]').value,
                stage: panel.querySelector('[data-stage]').value,
                planDate: panel.querySelector('[data-plan]').value,
                hook: panel.querySelector('[data-hook]').value,
                script: panel.querySelector('[data-script]').value,
                links: panel.querySelector('[data-links]').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean)
              };
              if (patch.stage === 'published' && !c.publishedAt) {
                patch.publishedAt = U.todayKey(new Date(), App.store.settings.dayCutoffHour);
              }
              if (stats) {
                patch.stats = {
                  view: Number(panel.querySelector('[data-view]').value) || 0,
                  like: Number(panel.querySelector('[data-like]').value) || 0,
                  fans: Number(panel.querySelector('[data-fans]').value) || 0
                };
                patch.retro = panel.querySelector('[data-retro]').value;
              }
              M.update(id, patch).then(function () {
                close();
                App.refresh();
                App.ui.toast('已保存');
              });
            });
            panel.querySelector('[data-del]').addEventListener('click', function () {
              App.ui.confirm({
                title: '删除内容', message: '「' + c.title + '」将被删除。', okLabel: '删除',
                onOk: function () {
                  M.remove(id).then(function () { close(); App.refresh(); });
                }
              });
            });
          }
        });
      }

      App.ui.bind(root, {
        acts: {
          new: openNew,
          open: function (d) { openContent(d.id); },
          'switch-view': function (d) {
            App.uiState.mediaView = d.key;
            App.refresh();
          },
          idea: function (d, el) {
            if (!el.value.trim()) return;
            M.add({ title: el.value }).then(function () {
              App.ui.toast('已进选题池');
              App.refresh();
            });
          },
          'drop:col': function (d) {
            if (!d.id || !d.zone) return;
            var stage = d.zone.stage;
            M.move(d.id, stage).then(function () {
              App.ui.toast('已移到「' + M.stageName(stage) + '」');
              App.refresh();
            });
          }
        }
      });
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
