// Kiểm tra docs/stable.js (chọn 30 giây ổn định nhất). Chạy: node tests/stable.node.js
const assert = require('assert');
const Stable = require('../docs/stable.js');

// Người giả: hông dao động lên xuống theo nhịp chạy; freq(t) = số bước/giây; gap = [a, b] giây không thấy người
function make(total, fps, freq, gap) {
  const fr = []; let ph = 0;
  for (let i = 0; i <= total * fps; i++) {
    const t = 100 + i / fps; if (i) ph += 2 * Math.PI * freq(i / fps) / fps;
    if (gap && i / fps >= gap[0] && i / fps < gap[1]) { fr.push({ t, lm: null }); continue; }
    const lm = []; for (let k = 0; k < 33; k++) lm.push({ x: 300, y: 300, v: 0.9 });
    const y = 400 + 8 * Math.sin(ph);
    lm[23] = { x: 300, y, v: 0.9 }; lm[24] = { x: 305, y, v: 0.9 }; lm[11] = { x: 300, y: y - 150, v: 0.9 }; lm[12] = { x: 305, y: y - 150, v: 0.9 };
    fr.push({ t, lm });
  }
  return fr;
}
// 1) 20 giây đầu nhịp còn tăng dần (đang lên tốc), sau đó đều 168 bước/phút; mất hình ở giây 52–57
let w = Stable.pick(make(60, 30, (t) => (t < 20 ? 2.2 + 0.6 * t / 20 : 2.8), [52, 57]), 30);
assert.ok(w.cut, 'phải cắt đoạn');
assert.ok(Math.abs((w.to - w.from) - 30) < 1e-6, 'đoạn dài 30 giây');
assert.ok(w.from >= 17 && w.to <= 53, 'đoạn nằm trong phần ổn định, được ' + w.from + '–' + w.to);
assert.ok(Math.abs(w.cad - 168) < 4, 'nhịp ~168, được ' + w.cad);
// 2) đều từ đầu, 10 giây cuối loạn nhịp: chọn đoạn sớm
w = Stable.pick(make(60, 30, (t) => (t < 48 ? 2.9 : 2.9 + 0.5 * Math.sin(t * 3))), 30);
assert.ok(w.to <= 50, 'tránh phần cuối loạn nhịp, được ' + w.from + '–' + w.to);
// 3) lần quay ngắn hơn đoạn cần chọn: dùng cả lần quay
w = Stable.pick(make(20, 30, () => 2.8), 30);
assert.ok(!w.cut && Math.abs(w.total - 20) < 0.1);
// 4) máy chậm 15 khung/giây vẫn chọn được
w = Stable.pick(make(60, 15, (t) => (t < 25 ? 2.3 + 0.5 * t / 25 : 2.8)), 30);
assert.ok(w.cut && w.from >= 20, 'máy chậm: được ' + w.from + '–' + w.to);
// 5) không có khung nào
assert.strictEqual(Stable.pick([], 30).cut, false);
console.log('stable.node.js: OK');
