'use strict';

const state = {
  cases: [],
  passed: 0,
  failed: 0,
  failures: [],
  current: ''
};

function test(name, fn) {
  state.cases.push({ name: name, fn: fn });
}

function err(msg) { throw new Error(msg); }

function ok(value, msg) {
  if (!value) err((msg || '断言失败') + ' — 期望为真，实际为 ' + JSON.stringify(value));
}

function eq(actual, expected, msg) {
  if (actual !== expected) {
    err((msg || '断言失败') + ' — 期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual));
  }
}

function near(actual, expected, tol, msg) {
  if (Math.abs(Number(actual) - Number(expected)) > (tol === undefined ? 0.001 : tol)) {
    err((msg || '断言失败') + ' — 期望约 ' + expected + '，实际 ' + actual);
  }
}

function includes(haystack, needle, msg) {
  if (String(haystack).indexOf(needle) === -1) {
    err((msg || '断言失败') + ' — 未包含 ' + JSON.stringify(needle));
  }
}

function excludes(haystack, needle, msg) {
  if (String(haystack).indexOf(needle) !== -1) {
    err((msg || '断言失败') + ' — 不应包含 ' + JSON.stringify(needle));
  }
}

function throws(fn, msg) {
  let threw = false;
  try { fn(); } catch (e) { threw = true; }
  if (!threw) err((msg || '断言失败') + ' — 期望抛出异常，但没有');
}

async function rejects(promise, msg) {
  let threw = false;
  try { await promise; } catch (e) { threw = true; }
  if (!threw) err((msg || '断言失败') + ' — 期望 Promise 被拒绝，但成功了');
}

async function runAll() {
  const t0 = Date.now();
  for (const c of state.cases) {
    state.current = c.name;
    try {
      await c.fn();
      state.passed++;
      process.stdout.write('  \x1b[32m✓\x1b[0m ' + c.name + '\n');
    } catch (e) {
      state.failed++;
      state.failures.push({ name: c.name, message: e.message });
      process.stdout.write('  \x1b[31m✗\x1b[0m ' + c.name + '\n      ' + e.message + '\n');
    }
  }
  const ms = Date.now() - t0;
  process.stdout.write('\n' + state.passed + ' 通过，' + state.failed + ' 失败，' + ms + 'ms\n');
  if (state.failed) {
    process.stdout.write('\n失败清单：\n');
    state.failures.forEach(f => process.stdout.write('  - ' + f.name + '：' + f.message + '\n'));
  }
  return state.failed === 0;
}

module.exports = { test, ok, eq, near, includes, excludes, throws, rejects, runAll, state };
