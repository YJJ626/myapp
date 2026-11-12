(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var views = App.views = App.views || {};
  var C = App.logic.consult;

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        App.ui.toast('已复制');
      }).catch(function () { fallback(); });
    } else fallback();

    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); App.ui.toast('已复制'); } catch (e) { App.ui.toast('复制失败，请手动选中'); }
      ta.remove();
    }
  }

  views.consult = {
    title: '咨询工作',
    render: function (snap, ctx) {
      var today = ctx.today;
      var waiting = C.waitingSorted();
      var profiles = C.profiles();
      var answers = C.searchAnswers('');

      var html = '<div class="page-head"><div class="grow"><h1>咨询工作</h1>' +
        '<div class="sub">' + (waiting.length ? (waiting.length + ' 个人在等回复') : '没有人在等') + '</div></div>' +
        '<div class="page-actions"><button class="btn btn-sm btn-primary" data-act="new-consult">记一个新问题</button></div></div>';

      html += '<div class="split">';

      html += '<div class="card"><div class="card-head"><h3>待回复</h3>' +
        '<span class="small faint">' + waiting.length + ' 条</span></div>';
      if (!waiting.length) {
        html += App.ui.empty({
          title: '队列是空的',
          hint: '谁问了你什么，先记下来，回复完再写结论',
          action: 'new-consult',
          actionLabel: '记一个新问题'
        });
      } else {
        waiting.forEach(function (c) {
          var wd = C.waitDays(c, today);
          html += '<div class="q-row" data-act="open-consult" data-id="' + c.id + '">' +
            '<div class="row-between" style="margin-bottom:3px">' +
            '<span class="row" style="gap:7px"><span class="avatar">' + U.escape(c.person.slice(0, 1)) + '</span>' +
            '<span class="small bold">' + U.escape(c.person) + '</span>' +
            '<span class="tag">' + U.escape(C.channelName(c.channel)) + '</span></span>' +
            '<span class="q-wait ' + (wd >= 2 ? 'warn' : '') + '">' + (wd === 0 ? '今天' : '等了 ' + wd + ' 天') + '</span>' +
            '</div>' +
            '<div class="small" style="padding-left:35px">' + U.escape(c.question) + '</div>' +
            '</div>';
        });
      }
      html += '</div>';

      html += '<div class="stack">';
      html += '<div class="card"><div class="card-head"><h3>答案库</h3>' +
        '<span class="small faint">' + answers.length + ' 条</span></div><div class="card-pad">';
      html += '<input type="search" data-answer-search placeholder="搜问题或答案">';
      html += '<div id="answer-list" style="margin-top:10px">';
      if (!answers.length) {
        html += '<div class="small faint">回复时勾上"存进答案库"，能复用的回答就会攒在这里。</div>';
      } else {
        answers.forEach(function (a) {
          html += '<div class="answer-item" data-answer-text="' + U.escape((a.question + ' ' + a.answer).toLowerCase()) + '">' +
            '<div class="row-between"><span class="answer-q">' + U.escape(a.question) + '</span>' +
            '<button class="btn btn-ghost btn-sm" data-copy="' + a.id + '">复制</button></div>' +
            '<div class="answer-a">' + U.escape(a.answer) + '</div>' +
            '</div>';
        });
      }
      html += '</div></div></div>';

      html += '<div class="card card-pad"><h3 style="margin-bottom:8px">问过的人</h3>';
      if (!profiles.length) {
        html += '<div class="small faint">还没有记录。</div>';
      } else {
        profiles.slice(0, 6).forEach(function (p) {
          html += '<div class="list-row" data-act="open-person" data-name="' + U.escape(p.name) + '" style="cursor:pointer">' +
            '<span class="avatar">' + U.escape(p.name.slice(0, 1)) + '</span>' +
            '<span class="grow"><span class="small bold">' + U.escape(p.name) + '</span>' +
            '<span class="tiny faint"> · 问过 ' + p.total + ' 次' + (p.waiting ? '，' + p.waiting + ' 条没回' : '') + '</span></span>' +
            '<span class="tiny faint">' + U.escape((p.lastAskedAt || '').slice(5, 10)) + '</span>' +
            '</div>';
        });
      }
      html += '</div>';

      html += '</div></div>';
      return html;
    },

    mount: function (root, ctx) {
      var search = root.querySelector('[data-answer-search]');
      if (search) {
        search.addEventListener('input', function () {
          var key = search.value.trim().toLowerCase();
          Array.prototype.forEach.call(root.querySelectorAll('[data-answer-text]'), function (el) {
            el.style.display = !key || el.getAttribute('data-answer-text').indexOf(key) !== -1 ? '' : 'none';
          });
        });
      }

      function openNew() {
        App.ui.openDrawer({
          title: '记一个新问题',
          body:
            '<div class="field-row">' +
            App.ui.field('谁问的', '<input type="text" data-person placeholder="名字或称呼">') +
            App.ui.field('渠道', '<select data-channel><option value="wechat">微信</option>' +
              '<option value="group">群里</option><option value="offline">当面</option><option value="other">其它</option></select>') +
            '</div>' +
            App.ui.field('问题（一句话）', '<input type="text" data-question placeholder="例如：这个报错怎么定位">') +
            App.ui.field('补充（可空）', '<textarea data-detail placeholder="背景、已经试过什么"></textarea>'),
          foot: '<button class="btn" data-cancel>取消</button><button class="btn btn-primary" data-save>记下</button>',
          onMount: function (panel, close) {
            panel.querySelector('[data-cancel]').addEventListener('click', close);
            panel.querySelector('[data-person]').focus();
            panel.querySelector('[data-save]').addEventListener('click', function () {
              C.add({
                person: panel.querySelector('[data-person]').value,
                channel: panel.querySelector('[data-channel]').value,
                question: panel.querySelector('[data-question]').value,
                detail: panel.querySelector('[data-detail]').value
              }).then(function (row) {
                if (!row) { App.ui.toast('先写问题'); return; }
                close();
                App.refresh();
                App.ui.toast('已加入待回复');
              });
            });
          }
        });
      }

      function openConsult(id) {
        var c = App.store.get('consults', id);
        if (!c) return;
        var replied = c.status === 'replied';
        var body = '<div class="row" style="gap:8px;margin-bottom:10px">' +
          '<span class="avatar">' + U.escape(c.person.slice(0, 1)) + '</span>' +
          '<span class="bold">' + U.escape(c.person) + '</span>' +
          '<span class="tag">' + U.escape(C.channelName(c.channel)) + '</span>' +
          '<span class="tag ' + (replied ? 'tag-accent' : 'tag-warn') + '">' + (replied ? '已回复' : '等回复') + '</span>' +
          '</div>';
        body += '<div class="note" style="margin-bottom:12px">' + U.escape(c.question) +
          (c.detail ? '<div class="small" style="margin-top:6px;color:var(--text-2)">' + U.escape(c.detail) + '</div>' : '') + '</div>';
        body += App.ui.field('我的结论', '<textarea data-conclusion placeholder="怎么解决的，下次能直接复述">' +
          U.escape(c.conclusion || '') + '</textarea>');
        body += App.ui.field('后续动作（可空）', '<input type="text" data-followup value="' + U.escape(c.followUp || '') +
          '" placeholder="对方要做什么 / 我要跟进什么">');
        if (!replied) {
          body += '<label class="row small" style="gap:7px;cursor:pointer">' +
            '<input type="checkbox" data-bank checked style="width:auto"> 同时存进答案库</label>';
        }

        App.ui.openDrawer({
          title: replied ? '这次咨询' : '回复这个问题',
          body: body,
          foot: '<button class="btn btn-danger" data-del style="margin-right:auto">' +
            App.ui.icon('trash', 13) + '删除这条</button>' +
            (replied ? '<button class="btn" data-reopen>标回待回复</button>' : '') +
            '<button class="btn" data-cancel>关闭</button>' +
            '<button class="btn btn-primary" data-save>' + (replied ? '保存修改' : '标记已回复') + '</button>',
          onMount: function (panel, close) {
            panel.querySelector('[data-cancel]').addEventListener('click', close);
            panel.querySelector('[data-conclusion]').focus();
            panel.querySelector('[data-del]').addEventListener('click', function () {
              App.ui.confirm({
                title: '删除这条咨询',
                message: '「' + c.person + '」这条记录会被删除，无法恢复。',
                okLabel: '删除',
                onOk: function () {
                  C.remove(id).then(function () {
                    close();
                    App.refresh();
                    App.ui.toast('已删除');
                  });
                }
              });
            });
            var reopen = panel.querySelector('[data-reopen]');
            if (reopen) {
              reopen.addEventListener('click', function () {
                C.reopen(id).then(function () {
                  close();
                  App.refresh();
                  App.ui.toast('已放回待回复');
                });
              });
            }
            panel.querySelector('[data-save]').addEventListener('click', function () {
              var conclusion = panel.querySelector('[data-conclusion]').value;
              if (!conclusion.trim()) { App.ui.toast('回复总得留个结论'); return; }
              var bank = panel.querySelector('[data-bank]');
              C.reply(id, {
                conclusion: conclusion,
                followUp: panel.querySelector('[data-followup]').value,
                saveToBank: bank ? bank.checked : false
              }).then(function () {
                close();
                App.refresh();
                App.ui.toast(replied ? '已保存' : '已回复，队列少一条');
              });
            });
          }
        });
      }

      function openPerson(name) {
        var rows = C.byPerson(name);
        var body = '';
        rows.forEach(function (c) {
          body += '<div class="log-item"><div class="log-date">' + U.escape((c.askedAt || '').slice(0, 10)) +
            ' · ' + (c.status === 'waiting' ? '等回复' : '已回复') + '</div>' +
            '<div class="small bold">' + U.escape(c.question) + '</div>' +
            (c.conclusion ? '<div class="small muted" style="margin-top:2px">结论：' + U.escape(c.conclusion) + '</div>' : '') +
            '</div>';
        });
        App.ui.openDrawer({
          title: name + ' 问过的事',
          body: body || '<div class="small faint">没有记录。</div>',
          foot: '<button class="btn btn-danger" data-del-person style="margin-right:auto">' +
            App.ui.icon('trash', 13) + '删除这个人</button>' +
            '<button class="btn" data-cancel>关闭</button>',
          onMount: function (panel, close) {
            panel.querySelector('[data-cancel]').addEventListener('click', close);
            panel.querySelector('[data-del-person]').addEventListener('click', function () {
              App.ui.confirm({
                title: '删除这个人的全部记录',
                message: '「' + name + '」的 ' + rows.length + ' 条咨询记录会一起删除，无法恢复。',
                okLabel: '删除',
                onOk: function () {
                  C.removePerson(name).then(function (n) {
                    close();
                    App.refresh();
                    App.ui.toast('已删除 ' + n + ' 条记录');
                  });
                }
              });
            });
          }
        });
      }

      App.ui.bind(root, {
        acts: {
          'new-consult': openNew,
          'open-consult': function (d) { openConsult(d.id); },
          'open-person': function (d) { openPerson(d.name); }
        }
      });

      root.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-copy]') : null;
        if (!btn) return;
        var row = App.store.get('answers', btn.getAttribute('data-copy'));
        if (!row) return;
        copyText(row.answer);
        C.markUsed(row.id);
      });
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
