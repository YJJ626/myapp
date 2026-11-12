(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;

  var NAV = [
    { key: 'home', name: '首页' },
    { key: 'today', name: '今日计划' },
    { key: 'media', name: '自媒体' },
    { key: 'dev', name: '开发工作' },
    { key: 'consult', name: '咨询工作' },
    { key: 'fitness', name: '健身计划' },
    { key: 'diet', name: '饮食计划' },
    { key: 'games', name: '游戏娱乐' },
    { key: 'settings', name: '数据与设置' }
  ];

  var router = App.router = {
    current: '',
    params: {},
    views: null,

    nav: NAV,

    parse: function (hash) {
      var raw = String(hash || '').replace(/^#\/?/, '');
      var parts = raw.split('?');
      var name = parts[0] || 'home';
      var params = {};
      if (parts[1]) {
        parts[1].split('&').forEach(function (kv) {
          if (!kv) return;
          var p = kv.split('=');
          params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
        });
      }
      return { name: name, params: params };
    },

    start: function (views) {
      var self = this;
      this.views = views;
      this.renderNav();
      window.addEventListener('hashchange', function () { self.render(true); });
      this.render(false);
    },

    renderNav: function () {
      var nav = document.getElementById('nav');
      if (!nav) return;
      var html = '<div class="nav-brand">我的工作台</div>';
      NAV.forEach(function (item) {
        html += '<a class="nav-item" data-route="' + item.key + '" href="#/' + item.key + '">' +
          '<span class="nav-dot"></span><span>' + item.name + '</span></a>';
      });
      html += '<div class="nav-foot">本地运行 · 数据只在这台电脑<br>' +
        '<span class="kbd">⌘K</span> 随手记一条</div>';
      nav.innerHTML = html;
    },

    render: function (changed) {
      var parsed = this.parse(location.hash);
      var name = this.views[parsed.name] ? parsed.name : 'home';
      var view = this.views[name];
      var snap = App.derive.snap();
      var ctx = {
        today: snap.today,
        params: parsed.params,
        settings: snap.settings,
        weekStartKey: snap.weekStartKey
      };

      var main = document.getElementById('main');
      var scroll = changed ? 0 : window.scrollY;

      // 每次渲染换一个新节点，旧节点上的事件监听随之释放，避免重复绑定
      main.innerHTML = '';
      var page = document.createElement('div');
      page.className = 'page';
      page.innerHTML = view.render(snap, ctx);
      main.appendChild(page);
      if (view.mount) view.mount(page, ctx);

      Array.prototype.forEach.call(document.querySelectorAll('.nav-item'), function (el) {
        el.classList.toggle('active', el.getAttribute('data-route') === name);
      });

      document.title = (view.title || '工作台') + ' · 我的工作台';
      this.current = name;
      this.params = parsed.params;
      window.scrollTo(0, scroll);
    }
  };

  App.refresh = function () {
    if (router.views) router.render(false);
  };

  App.go = function (route, params) {
    var q = params ? '?' + Object.keys(params).map(function (k) {
      return k + '=' + encodeURIComponent(params[k]);
    }).join('&') : '';
    location.hash = '#/' + route + q;
  };

})(typeof window !== 'undefined' ? window : globalThis);
