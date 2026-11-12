(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var views = App.views = App.views || {};
  var ST = App.logic.settings;

  var MODULES = [
    { key: 'tasks', name: '今日计划' },
    { key: 'memos', name: '快速备忘' },
    { key: 'contents', name: '自媒体' },
    { key: 'projects', name: '开发工作' },
    { key: 'consults', name: '咨询记录' },
    { key: 'answers', name: '答案库' },
    { key: 'sessions', name: '训练记录' },
    { key: 'meals', name: '饮食记录' },
    { key: 'games', name: '游戏库' },
    { key: 'playSessions', name: '游玩记录' }
  ];

  views.settings = {
    title: '数据与设置',
    render: function (snap, ctx) {
      var s = snap.settings;
      var streak = ST.streak(ctx.today, snap.tasks);
      var rate = ST.weekRate(snap.tasks, ctx.weekStartKey);
      var counts = ST.moduleCounts();
      var backupDue = App.derive.backupDue(snap);
      var lastBackup = s.lastBackupAt ? U.fmtDateCN(U.dateKey(new Date(s.lastBackupAt))) : '从未备份';

      var html = '<div class="page-head"><div class="grow"><h1>数据与设置</h1>' +
        '<div class="sub">数据只在这台电脑上 · 当前存储：' +
        (App.db.driverName === 'idb' ? '浏览器本地库（推荐）' : App.db.driverName === 'ls' ? '浏览器本地存储（双击模式）' : '内存（临时）') +
        '</div></div></div>';

      html += '<div class="set-grid-2">';

      // 偏好
      html += '<div class="card card-pad"><h3 style="margin-bottom:12px">偏好</h3>';
      html += '<div class="row-between" style="margin-bottom:12px"><span class="small">主题</span>' +
        App.ui.seg([{ key: 'light', name: '浅色' }, { key: 'dark', name: '深色' }], s.theme, 'theme') + '</div>';
      html += '<div class="row-between" style="margin-bottom:12px"><span class="small">每周从哪天开始</span>' +
        '<select data-change="week-start" style="width:120px">' +
        [1, 2, 3, 4, 5, 6, 7].map(function (i) {
          return '<option value="' + i + '"' + (s.weekStart === i ? ' selected' : '') + '>' +
            U.WEEK_CN[i % 7] + '</option>';
        }).join('') + '</select></div>';
      html += '<div class="row-between"><span class="small">凌晨 4 点前算前一天</span>' +
        '<select data-change="cutoff" style="width:120px">' +
        '<option value="4"' + (s.dayCutoffHour === 4 ? ' selected' : '') + '>开启</option>' +
        '<option value="0"' + (s.dayCutoffHour === 0 ? ' selected' : '') + '>关闭</option></select></div>';
      html += '</div>';

      // 目标
      html += '<div class="card card-pad"><h3 style="margin-bottom:12px">目标值</h3>';
      html += '<div class="field-row">' +
        App.ui.field('每日热量（kcal）', '<input type="number" data-enter="goal" data-key="kcal" value="' + (s.goals.kcal || 0) + '">') +
        App.ui.field('每日蛋白质（g）', '<input type="number" data-enter="goal" data-key="protein" value="' + (s.goals.protein || 0) + '">') +
        '</div><div class="field-row">' +
        App.ui.field('每周训练（次）', '<input type="number" data-enter="goal" data-key="weeklyWorkouts" value="' + (s.goals.weeklyWorkouts || 0) + '">') +
        App.ui.field('每周娱乐（小时）', '<input type="number" step="0.5" data-enter="goal-hours" value="' +
          Math.round((s.goals.weeklyGameMin || 0) / 6) / 10 + '">') +
        '</div>';
      html += '</div>';

      // 数据总览
      html += '<div class="card card-pad"><h3 style="margin-bottom:10px">数据总览</h3>' +
        '<div class="grid-3" style="margin-bottom:12px">' +
        App.ui.stat(counts.reduce(function (a, b) { return a + b.n; }, 0), '总条目') +
        App.ui.stat(streak + ' 天', '连续记录') +
        App.ui.stat(rate.pct + '%', '本周完成率') +
        '</div>';
      html += '<div class="kv-wrap">';
      counts.forEach(function (c) {
        html += '<div class="kv"><span class="small muted">' + c.name + '</span><span class="small">' + c.n + '</span></div>';
      });
      html += '</div></div>';

      // 备份
      html += '<div class="card card-pad"><h3 style="margin-bottom:10px">备份与恢复</h3>';
      html += '<div class="note ' + (backupDue ? 'warn-note' : '') + '" style="margin-bottom:10px">' +
        (backupDue ? '已经超过 30 天没备份了。' : '') + '上次备份：' + U.escape(lastBackup) + '</div>';
      html += '<div class="row wrap" style="gap:8px">' +
        '<button class="btn btn-primary btn-sm" data-act="export">导出备份</button>' +
        '<button class="btn btn-sm" data-act="import-merge">导入并合并</button>' +
        '<button class="btn btn-sm" data-act="import-overwrite">导入并覆盖</button>' +
        '</div>' +
        '<div class="tiny faint" style="margin-top:8px">清浏览器数据前一定先导出。备份文件是一个 JSON，自己收好。</div>';
      html += '</div>';

      // 危险区
      html += '<div class="card card-pad danger-zone" style="grid-column:1/-1">' +
        '<h3 style="margin-bottom:10px;color:var(--danger)">危险区</h3>' +
        '<div class="row wrap" style="gap:8px">' +
        '<select data-module style="width:150px">' + MODULES.map(function (m) {
          return '<option value="' + m.key + '">' + m.name + '</option>';
        }).join('') + '</select>' +
        '<button class="btn btn-sm btn-danger" data-act="clear-module">清空这个模块</button>' +
        '<span class="grow"></span>' +
        '<button class="btn btn-sm btn-danger" data-act="clear-all">清空全部数据</button>' +
        '</div></div>';

      html += '</div>';
      return html;
    },

    mount: function (root, ctx) {
      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json,application/json';
      fileInput.style.display = 'none';
      root.appendChild(fileInput);
      var importMode = 'merge';

      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var parsed = ST.parseBackup(String(reader.result || ''));
          if (!parsed.ok) {
            App.ui.toast('导入失败：' + parsed.error);
            fileInput.value = '';
            return;
          }
          var preview = ST.previewImport(parsed.payload, importMode);
          App.ui.confirm({
            title: importMode === 'overwrite' ? '覆盖导入' : '合并导入',
            message: importMode === 'overwrite'
              ? ('将先清空现有数据，再写入 ' + preview.added + ' 条。此操作不可撤销。')
              : ('将新增 ' + preview.added + ' 条，跳过已存在的 ' + preview.skipped + ' 条。'),
            confirmWord: importMode === 'overwrite' ? '清空并恢复' : '',
            okLabel: '开始导入',
            onOk: function () {
              ST.applyImport(parsed.payload, importMode).then(function (r) {
                App.ui.toast('已导入 ' + r.added + ' 条');
                App.refresh();
              }).catch(function (e) {
                App.ui.toast('导入失败：' + e.message);
              });
            }
          });
          fileInput.value = '';
        };
        reader.readAsText(file, 'utf-8');
      });

      function download(payload) {
        var text = JSON.stringify(payload, null, 2);
        var blob = new Blob([text], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = ST.fileName(new Date());
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        ST.markBackedUp().then(function () {
          App.ui.toast('已导出，请把文件收好');
          App.refresh();
        });
      }

      App.ui.bind(root, {
        acts: {
          theme: function (d) {
            ST.setTheme(d.key).then(function () {
              document.documentElement.setAttribute('data-theme', d.key);
              App.refresh();
            });
          },
          goal: function (d, el) {
            ST.setGoal(d.key, el.value).then(function () { App.refresh(); });
          },
          'goal-hours': function (d, el) {
            ST.setGoal('weeklyGameMin', Math.round((Number(el.value) || 0) * 60)).then(function () { App.refresh(); });
          },
          'week-start': function (d, el) {
            ST.setWeekStart(el.value).then(function () { App.refresh(); });
          },
          cutoff: function (d, el) {
            ST.setCutoff(el.value).then(function () { App.refresh(); });
          },
          export: function () {
            download(ST.buildExport());
          },
          'import-merge': function () {
            importMode = 'merge';
            fileInput.click();
          },
          'import-overwrite': function () {
            importMode = 'overwrite';
            fileInput.click();
          },
          'clear-module': function () {
            var sel = root.querySelector('[data-module]');
            var key = sel.value;
            var name = MODULES.filter(function (m) { return m.key === key; })[0];
            App.ui.confirm({
              title: '清空' + (name ? name.name : key),
              message: '这个模块的所有记录都会被删除，且无法恢复。建议先导出备份。',
              confirmWord: '清空',
              okLabel: '确认清空',
              onOk: function () {
                ST.clearModule(key).then(function () {
                  App.ui.toast('已清空');
                  App.refresh();
                });
              }
            });
          },
          'clear-all': function () {
            App.ui.confirm({
              title: '清空全部数据',
              message: '九个模块的所有记录、以及全部设置都会被重置。这一步没有撤销。',
              confirmWord: '清空全部',
              okLabel: '确认清空',
              onOk: function () {
                ST.clearAll().then(function () {
                  App.ui.toast('已全部清空');
                  App.refresh();
                });
              }
            });
          }
        }
      });
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
