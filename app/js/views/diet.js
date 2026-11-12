(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var views = App.views = App.views || {};
  var D = App.logic.diet;

  views.diet = {
    title: '饮食计划',
    render: function (snap, ctx) {
      var date = ctx.today;
      var goal = snap.settings.goals || {};
      var totals = App.derive.mealTotals(snap.meals, snap.foods, date);
      var fmap = {};
      (snap.foods || []).forEach(function (f) { fmap[f.id] = f; });
      var water = 0;
      (snap.dayMetas || []).forEach(function (m) { if (m.id === date) water = m.waterCups || 0; });

      var html = '<div class="page-head"><div class="grow"><h1>饮食计划</h1>' +
        '<div class="sub">' + U.escape(U.fmtDateCN(date)) + ' · 计划归计划，先记实际吃进去的</div></div>' +
        '<div class="page-actions"><button class="btn btn-sm" data-act="open-foods">食物库</button></div></div>';

      // 进度
      var kcalPct = goal.kcal ? totals.actual.kcal / goal.kcal * 100 : 0;
      var proPct = goal.protein ? totals.actual.protein / goal.protein * 100 : 0;
      html += '<div class="card card-pad" style="margin-bottom:14px">' +
        '<div class="grid-3">' +
        '<div><div class="row-between small" style="margin-bottom:5px"><span class="muted">热量</span>' +
        '<span class="' + (kcalPct > 100 ? 'bold' : 'faint') + '" style="' + (kcalPct > 100 ? 'color:var(--danger)' : '') + '">' +
        totals.actual.kcal + ' / ' + (goal.kcal || 0) + ' kcal</span></div>' +
        App.ui.bar(kcalPct, kcalPct > 100 ? 'danger' : '') + '</div>' +
        '<div><div class="row-between small" style="margin-bottom:5px"><span class="muted">蛋白质</span>' +
        '<span class="faint">' + totals.actual.protein + ' / ' + (goal.protein || 0) + ' g</span></div>' +
        App.ui.bar(proPct) + '</div>' +
        '<div><div class="row-between small" style="margin-bottom:5px"><span class="muted">喝水</span>' +
        '<span class="faint">' + water + ' / 8 杯</span></div>' +
        '<div class="water">' + [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) {
          return '<i data-act="water" data-index="' + i + '" class="' + (i < water ? 'on' : '') + '"></i>';
        }).join('') + '</div></div>' +
        '</div></div>';

      html += '<div class="grid-2">';

      html += '<div class="card"><div class="card-head"><h3>今日四餐</h3>' +
        '<span class="small faint">实际 ' + totals.actual.kcal + ' kcal</span></div><div class="card-pad">';

      D.MEALS.forEach(function (m) {
        var meal = (snap.meals || []).filter(function (x) { return x.date === date && x.type === m.key; })[0];
        var plan = (meal && meal.plan) || [];
        var actual = (meal && meal.actual) || [];
        var kcal = 0;
        actual.forEach(function (it) {
          var f = fmap[it.foodId];
          if (f) kcal += (Number(f.kcal) || 0) * (Number(it.qty) || 0);
        });
        html += '<div class="meal-block">' +
          '<div class="row-between" style="margin-bottom:2px">' +
          '<span class="bold">' + m.name + '</span>' +
          '<span class="row" style="gap:4px">' +
          '<span class="tiny faint">' + Math.round(kcal) + ' kcal</span>' +
          '<button class="btn btn-ghost btn-sm" data-act="add-food" data-type="' + m.key + '" data-kind="plan">+ 计划</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="add-food" data-type="' + m.key + '" data-kind="actual">+ 吃了</button>' +
          '</span></div>' +
          '<div class="meal-cols">' +
          '<div><div class="meal-col-label">计划</div>';
        if (!plan.length) html += '<div class="tiny faint">还没想</div>';
        plan.forEach(function (it) {
          var f = fmap[it.foodId] || { name: '已删除的食物', kcal: 0 };
          html += '<div class="food-line"><span>' + U.escape(f.name) + ' × ' + it.qty + '</span>' +
            '<span class="row" style="gap:2px"><span class="tiny faint">' + Math.round((f.kcal || 0) * it.qty) + '</span>' +
            '<span class="x" data-act="del-item" data-meal="' + (meal ? meal.id : '') + '" data-kind="plan" data-food="' + it.foodId + '" ' +
            'style="cursor:pointer;color:var(--text-3)">✕</span></span></div>';
        });
        html += '</div><div><div class="meal-col-label">实际</div>';
        if (!actual.length) html += '<div class="tiny faint">还没吃</div>';
        actual.forEach(function (it) {
          var f = fmap[it.foodId] || { name: '已删除的食物', kcal: 0 };
          html += '<div class="food-line"><span>' + U.escape(f.name) + ' × ' + it.qty + '</span>' +
            '<span class="row" style="gap:2px"><span class="tiny faint">' + Math.round((f.kcal || 0) * it.qty) + '</span>' +
            '<span class="x" data-act="del-item" data-meal="' + (meal ? meal.id : '') + '" data-kind="actual" data-food="' + it.foodId + '" ' +
            'style="cursor:pointer;color:var(--text-3)">✕</span></span></div>';
        });
        html += '</div></div>';
        if (meal && meal.note) html += '<div class="tiny faint" style="margin-top:4px">' + U.escape(meal.note) + '</div>';
        html += '</div>';
      });

      html += '</div></div>';

      html += '<div class="stack">';
      if (!snap.foods.length) {
        html += '<div class="card">' + App.ui.empty({
          title: '食物库是空的',
          hint: '先把常吃的几个加进去，之后记录只需点一下',
          action: 'open-foods',
          actionLabel: '添加常吃的食物'
        }) + '</div>';
      }

      html += '<div class="card card-pad"><div class="row-between" style="margin-bottom:8px">' +
        '<h3>这周买什么</h3>' +
        (snap.shoppingItems.filter(function (x) { return x.done; }).length
          ? '<button class="btn btn-ghost btn-sm" data-act="clear-shopping">清掉已买</button>' : '') +
        '</div>' +
        '<input type="text" data-enter="add-shopping" placeholder="加一样，回车">' +
        '<div style="margin-top:8px">';
      if (!snap.shoppingItems.length) {
        html += '<div class="tiny faint">清单是空的。</div>';
      }
      snap.shoppingItems.forEach(function (x) {
        html += '<div class="list-row">' +
          '<span class="check" data-act="toggle-shopping" data-id="' + x.id + '" data-done="' + (x.done ? 1 : 0) + '"></span>' +
          '<span class="grow ' + (x.done ? 'done-text' : '') + '">' + U.escape(x.text) + '</span></div>';
      });
      html += '</div></div>';
      html += '</div></div>';

      return html;
    },

    mount: function (root, ctx) {
      function openFoods() {
        var body = '<div id="food-list">';
        var foods = App.store.list('foods');
        if (!foods.length) body += '<div class="small faint" style="margin-bottom:10px">还没有食物。</div>';
        foods.forEach(function (f) {
          body += '<div class="mini-row"><span class="grow">' + U.escape(f.name) + '</span>' +
            '<span class="tag">' + f.kcal + ' kcal</span><span class="tag">' + f.protein + ' g 蛋白</span>' +
            '<span class="x" data-del="' + f.id + '">✕</span></div>';
        });
        body += '</div><hr>' +
          App.ui.field('名称', '<input type="text" data-name placeholder="例如：鸡胸肉饭">') +
          '<div class="field-row">' +
          App.ui.field('热量（每份）', '<input type="number" data-kcal placeholder="520">') +
          App.ui.field('蛋白质（g）', '<input type="number" data-protein placeholder="35">') +
          '</div>' +
          App.ui.field('单位', '<input type="text" data-unit value="份">');

        App.ui.openDrawer({
          title: '食物库',
          body: body,
          foot: '<button class="btn btn-primary" data-add>添加</button>',
          onMount: function (panel, close) {
            panel.querySelector('[data-add]').addEventListener('click', function () {
              D.addFood({
                name: panel.querySelector('[data-name]').value,
                kcal: panel.querySelector('[data-kcal]').value,
                protein: panel.querySelector('[data-protein]').value,
                unit: panel.querySelector('[data-unit]').value
              }).then(function (row) {
                if (!row) { App.ui.toast('先写名称'); return; }
                close();
                App.refresh();
                App.ui.toast('已加入食物库');
              });
            });
            panel.querySelectorAll('[data-del]').forEach(function (el) {
              el.addEventListener('click', function () {
                D.removeFood(el.getAttribute('data-del')).then(function () {
                  close();
                  App.refresh();
                });
              });
            });
          }
        });
      }

      function openPicker(type, kind) {
        var foods = App.store.list('foods');
        if (!foods.length) { openFoods(); return; }
        var body = '<div class="small faint" style="margin-bottom:8px">选一个，再填份数。' +
          (kind === 'plan' ? '这是计划吃的。' : '这是已经吃掉的。') + '</div>' +
          '<div class="field"><label>份数</label><input type="number" step="0.5" data-qty value="1"></div>' +
          '<div class="pick-list">' + foods.map(function (f) {
            return '<div class="pick-row" data-food="' + f.id + '">' +
              '<span class="grow">' + U.escape(f.name) + '</span>' +
              '<span class="tiny faint">' + f.kcal + ' kcal</span></div>';
          }).join('') + '</div>';

        App.ui.openDrawer({
          title: D.mealName(type) + (kind === 'plan' ? ' · 计划' : ' · 实际'),
          body: body,
          onMount: function (panel, close) {
            panel.querySelectorAll('[data-food]').forEach(function (el) {
              el.addEventListener('click', function () {
                var qty = panel.querySelector('[data-qty]').value;
                D.addItem(ctx.today, type, kind, el.getAttribute('data-food'), qty).then(function () {
                  close();
                  App.refresh();
                });
              });
            });
          }
        });
      }

      App.ui.bind(root, {
        acts: {
          'open-foods': openFoods,
          'add-food': function (d) { openPicker(d.type, d.kind); },
          'del-item': function (d) {
            if (!d.meal) return;
            D.removeItem(d.meal, d.kind, d.food).then(function () { App.refresh(); });
          },
          water: function (d) {
            D.toggleWater(ctx.today, Number(d.index)).then(function () { App.refresh(); });
          },
          'add-shopping': function (d, el) {
            if (!el.value.trim()) return;
            D.addShopping(el.value).then(function () {
              el.value = '';
              App.refresh();
            });
          },
          'toggle-shopping': function (d) {
            D.toggleShopping(d.id).then(function () { App.refresh(); });
          },
          'clear-shopping': function () {
            D.clearDoneShopping().then(function () {
              App.ui.toast('已清掉买好的');
              App.refresh();
            });
          }
        }
      });
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
