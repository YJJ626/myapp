(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var ui = App.ui = {};

  var hasDOM = typeof document !== 'undefined';
  var layers = [];

  // ---------- 纯 HTML 构造（可单测） ----------
  ui.esc = U.escape;

  ui.empty = function (opts) {
    opts = opts || {};
    var html = '<div class="empty" data-empty="1">';
    html += '<div class="empty-title">' + U.escape(opts.title || '这里还是空的') + '</div>';
    if (opts.hint) html += '<div class="empty-hint">' + U.escape(opts.hint) + '</div>';
    if (opts.action) {
      html += '<button class="btn btn-primary btn-sm" data-act="' + U.escape(opts.action) + '">' +
        U.escape(opts.actionLabel || '开始') + '</button>';
    }
    html += '</div>';
    return html;
  };

  ui.bar = function (pct, tone) {
    var p = U.clamp(Math.round(pct || 0), 0, 100);
    return '<div class="bar ' + (tone || '') + '"><i style="width:' + p + '%"></i></div>';
  };

  ui.field = function (label, control) {
    return '<div class="field"><label>' + U.escape(label) + '</label>' + control + '</div>';
  };

  ui.seg = function (items, active, actName) {
    return '<div class="seg">' + items.map(function (it) {
      var on = it.key === active ? ' on' : '';
      return '<button class="' + on.trim() + '" data-act="' + actName + '" data-key="' + U.escape(it.key) + '">' +
        U.escape(it.name) + '</button>';
    }).join('') + '</div>';
  };

  ui.tag = function (text, kind) {
    return '<span class="tag ' + (kind ? 'tag-' + kind : '') + '">' + U.escape(text) + '</span>';
  };

  ui.stat = function (value, label) {
    return '<div class="stat-box"><div class="stat-val">' + value + '</div><div class="stat-label">' + U.escape(label) + '</div></div>';
  };

  // ---------- 浏览器端 ----------
  ui.toast = function (msg, ms) {
    if (!hasDOM) return;
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, ms || 1800);
  };

  function pushLayer(closeFn) {
    layers.push({ close: closeFn });
    return closeFn;
  }

  ui.closeTop = function () {
    if (!layers.length) return false;
    layers.pop().close(true);
    return true;
  };

  ui.closeAll = function () {
    while (layers.length) layers.pop().close(true);
  };

  ui.openDrawer = function (opts) {
    if (!hasDOM) return null;
    var prevFocus = document.activeElement;
    var mask = document.createElement('div');
    mask.className = 'drawer-mask';
    var panel = document.createElement('div');
    panel.className = 'drawer';
    panel.setAttribute('role', 'dialog');
    panel.innerHTML =
      '<div class="drawer-head"><h2>' + U.escape(opts.title || '') + '</h2>' +
      '<button class="btn btn-ghost btn-sm" data-close="1">关闭</button></div>' +
      '<div class="drawer-body">' + (opts.body || '') + '</div>' +
      (opts.foot ? '<div class="drawer-foot">' + opts.foot + '</div>' : '');

    document.body.appendChild(mask);
    document.body.appendChild(panel);

    var closed = false;
    function close(silent) {
      if (closed) return;
      closed = true;
      mask.remove();
      panel.remove();
      if (!silent) {
        var idx = layers.findIndex(function (l) { return l.close === close; });
        if (idx >= 0) layers.splice(idx, 1);
      }
      if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) { } }
      if (opts.onClose) opts.onClose();
    }

    mask.addEventListener('click', function () { close(); });
    panel.querySelector('[data-close]').addEventListener('click', function () { close(); });
    pushLayer(close);
    if (opts.onMount) opts.onMount(panel, close);
    return { el: panel, close: close };
  };

  ui.confirm = function (opts) {
    if (!hasDOM) return;
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    var needWord = opts.confirmWord || '';
    mask.innerHTML =
      '<div class="modal">' +
      '<h2 style="margin-bottom:8px">' + U.escape(opts.title || '确认') + '</h2>' +
      '<p class="small muted" style="margin-bottom:14px">' + U.escape(opts.message || '') + '</p>' +
      (needWord
        ? '<div class="field"><label>请输入「' + U.escape(needWord) + '」以确认</label>' +
        '<input type="text" data-word autocomplete="off"></div>'
        : '') +
      '<div class="row" style="justify-content:flex-end;margin-top:6px">' +
      '<button class="btn" data-cancel="1">取消</button>' +
      '<button class="btn btn-primary" data-ok="1"' + (needWord ? ' disabled' : '') + '>' +
      U.escape(opts.okLabel || '确认') + '</button>' +
      '</div></div>';
    document.body.appendChild(mask);

    var okBtn = mask.querySelector('[data-ok]');
    var input = mask.querySelector('[data-word]');
    if (input) {
      input.addEventListener('input', function () {
        okBtn.disabled = input.value.trim() !== needWord;
      });
      setTimeout(function () { input.focus(); }, 30);
    }

    function close() {
      mask.remove();
      var idx = layers.findIndex(function (l) { return l.close === close; });
      if (idx >= 0) layers.splice(idx, 1);
    }
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    mask.querySelector('[data-cancel]').addEventListener('click', close);
    okBtn.addEventListener('click', function () {
      if (okBtn.disabled) return;
      close();
      if (opts.onOk) opts.onOk();
    });
    pushLayer(close);
  };

  ui.quickCapture = function () {
    if (!hasDOM) return;
    if (document.querySelector('.quick')) {
      document.querySelector('.quick input').focus();
      return;
    }
    var box = document.createElement('div');
    box.className = 'quick';
    box.innerHTML =
      '<input type="text" placeholder="想到什么，回车存进快速备忘" autocomplete="off">' +
      '<div class="quick-foot"><span>Enter 保存 · Esc 关闭</span><span>存完可以直接在首页归位</span></div>';
    document.body.appendChild(box);
    var input = box.querySelector('input');
    input.focus();

    function close() {
      box.remove();
      var idx = layers.findIndex(function (l) { return l.close === close; });
      if (idx >= 0) layers.splice(idx, 1);
    }
    box._close = close;
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var text = input.value.trim();
        if (!text) return;
        App.logic.today.captureMemo(text).then(function () {
          input.value = '';
          ui.toast('已存入快速备忘');
          App.refresh();
        });
      }
      if (e.key === 'Escape') close();
    });
    box.addEventListener('click', function (e) { if (e.target === box) return; });
    pushLayer(close);
  };

  // ---------- 事件绑定 ----------
  ui.bind = function (root, handlers) {
    handlers = handlers || {};
    var acts = handlers.acts || {};
    var forms = handlers.forms || {};

    root.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!el || !root.contains(el)) return;
      var fn = acts[el.getAttribute('data-act')];
      if (!fn) return;
      e.preventDefault();
      fn(el.dataset || {}, el, e);
    });

    root.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var el = e.target.closest ? e.target.closest('[data-enter]') : null;
      if (!el) return;
      var fn = acts[el.getAttribute('data-enter')];
      if (!fn) return;
      e.preventDefault();
      fn(el.dataset || {}, el, e);
    });

    root.addEventListener('submit', function (e) {
      var form = e.target.closest ? e.target.closest('[data-form]') : null;
      if (!form) return;
      e.preventDefault();
      var fn = forms[form.getAttribute('data-form')];
      if (fn) fn(form.dataset || {}, form, e);
    });

    root.addEventListener('change', function (e) {
      var el = e.target.closest ? e.target.closest('[data-change]') : null;
      if (!el) return;
      var fn = acts[el.getAttribute('data-change')];
      if (fn) fn(el.dataset || {}, el, e);
    });

    // 拖拽（看板与时段共用）
    root.addEventListener('dragstart', function (e) {
      var el = e.target.closest ? e.target.closest('[draggable="true"]') : null;
      if (!el) return;
      el.classList.add('dragging');
      e.dataTransfer.setData('text/plain', el.getAttribute('data-drag-id') || '');
      e.dataTransfer.effectAllowed = 'move';
    });
    root.addEventListener('dragend', function (e) {
      var el = e.target.closest ? e.target.closest('.dragging') : null;
      if (el) el.classList.remove('dragging');
    });
    root.addEventListener('dragover', function (e) {
      var zone = e.target.closest ? e.target.closest('[data-drop]') : null;
      if (!zone) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('drop-hover');
    });
    root.addEventListener('dragleave', function (e) {
      var zone = e.target.closest ? e.target.closest('[data-drop]') : null;
      if (zone) zone.classList.remove('drop-hover');
    });
    root.addEventListener('drop', function (e) {
      var zone = e.target.closest ? e.target.closest('[data-drop]') : null;
      if (!zone) return;
      e.preventDefault();
      zone.classList.remove('drop-hover');
      var id = e.dataTransfer.getData('text/plain');
      var fn = acts['drop:' + zone.getAttribute('data-drop')];
      if (fn) fn({ id: id, zone: zone.dataset }, zone, e);
    });
  };

  if (hasDOM) {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var quick = document.querySelector('.quick');
        if (quick && quick._close) { quick._close(); return; }
        if (ui.closeTop()) e.preventDefault();
      }
      var meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        ui.quickCapture();
      }
      if (e.key === '/' && !/input|textarea|select/i.test((document.activeElement || {}).tagName || '')) {
        var search = document.querySelector('[data-search]');
        if (search) { e.preventDefault(); search.focus(); }
      }
    });
  }

})(typeof window !== 'undefined' ? window : globalThis);
