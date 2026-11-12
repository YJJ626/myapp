(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var S = function () { return App.store; };
  var media = App.logic.media = {};

  media.STAGES = [
    { key: 'idea', name: '选题池' },
    { key: 'drafting', name: '写作中' },
    { key: 'scheduled', name: '待发布' },
    { key: 'published', name: '已发布' },
    { key: 'archived', name: '归档' }
  ];

  media.PLATFORMS = {
    bilibili: 'B站',
    xiaohongshu: '小红书',
    wechat: '公众号',
    douyin: '抖音'
  };

  media.platformName = function (k) { return media.PLATFORMS[k] || '未选平台'; };

  media.stageName = function (k) {
    var hit = media.STAGES.filter(function (s) { return s.key === k; })[0];
    return hit ? hit.name : '选题池';
  };

  media.add = function (opts) {
    opts = opts || {};
    var title = String(opts.title || '').trim();
    if (!title) return Promise.resolve(null);
    return S().put('contents', {
      title: title,
      platform: opts.platform || 'xiaohongshu',
      hook: String(opts.hook || '').trim(),
      stage: opts.stage || 'idea',
      planDate: opts.planDate || '',
      script: '',
      links: [],
      publishedAt: '',
      stats: { view: 0, like: 0, fans: 0 },
      retro: ''
    });
  };

  media.get = function (id) { return S().get('contents', id); };

  media.update = function (id, patch) {
    var row = S().get('contents', id);
    if (!row) return Promise.resolve(null);
    return S().put('contents', Object.assign({}, row, patch));
  };

  media.move = function (id, stage) {
    var row = S().get('contents', id);
    if (!row) return Promise.resolve(null);
    var patch = { stage: stage };
    if (stage === 'published' && !row.publishedAt) {
      patch.publishedAt = U.todayKey(new Date(), S().settings.dayCutoffHour);
    }
    return S().put('contents', Object.assign({}, row, patch));
  };

  media.remove = function (id) { return S().remove('contents', id); };

  media.setStats = function (id, stats) {
    return media.update(id, { stats: Object.assign({ view: 0, like: 0, fans: 0 }, stats || {}) });
  };

  media.byStage = function (contents, stage) {
    return (contents || []).filter(function (c) { return c.stage === stage; });
  };

  media.weekPlan = function (contents, weekStartKey) {
    var days = U.weekDays(weekStartKey);
    return days.map(function (day) {
      return {
        date: day,
        items: (contents || []).filter(function (c) {
          return c.planDate === day && c.stage !== 'archived';
        })
      };
    });
  };

  media.unscheduled = function (contents) {
    return (contents || []).filter(function (c) {
      return c.stage !== 'archived' && !c.planDate;
    });
  };

  // ---------- 发布数据概览（图表用，纯函数，不读全局） ----------
  media.overview = function (contents, today) {
    var rows = (contents || []).filter(function (c) {
      var st = c.stats || {};
      return c.stage === 'published' || ((st.view || 0) + (st.like || 0) + (st.fans || 0) > 0);
    }).map(function (c) {
      var st = c.stats || {};
      var view = Number(st.view) || 0;
      var like = Number(st.like) || 0;
      var fans = Number(st.fans) || 0;
      return {
        id: c.id,
        title: c.title,
        platform: c.platform,
        platformName: media.platformName(c.platform),
        publishedAt: c.publishedAt || c.planDate || '',
        view: view,
        like: like,
        fans: fans,
        engagement: view ? U.round(like / view * 100, 1) : 0
      };
    }).sort(function (a, b) {
      if (a.view !== b.view) return b.view - a.view;
      return a.title < b.title ? -1 : 1;
    });

    var totals = {
      count: rows.length,
      view: U.sum(rows, function (r) { return r.view; }),
      like: U.sum(rows, function (r) { return r.like; }),
      fans: U.sum(rows, function (r) { return r.fans; }),
      avgView: rows.length ? Math.round(U.sum(rows, function (r) { return r.view; }) / rows.length) : 0
    };
    totals.engagement = totals.view ? U.round(totals.like / totals.view * 100, 1) : 0;

    // 近 6 周：发布条数与播放量
    var weeks = [];
    var base = today || U.todayKey(new Date(), 4);
    for (var i = 5; i >= 0; i--) {
      var key = U.weekStart(U.addDays(base, -7 * i), 1);
      weeks.push({ key: key, label: U.fmtShort(key), count: 0, view: 0 });
    }
    var byWeek = {};
    weeks.forEach(function (w) { byWeek[w.key] = w; });
    rows.forEach(function (r) {
      if (!r.publishedAt) return;
      var wk = byWeek[U.weekStart(r.publishedAt, 1)];
      if (!wk) return;
      wk.count++;
      wk.view += r.view;
    });
    var maxWeekView = Math.max.apply(null, weeks.map(function (w) { return w.view; }).concat([0]));

    // 平台分布
    var pmap = {};
    rows.forEach(function (r) {
      var p = pmap[r.platform] = pmap[r.platform] || { key: r.platform, name: r.platformName, count: 0, view: 0 };
      p.count++;
      p.view += r.view;
    });
    var platforms = Object.keys(pmap).map(function (k) { return pmap[k]; })
      .sort(function (a, b) { return b.view - a.view; });

    return {
      rows: rows,
      totals: totals,
      weeks: weeks,
      maxWeekView: maxWeekView,
      maxView: Math.max.apply(null, rows.map(function (r) { return r.view; }).concat([0])),
      platforms: platforms
    };
  };

})(typeof window !== 'undefined' ? window : globalThis);
