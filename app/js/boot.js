(function () {
  'use strict';
  var App = window.App;

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', App.store.settings.theme || 'light');
  }

  function storageHint() {
    if (location.protocol !== 'file:') return;
    var bar = document.createElement('div');
    bar.className = 'storage-bar';
    bar.style.cssText = 'position:sticky;top:0;z-index:30;background:#faeeda;color:#8a5209;' +
      'font-size:12px;padding:6px 14px;text-align:center;border-bottom:1px solid rgba(138,82,9,.2)';
    bar.textContent = '当前是直接打开文件的方式。建议用「启动.bat」启动，数据更稳；无论哪种方式，都请定期在设置里导出备份。';
    document.body.insertBefore(bar, document.body.firstChild);
  }

  // ---------- 保存状态与手动保存 ----------
  App.saveState = { status: 'saved', at: Date.now() };

  function paintSave() {
    if (App.ui && App.ui.topbar) App.ui.topbar.setSave(App.saveState);
  }

  App.markSaving = function () {
    if (App.saveState.status === 'saving') return;
    App.saveState = { status: 'saving', at: App.saveState.at };
    paintSave();
  };

  App.markSaved = function (ok) {
    App.saveState = { status: ok === false ? 'error' : 'saved', at: Date.now() };
    paintSave();
  };

  var mirrorTimer = null;
  var inFlight = null;

  function writeMirror() {
    if (!App.db.mirrorEnabled) {
      App.markSaved(true);
      return Promise.resolve(true);
    }
    App.markSaving();
    inFlight = App.db.mirrorSave(App.store.exportPayload()).then(function (ok) {
      App.markSaved(ok);
      return ok;
    }).catch(function () {
      App.markSaved(false);
      return false;
    });
    return inFlight;
  }

  // 手动保存：跳过防抖，立刻落盘
  App.saveNow = function () {
    if (mirrorTimer) { clearTimeout(mirrorTimer); mirrorTimer = null; }
    return writeMirror().then(function (ok) {
      App.ui.toast(ok === false ? '保存失败：检查启动窗口是否还在' : '已保存到本机');
      return ok;
    });
  };

  function bootMirror() {
    if (!App.db.mirrorAvailable()) {
      App.markSaved(true);
      return;
    }
    App.db.mirrorEnabled = true;
    App.store.onPersist = function () {
      App.markSaving();
      if (mirrorTimer) clearTimeout(mirrorTimer);
      mirrorTimer = setTimeout(function () {
        mirrorTimer = null;
        writeMirror();
      }, 650);
    };

    if (App.store.list('tasks').length === 0 && App.store.list('projects').length === 0) {
      App.db.mirrorLoad().then(function (payload) {
        if (!payload) return;
        if (!App.store.validateBackup(payload).ok) return;
        App.store.importPayload(payload, 'merge').then(function () {
          if (App.router.views) App.refresh();
        });
      });
    } else {
      App.markSaved(true);
    }
  }

  function main() {
    App.db.init().then(function (driverName) {
      return App.store.init().then(function () {
        App.storageDriver = driverName;
        applyTheme();
        storageHint();
        App.router.start(App.views);
        bootMirror();
        App.markSaved(true);
        if (driverName === 'memory') {
          console.warn('[工作台] 当前使用内存存储，刷新后数据会丢失。请用 启动.bat 启动。');
        }
      });
    }).catch(function (err) {
      console.error('启动失败', err);
      document.getElementById('main').innerHTML =
        '<div class="empty"><div class="empty-title">启动失败</div>' +
        '<div class="empty-hint">' + App.util.escape(err && err.message || '未知错误') + '</div></div>';
    });
  }

  main();
})();
