// Kiểm tra docs/facts.js (chọn 1 fact cho màn kết quả). Chạy: node tests/facts.node.js
const assert = require('assert');
const F = require('../docs/facts.js');
const LO = { cadence: 165, vert_osc: 6, shank_ic: -5, overstride: -5, knee_ic: 10, trunk: 4, pelvic_drop: -3 };
const run = (m, strike) => F.pick((k) => m[k] || [], (k) => LO[k], strike).k;
assert.strictEqual(run({}, true), 'strike', 'không lệch, có đáp đất');
assert.strictEqual(run({}, false), 'cadence', 'không lệch, không có đáp đất');
assert.strictEqual(run({ cadence: [{ v: 150, lv: 'bad' }], vert_osc: [{ v: 11, lv: 'mid' }] }), 'cadence', 'lệch nặng nhất thắng');
assert.strictEqual(run({ cadence: [{ v: 160, lv: 'mid' }], overstride: [{ v: 25, lv: 'bad' }] }), 'cadence', 'chỉ số khách thấy trong bảng được ưu tiên');
assert.strictEqual(run({ knee_ic: [{ v: 6, lv: 'mid' }], overstride: [{ v: 25, lv: 'bad' }] }), 'overstride', 'cùng nhóm: bad thắng mid');
assert.strictEqual(run({ trunk: [{ v: 16, lv: 'bad' }] }, true), 'strike', 'nghiêng thân quá nhiều: không dùng fact "nghiêng thêm"');
assert.strictEqual(run({ trunk: [{ v: 1, lv: 'mid' }] }), 'trunk', 'nghiêng thân ít: dùng fact nghiêng thân');
assert.strictEqual(run({ cadence: [{ v: 185, lv: 'mid' }] }, true), 'strike', 'nhịp cao: không dùng fact tăng nhịp');
for (const k of Object.keys(F.FACTS)) assert.ok(F.FACTS[k].t && F.FACTS[k].src, k);
console.log('facts.node.js: OK');
