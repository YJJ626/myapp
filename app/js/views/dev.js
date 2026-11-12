(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var views = App.views = App.views || {};
  var devLogic = App.logic.dev;

  function milestone(project) {
    var cur = devLogic.stageIndex(project.stage);
    var html = '<div class="milestone">';
    devLogic.STAGES.forEach(function (s, i) {
      var cls = i < cur ? 'done' : (i === cur ? 'current' : '');
      html += '<div class="ms-step ' + cls + '">' + s.name + '</div>';
    });
    return html + '</div>';
  }

  function ddlText(project, today) {
    var days = devLogic.daysLeft(project, today);
    if (project.stage === 'done') return { text: '已完成', cls: '' };
    if (days < 0) return { text: '已逾期 ' + Math.abs(days) + ' 天', cls: 'late' };
    if (days === 0) return { text: '今天截止', cls: 'late' };
    if (days <= 3) return { text: '还剩 ' + days + ' 天', cls: 'soon' };
    return { text: '还剩 ' + days + ' 天', cls: '' };
  }

  views.dev = {
    title: '开发工作',
    render: function (snap) {
      var projects = (snap.projects || []).slice().sort(function (a, b) {
        if ((a.stage === 'done') !== (b.stage === 'done')) return a.stage === 'done' ? 1 : -1;
        return a.deadline < b.deadline ? -1 : 1;
      });
      var active = projects.filter(function (p) { return p.stage !== 'done'; });

      var html = '<div class="page-head"><div class="grow"><h1>开发工作</h1>' +
        '<div class="sub">' + (active.length ? (active.length + ' 个项目在推进') : '课程、比赛、自己的项目都放这儿') + '</div></div>' +
        '<div class="page-actions">' +
        '<button class="btn btn-sm" data-act="new-work"' + (projects.length ? '' : ' disabled') + '>' +
        App.ui.icon('plus', 14) + '新增工作项</button>' +
        '<button class="btn btn-sm btn-primary" data-act="new-project">' + App.ui.icon('plus', 14) + '新建项目</button>' +
        '</div></div>';

      if (!projects.length) {
        html += '<div class="card">' + App.ui.empty({
          title: '还没有项目',
          hint: '一个项目一张卡，填上截止日期就会在首页倒数；建好之后就能往里加工作项',
          action: 'new-project',
          actionLabel: '建第一个项目'
        }) + '</div>';
      } else {
        // 随手加一条工作项：不用先进项目
        var orderedProjects = active.concat(projects.filter(function (p) { return p.stage === 'done'; }));
        App.uiState = App.uiState || {};
        var selectedId = App.uiState.devProject;
        if (!selectedId || !orderedProjects.some(function (p) { return p.id === selectedId; })) {
          selectedId = orderedProjects[0] ? orderedProjects[0].id : '';
        }
        html += '<div class="work-add">' +
          '<span class="faint">' + App.ui.icon('plus', 15) + '</span>' +
          '<select data-work-project data-change="dev-project" title="加到哪个项目">' +
          orderedProjects.map(function (p) {
            return '<option value="' + p.id + '"' + (p.id === selectedId ? ' selected' : '') + '>' +
              U.escape(p.name) + '</option>';
          }).join('') + '</select>' +
          '<input type="text" data-work-text data-enter="quick-work" placeholder="写一条要做的具体事，回车即加入">' +
          '<button class="btn btn-sm btn-primary" data-act="quick-work">加入</button>' +
          '</div>';

        html += '<div class="grid-cards">';
        projects.forEach(function (p) {
          var ddl = ddlText(p, snap.today);
          var next = (p.todos || []).filter(function (t) { return t.isNext; })[0];
          var openTodos = (p.todos || []).filter(function (t) { return !t.done; }).length;
          html += '<div class="card proj-card proj-card-anchor" data-act="open-project" data-id="' + p.id + '">' +
            '<div class="row-between" style="margin-bottom:6px">' +
            '<span class="bold ellipsis proj-title">' + U.escape(p.name) + '</span>' +
            '<span class="tag">' + U.escape(devLogic.types[p.type] || '课程') + '</span></div>' +
            '<div class="row" style="gap:10px"><span class="ddl ' + ddl.cls + '">' + ddl.text + '</span>' +
            '<span class="tag tag-info">' + U.escape(devLogic.stageName(p.stage)) + '</span>' +
            (openTodos ? '<span class="tag">' + openTodos + ' 项待办</span>' : '') + '</div>' +
            '<div style="margin:9px 0 6px">' + App.ui.bar(p.progress || 0) + '</div>' +
            '<div class="small muted ellipsis">' +
            (next ? '下一步：' + U.escape(next.text) : (p.nextStep ? '下一步：' + U.escape(p.nextStep) : '还没定下一步')) +
            '</div>' +
            milestone(p) +
            '<button class="btn btn-sm proj-quick" data-act="work-to-project" data-id="' + p.id + '" ' +
            'title="给这个项目加一条工作项">' + App.ui.icon('plus', 13) + '加项</button>' +
            '</div>';
        });
        html += '</div>';
      }

      html += '<div class="card card-pad" style="margin-top:16px">' +
        '<div class="row-between" style="margin-bottom:8px"><h3>踩坑检索</h3>' +
        '<span class="tiny faint">搜问题、原因或解法</span></div>' +
        '<input type="search" data-pitfall-search placeholder="例如：跨域、时区、打包报错">' +
        '<div id="pitfall-results" style="margin-top:10px">';
      var all = devLogic.searchPitfalls(snap.projects, '');
      if (!all.length) {
        html += '<div class="small faint">还没有记录过坑。在项目抽屉里记一条，下次就不用重新踩。</div>';
      } else {
        all.forEach(function (x) {
          html += '<div class="pitfall" data-pitfall-text="' + U.escape((x.problem + ' ' + x.cause + ' ' + x.solution).toLowerCase()) + '">' +
            '<div class="pitfall-q">' + U.escape(x.problem) + ' <span class="tag">' + U.escape(x.projectName) + '</span></div>' +
            (x.cause ? '<div class="pitfall-a">原因：' + U.escape(x.cause) + '</div>' : '') +
            (x.solution ? '<div class="pitfall-a">解法：' + U.escape(x.solution) + '</div>' : '') +
            '</div>';
        });
      }
      html += '</div></div>';

      return html;
    },

    mount: function (root, ctx) {
      var search = root.querySelector('[data-pitfall-search]');
      if (search) {
        search.addEventListener('input', function () {
          var key = search.value.trim().toLowerCase();
          Array.prototype.forEach.call(root.querySelectorAll('[data-pitfall-text]'), function (el) {
            el.style.display = !key || el.getAttribute('data-pitfall-text').indexOf(key) !== -1 ? '' : 'none';
          });
        });
      }

      function openNew() {
        App.ui.openDrawer({
          title: '新建项目',
          body:
            App.ui.field('项目名称', '<input type="text" data-name placeholder="例如：校赛 Demo">') +
            '<div class="field-row">' +
            App.ui.field('类型', '<select data-type><option value="course">课程</option>' +
              '<option value="contest">比赛</option><option value="self">自研</option></select>') +
            App.ui.field('截止日期', '<input type="date" data-deadline value="' + U.addDays(ctx.today, 14) + '">') +
            '</div>' +
            '<div class="note">建完就能在首页看到"还剩 N 天"。</div>',
          foot: '<button class="btn" data-cancel>取消</button><button class="btn btn-primary" data-save>创建</button>',
          onMount: function (panel, close) {
            panel.querySelector('[data-cancel]').addEventListener('click', close);
            panel.querySelector('[data-name]').focus();
            panel.querySelector('[data-save]').addEventListener('click', function () {
              var name = panel.querySelector('[data-name]').value;
              if (!name.trim()) { App.ui.toast('先填项目名'); return; }
              devLogic.addProject({
                name: name,
                type: panel.querySelector('[data-type]').value,
                deadline: panel.querySelector('[data-deadline]').value
              }).then(function () {
                close();
                App.refresh();
                App.ui.toast('项目已创建');
              });
            });
          }
        });
      }

      function openProject(id) {
        var p = App.store.get('projects', id);
        if (!p) return;
        var body = '';
        body += '<div class="field-row">' +
          App.ui.field('阶段', '<select data-stage>' + devLogic.STAGES.map(function (s) {
            return '<option value="' + s.key + '"' + (p.stage === s.key ? ' selected' : '') + '>' + s.name + '</option>';
          }).join('') + '</select>') +
          App.ui.field('截止日期', '<input type="date" data-deadline value="' + p.deadline + '">') +
          '</div>';
        body += App.ui.field('进度（' + (p.progress || 0) + '%）',
          '<input type="range" min="0" max="100" step="5" value="' + (p.progress || 0) + '" data-progress>');

        body += '<hr><h3 style="margin-bottom:8px">待办</h3>';
        body += '<div id="todo-list">';
        if (!(p.todos || []).length) body += '<div class="small faint">还没有待办。先写"下一步"要做的那件事。</div>';
        (p.todos || []).forEach(function (t) {
          body += '<div class="mini-row">' +
            '<span class="check" data-toggle-todo="' + t.id + '" data-done="' + (t.done ? 1 : 0) + '"></span>' +
            '<span class="' + (t.done ? 'done-text' : '') + '">' + U.escape(t.text) + '</span>' +
            (t.isNext ? '<span class="tag tag-accent">下一步</span>' : '') +
            '<span class="x" data-next-todo="' + t.id + '" title="设为下一步">☆</span>' +
            '<span class="x" data-del-todo="' + t.id + '">✕</span>' +
            '</div>';
        });
        body += '</div>';
        body += '<input type="text" data-new-todo placeholder="加一条工作项，回车或点添加" style="margin-top:8px">' +
          '<div class="row" style="margin-top:6px;justify-content:flex-end">' +
          '<button class="btn btn-sm btn-primary" data-add-todo>' + App.ui.icon('plus', 13) + '添加工作项</button></div>';

        body += '<hr><h3 style="margin-bottom:8px">开发日志</h3>';
        body += '<textarea data-log placeholder="今天改了什么、卡在哪（一天记一条就够）"></textarea>' +
          '<button class="btn btn-sm" data-add-log style="margin-top:6px">记一条</button>';
        body += '<div style="margin-top:10px">';
        if (!(p.logs || []).length) body += '<div class="small faint">还没有日志。</div>';
        (p.logs || []).slice(0, 20).forEach(function (l) {
          body += '<div class="log-item"><div class="log-date">' + U.escape(U.fmtShort(l.date)) + '</div>' +
            '<div class="small">' + U.escape(l.text) + '</div></div>';
        });
        body += '</div>';

        body += '<hr><h3 style="margin-bottom:8px">踩坑记录</h3>';
        body += '<input type="text" data-pit-problem placeholder="问题是什么" style="margin-bottom:6px">' +
          '<input type="text" data-pit-cause placeholder="原因（可空）" style="margin-bottom:6px">' +
          '<input type="text" data-pit-solution placeholder="怎么解决的（可空）" style="margin-bottom:6px">' +
          '<button class="btn btn-sm" data-add-pit>记下来</button>';
        body += '<div style="margin-top:10px">';
        (p.pitfalls || []).forEach(function (x) {
          body += '<div class="pitfall"><div class="pitfall-q">' + U.escape(x.problem) +
            ' <span class="x" data-del-pit="' + x.id + '" style="float:right;cursor:pointer;color:var(--text-3)">✕</span></div>' +
            (x.cause ? '<div class="pitfall-a">原因：' + U.escape(x.cause) + '</div>' : '') +
            (x.solution ? '<div class="pitfall-a">解法：' + U.escape(x.solution) + '</div>' : '') +
            '</div>';
        });
        body += '</div>';

        body += '<hr>' +
          '<div class="row-between"><span class="small faint">创建于 ' + U.escape((p.createdAt || '').slice(0, 10)) + '</span>' +
          '<button class="btn btn-sm btn-danger" data-del-project>删除项目</button></div>';

        App.ui.openDrawer({
          title: p.name,
          body: body,
          onMount: function (panel, close) {
            function refreshDrawer() {
              close();
              App.refresh();
              setTimeout(function () { openProject(id); }, 30);
            }
            panel.querySelector('[data-stage]').addEventListener('change', function (e) {
              devLogic.setStage(id, e.target.value).then(refreshDrawer);
            });
            panel.querySelector('[data-deadline]').addEventListener('change', function (e) {
              devLogic.update(id, { deadline: e.target.value }).then(refreshDrawer);
            });
            panel.querySelector('[data-progress]').addEventListener('change', function (e) {
              devLogic.setProgress(id, e.target.value).then(refreshDrawer);
            });
            var newTodo = panel.querySelector('[data-new-todo]');
            function submitTodo() {
              if (!newTodo.value.trim()) { App.ui.toast('先写内容'); return; }
              devLogic.addTodo(id, newTodo.value).then(refreshDrawer);
            }
            newTodo.addEventListener('keydown', function (e) {
              if (e.key === 'Enter') { e.preventDefault(); submitTodo(); }
            });
            panel.querySelector('[data-add-todo]').addEventListener('click', submitTodo);
            panel.querySelectorAll('[data-toggle-todo]').forEach(function (el) {
              el.addEventListener('click', function () {
                devLogic.toggleTodo(id, el.getAttribute('data-toggle-todo')).then(refreshDrawer);
              });
            });
            panel.querySelectorAll('[data-next-todo]').forEach(function (el) {
              el.addEventListener('click', function () {
                devLogic.setNextStep(id, el.getAttribute('data-next-todo')).then(refreshDrawer);
              });
            });
            panel.querySelectorAll('[data-del-todo]').forEach(function (el) {
              el.addEventListener('click', function () {
                devLogic.removeTodo(id, el.getAttribute('data-del-todo')).then(refreshDrawer);
              });
            });
            panel.querySelector('[data-add-log]').addEventListener('click', function () {
              var ta = panel.querySelector('[data-log]');
              if (!ta.value.trim()) return;
              devLogic.addLog(id, ta.value).then(refreshDrawer);
            });
            panel.querySelector('[data-add-pit]').addEventListener('click', function () {
              var x = {
                problem: panel.querySelector('[data-pit-problem]').value,
                cause: panel.querySelector('[data-pit-cause]').value,
                solution: panel.querySelector('[data-pit-solution]').value
              };
              if (!x.problem.trim()) { App.ui.toast('先写问题'); return; }
              devLogic.addPitfall(id, x).then(refreshDrawer);
            });
            panel.querySelectorAll('[data-del-pit]').forEach(function (el) {
              el.addEventListener('click', function () {
                devLogic.removePitfall(id, el.getAttribute('data-del-pit')).then(refreshDrawer);
              });
            });
            panel.querySelector('[data-del-project]').addEventListener('click', function () {
              App.ui.confirm({
                title: '删除项目',
                message: '「' + p.name + '」以及它的待办、日志、踩坑都会一起删掉。',
                okLabel: '删除',
                onOk: function () {
                  App.store.remove('projects', id).then(function () {
                    close();
                    App.refresh();
                  });
                }
              });
            });
          }
        });
      }

      function openWorkItem(presetId) {
        var all = App.store.list('projects');
        if (!all.length) { openNew(); return; }
        var open = all.filter(function (p) { return p.stage !== 'done'; });
        var ordered = open.concat(all.filter(function (p) { return p.stage === 'done'; }));
        var sel = presetId || (ordered[0] && ordered[0].id);

        App.ui.openDrawer({
          title: '新增工作项',
          body:
            App.ui.field('加到哪个项目', '<select data-proj>' + ordered.map(function (p) {
              return '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' +
                U.escape(p.name) + (p.stage === 'done' ? '（已完成）' : '') + '</option>';
            }).join('') + '</select>') +
            App.ui.field('工作项（一行一条，可以一次写多条）',
              '<textarea data-items placeholder="例如：把登录接口联调完&#10;补 README&#10;截图存档"></textarea>') +
            '<label class="row small" style="gap:7px;cursor:pointer;margin-bottom:6px">' +
            '<input type="checkbox" data-next style="width:auto"> 把第一条设为「下一步」</label>' +
            '<div class="note">工作项加进项目后，卡片上会显示"还有 N 项待办"，点开项目就能逐条勾掉。</div>',
          foot: '<button class="btn" data-cancel>取消</button>' +
            '<button class="btn btn-primary" data-save>加入项目</button>',
          onMount: function (panel, close) {
            panel.querySelector('[data-cancel]').addEventListener('click', close);
            panel.querySelector('[data-items]').focus();
            panel.querySelector('[data-save]').addEventListener('click', function () {
              var pid = panel.querySelector('[data-proj]').value;
              var lines = panel.querySelector('[data-items]').value.split('\n')
                .map(function (s) { return s.trim(); }).filter(Boolean);
              if (!lines.length) { App.ui.toast('先写一条工作项'); return; }
              var asNext = panel.querySelector('[data-next]').checked;
              var chain = Promise.resolve();
              lines.forEach(function (text, i) {
                chain = chain.then(function () { return devLogic.addTodo(pid, text, asNext && i === 0); });
              });
              chain.then(function () {
                close();
                App.refresh();
                App.ui.toast('已加入 ' + lines.length + ' 条工作项');
              });
            });
          }
        });
      }

      App.ui.bind(root, {
        acts: {
          'new-project': openNew,
          'open-project': function (d) { openProject(d.id); },
          'new-work': function () { openWorkItem(''); },
          'work-to-project': function (d) { openWorkItem(d.id); },
          'dev-project': function (d, el) {
            App.uiState.devProject = el.value;
          },
          'quick-work': function () {
            var sel = root.querySelector('[data-work-project]');
            var input = root.querySelector('[data-work-text]');
            if (!sel || !input) return;
            if (!input.value.trim()) { App.ui.toast('先写一条工作项'); input.focus(); return; }
            App.uiState.devProject = sel.value;
            devLogic.addTodo(sel.value, input.value).then(function () {
              App.ui.toast('已加入「' + (App.store.get('projects', sel.value) || {}).name + '」');
              App.refresh();
            });
          }
        }
      });

      if (ctx.params && ctx.params.focus) openProject(ctx.params.focus);
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
