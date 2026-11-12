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

  // ---------- 图标（内联 SVG，不依赖任何外部资源） ----------
  var ICONS = {
    home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5V20h4v-5.5h5V20h4V9.5"/>',
    today: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3.5v3.5M16 3.5v3.5M3.5 10.5h17"/>',
    media: '<rect x="3" y="6" width="12.5" height="12" rx="2.5"/><path d="M15.5 11l5.5-3.2v8.4L15.5 13z"/>',
    dev: '<path d="M9 8.5 4.5 12 9 15.5M15 8.5 19.5 12 15 15.5"/>',
    consult: '<path d="M20.5 12.2c0 4.1-3.8 7.3-8.5 7.3-1 0-2-.14-2.9-.4L4 21l1.4-3.7A7 7 0 0 1 3.5 12.2C3.5 8.1 7.3 5 12 5s8.5 3.1 8.5 7.2z"/>',
    fitness: '<path d="M6.5 9v6M3.5 10.5v3M17.5 9v6M20.5 10.5v3M6.5 12h11"/>',
    diet: '<path d="M4 11.5h16a8 8 0 0 1-16 0z"/><path d="M9 7.2c0-1.2 1.2-1.6 1.2-2.7M13.5 7.2c0-1.2 1.2-1.6 1.2-2.7"/>',
    games: '<rect x="2.5" y="7.5" width="19" height="9.5" rx="4.5"/><path d="M8 10.5v3.5M6.2 12.2h3.6"/><circle cx="16.2" cy="11.6" r=".9"/><circle cx="18.2" cy="13.6" r=".9"/>',
    settings: '<path d="M4 7.5h9M17.5 7.5H20M4 16.5h4M12.5 16.5H20"/><circle cx="15" cy="7.5" r="2.2"/><circle cx="10" cy="16.5" r="2.2"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>',
    save: '<path d="M5 4.5h10.5L19 8v11.5H5z"/><path d="M8.5 4.5v4h6v-4M8.5 19.5v-6h7v6"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 12.5h9L17.5 7"/>',
    left: '<path d="M14.5 6l-6 6 6 6"/>',
    right: '<path d="M9.5 6l6 6-6 6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.6-4.6"/>',
    moon: '<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
    bolt: '<path d="M13 3 6 13.5h4.5L10 21l7-10.5h-4.5z"/>',
    chart: '<path d="M4 19.5h16"/><path d="M7.5 19.5V12M12 19.5V6.5M16.5 19.5v-5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5.5 20c.6-3.4 3.3-5.2 6.5-5.2s5.9 1.8 6.5 5.2"/>',
    book: '<path d="M4.5 5.5c2.6-1 5.2-1 7.5.6 2.3-1.6 4.9-1.6 7.5-.6v12.6c-2.6-1-5.2-1-7.5.6-2.3-1.6-4.9-1.6-7.5-.6z"/><path d="M12 6.1v12.6"/>'
  };

  ui.icon = function (name, size) {
    var d = ICONS[name] || ICONS.bolt;
    var s = size || 16;
    return '<svg class="ic" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
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

  // ---------- 顶栏：页面名 + 保存状态 + 手动保存 ----------
  ui.topbar = {
    ready: false,

    init: function () {
      var bar = document.getElementById('topbar');
      if (!bar || this.ready) return;
      this.ready = true;
      bar.innerHTML =
        '<div class="tb-left">' +
        '<div class="tb-crumb"><span class="tb-app">我的工作台</span>' +
        '<span class="tb-sep">/</span><span class="tb-title" id="tb-title">首页</span></div>' +
        '</div>' +
        '<div class="tb-right">' +
        '<span class="save-chip" id="tb-save" data-state="saved"><i class="save-dot"></i>' +
        '<span id="tb-save-text">已保存</span></span>' +
        '<button class="btn btn-sm btn-primary" id="tb-save-btn" title="立即保存到本机（Ctrl/⌘ + S）">' +
        ui.icon('save', 15) + '<span>保存</span></button>' +
        '<button class="icon-btn" id="tb-theme" title="切换深浅色"></button>' +
        '<button class="icon-btn" id="tb-quick" title="快速记录（Ctrl/⌘ + K）">' + ui.icon('bolt', 17) + '</button>' +
        '</div>';

      var self = this;
      document.getElementById('tb-save-btn').addEventListener('click', function () {
        if (App.saveNow) App.saveNow();
      });
      document.getElementById('tb-quick').addEventListener('click', function () { ui.quickCapture(); });
      document.getElementById('tb-theme').addEventListener('click', function () {
        var next = (App.store.settings.theme === 'dark') ? 'light' : 'dark';
        App.store.setSetting('theme', next).then(function () {
          document.documentElement.setAttribute('data-theme', next);
          self.setTheme(next);
        });
      });
      this.setTheme(App.store.settings.theme || 'light');
      this.setSave(App.saveState || { status: 'saved' });
    },

    setTheme: function (theme) {
      var btn = document.getElementById('tb-theme');
      if (btn) btn.innerHTML = ui.icon(theme === 'dark' ? 'sun' : 'moon', 17);
    },

    setMeta: function (title) {
      var el = document.getElementById('tb-title');
      if (el) el.textContent = title || '';
    },

    setSave: function (state) {
      var chip = document.getElementById('tb-save');
      var text = document.getElementById('tb-save-text');
      if (!chip || !text) return;
      state = state || { status: 'saved' };
      var label = '已保存';
      if (state.status === 'saving') label = '保存中…';
      else if (state.status === 'error') label = '保存失败';
      else if (state.at) label = '已保存 ' + U.fmtClock(new Date(state.at));
      else if (state.label) label = state.label;
      chip.setAttribute('data-state', state.status || 'saved');
      text.textContent = label;
    }
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
      if (meta && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (App.saveNow) App.saveNow();
      }
      if (e.key === '/' && !/input|textarea|select/i.test((document.activeElement || {}).tagName || '')) {
        var search = document.querySelector('[data-search]');
        if (search) { e.preventDefault(); search.focus(); }
      }
    });
  }

})(typeof window !== 'undefined' ? window : globalThis);
