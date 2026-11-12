'use strict';
const fs = require('fs');
const path = require('path');
const { runAll } = require('./harness');

const only = process.argv[2];
const files = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.test.js'))
  .filter(f => !only || f.indexOf(only) !== -1)
  .sort();

console.log('运行测试：' + files.join(', ') + '\n');
files.forEach(f => require(path.join(__dirname, f)));

runAll().then(pass => {
  process.exit(pass ? 0 : 1);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
