'use strict';
const path = require('path');

const ROOT = path.join(__dirname, '..');

function load(rel) {
  require(path.join(ROOT, rel));
  return globalThis.App;
}

function bootCore() {
  load('app/js/core/util.js');
  load('app/js/core/db.js');
  load('app/js/core/store.js');
  return globalThis.App;
}

function bootAll() {
  bootCore();
  load('app/js/core/derive.js');
  load('app/js/core/ui.js');
  load('app/js/core/router.js');
  ['today', 'dev', 'consult', 'media', 'fitness', 'diet', 'games', 'settings'].forEach(function (m) {
    const p = path.join(ROOT, 'app/js/logic/' + m + '.js');
    if (require('fs').existsSync(p)) require(p);
  });
  ['home', 'today', 'media', 'dev', 'consult', 'fitness', 'diet', 'games', 'settings'].forEach(function (m) {
    const p = path.join(ROOT, 'app/js/views/' + m + '.js');
    if (require('fs').existsSync(p)) require(p);
  });
  return globalThis.App;
}

async function freshStore(driver) {
  const App = globalThis.App;
  App.db.useDriver(driver || App.db.createMemoryDriver());
  await App.store.init();
  return App.store;
}

function makeLocalStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    clear: () => m.clear(),
    key: i => Array.from(m.keys())[i] || null,
    get length() { return m.size; }
  };
}

module.exports = { ROOT, load, bootCore, bootAll, freshStore, makeLocalStorage };
