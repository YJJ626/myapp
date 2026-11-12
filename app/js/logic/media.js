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

})(typeof window !== 'undefined' ? window : globalThis);
