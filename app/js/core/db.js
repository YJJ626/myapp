(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var db = App.db = {};

  db.STORES = [
    'tasks', 'memos', 'contents', 'projects', 'consults', 'answers',
    'templates', 'sessions', 'bodyMetrics', 'meals', 'foods', 'games',
    'playSessions', 'wishItems', 'shoppingItems', 'repeats', 'notes',
    'dayMetas', 'settings', 'meta'
  ];

  db.driverName = 'memory';
  db.driver = null;

  function clone(o) { return o === null || o === undefined ? o : JSON.parse(JSON.stringify(o)); }

  // ---------- memory driver ----------
  db.createMemoryDriver = function (backing) {
    var mem = backing || {};
    db.STORES.forEach(function (s) { if (!mem[s]) mem[s] = {}; });
    return {
      name: 'memory',
      backing: mem,
      open: function () { return Promise.resolve(); },
      all: function (store) { return Promise.resolve(Object.values(mem[store] || {}).map(clone)); },
      put: function (store, rec) {
        mem[store] = mem[store] || {};
        mem[store][rec.id] = clone(rec);
        return Promise.resolve();
      },
      remove: function (store, id) {
        if (mem[store]) delete mem[store][id];
        return Promise.resolve();
      },
      clear: function (store) {
        mem[store] = {};
        return Promise.resolve();
      }
    };
  };

  // ---------- localStorage driver ----------
  db.createLocalStorageDriver = function (storage) {
    var PREFIX = 'worklife/v1/';
    function read(store) {
      var raw = storage.getItem(PREFIX + store);
      if (!raw) return {};
      try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
    }
    function write(store, obj) {
      storage.setItem(PREFIX + store, JSON.stringify(obj));
    }
    return {
      name: 'ls',
      open: function () { return Promise.resolve(); },
      all: function (store) { return Promise.resolve(Object.values(read(store)).map(clone)); },
      put: function (store, rec) {
        var obj = read(store);
        obj[rec.id] = clone(rec);
        write(store, obj);
        return Promise.resolve();
      },
      remove: function (store, id) {
        var obj = read(store);
        delete obj[id];
        write(store, obj);
        return Promise.resolve();
      },
      clear: function (store) { storage.removeItem(PREFIX + store); return Promise.resolve(); }
    };
  };

  // ---------- indexedDB driver ----------
  db.createIndexedDriver = function (factory, dbName) {
    var DB_NAME = dbName || 'worklife';
    var VERSION = 1;
    var conn = null;

    function open() {
      return new Promise(function (resolve, reject) {
        var req = factory.open(DB_NAME, VERSION);
        req.onupgradeneeded = function () {
          var d = req.result;
          db.STORES.forEach(function (s) {
            if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
          });
        };
        req.onsuccess = function () { conn = req.result; resolve(conn); };
        req.onerror = function () { reject(req.error); };
        req.onblocked = function () { reject(new Error('indexedDB blocked')); };
      });
    }

    function tx(store, mode) {
      return conn.transaction(store, mode).objectStore(store);
    }

    return {
      name: 'idb',
      open: open,
      all: function (store) {
        return new Promise(function (resolve, reject) {
          var req = tx(store, 'readonly').getAll();
          req.onsuccess = function () { resolve(req.result || []); };
          req.onerror = function () { reject(req.error); };
        });
      },
      put: function (store, rec) {
        return new Promise(function (resolve, reject) {
          var req = tx(store, 'readwrite').put(clone(rec));
          req.onsuccess = function () { resolve(); };
          req.onerror = function () { reject(req.error); };
        });
      },
      remove: function (store, id) {
        return new Promise(function (resolve, reject) {
          var req = tx(store, 'readwrite').delete(id);
          req.onsuccess = function () { resolve(); };
          req.onerror = function () { reject(req.error); };
        });
      },
      clear: function (store) {
        return new Promise(function (resolve, reject) {
          var req = tx(store, 'readwrite').clear();
          req.onsuccess = function () { resolve(); };
          req.onerror = function () { reject(req.error); };
        });
      }
    };
  };

  db.detect = function () {
    var hasLocation = typeof location !== 'undefined';
    var isFile = hasLocation && location.protocol === 'file:';
    if (typeof indexedDB !== 'undefined' && !isFile) return 'idb';
    if (typeof localStorage !== 'undefined') return 'ls';
    return 'memory';
  };

  db.init = function (driverName) {
    var name = driverName || db.detect();
    try {
      if (name === 'idb') db.driver = db.createIndexedDriver(root.indexedDB);
      else if (name === 'ls') db.driver = db.createLocalStorageDriver(root.localStorage);
      else db.driver = db.createMemoryDriver();
    } catch (e) {
      db.driver = db.createMemoryDriver();
      name = 'memory';
    }
    db.driverName = name;
    return Promise.resolve(db.driver.open()).then(function () { return name; });
  };

  db.useDriver = function (driver) {
    db.driver = driver;
    db.driverName = driver.name;
    return Promise.resolve(driver.open ? driver.open() : null);
  };

  db.all = function (store) { return db.driver.all(store); };
  db.put = function (store, rec) { return db.driver.put(store, rec); };
  db.remove = function (store, id) { return db.driver.remove(store, id); };
  db.clear = function (store) { return db.driver.clear(store); };

  db.clearAll = function () {
    return Promise.all(db.STORES.map(function (s) { return db.clear(s); }));
  };

  // ---------- 本地文件镜像（P1，仅在 http 模式下生效） ----------
  db.mirrorAvailable = function () {
    return typeof fetch === 'function' && typeof location !== 'undefined' && /^https?:$/.test(location.protocol);
  };

  db.mirrorSave = function (payload) {
    if (!db.mirrorAvailable() || !db.mirrorEnabled) return Promise.resolve(false);
    return fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  };

  db.mirrorLoad = function () {
    if (!db.mirrorAvailable() || !db.mirrorEnabled) return Promise.resolve(null);
    return fetch('/api/data').then(function (r) {
      if (!r.ok) return null;
      return r.json();
    }).catch(function () { return null; });
  };

  db.mirrorEnabled = false;

})(typeof window !== 'undefined' ? window : globalThis);
