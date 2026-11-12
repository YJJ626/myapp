(function () {
  'use strict';
  var App = window.App;

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', App.store.settings.theme || 'light');
  }

  function storageHint() {
    if (location.protocol !== 'file:') return;
    var bar = document.createElement('div');
    bar.style.cssText = 'position:sticky;top:0;z-index:30;background:#faeeda;color:#8a5209;' +
      'font-size:12px;padding:6px 14px;text-align:center;border-bottom:1px solid rgba(138,82,9,.2)';
    bar.textContent = '当前是直接打开文件的方式。建议用「启动.bat」启动，数据更稳；无论哪种方式，都请定期在设置里导出备份。';
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function bootMirror() {
    if (!App.db.mirrorAvailable()) return;
    App.db.mirrorEnabled = true;
    var save = App.util.debounce(function () {
      App.db.mirrorSave(App.store.exportPayload());
    }, 800);
    App.store.onPersist = function () { save(); };

    if (App.store.list('tasks').length === 0 && App.store.list('projects').length === 0) {
      App.db.mirrorLoad().then(function (payload) {
        if (!payload) return;
        if (!App.store.validateBackup(payload).ok) return;
        App.store.importPayload(payload, 'merge').then(function () {
          if (App.router.views) App.refresh();
        });
      });
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
