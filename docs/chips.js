/* Chip chọn nhanh thay cho ô số (cài đặt đo, chọn file video).
 * Input số gốc vẫn là nguồn giá trị (app.js, localStorage, ?total= ?clip= đọc/ghi nó):
 *   - bấm chip: ghi value + phát 'change' (bubbles) như người dùng gõ;
 *   - ô gốc chỉ hiện khi bấm "Khác" (hoặc giá trị không trùng chip nào), đóng vai ô nhập số tay;
 *   - app.js ghi .value không có sự kiện thì gọi Chips.sync() để chip cập nhật trạng thái chọn.
 */
(function () {
  'use strict';
  var sec = function (v) { return 'giây thứ ' + v; };
  var kmh = function (v) { return String(v); };
  var SPEEDS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 16];
  var GROUPS = [
    { id: 's_speed', opts: SPEEDS, fmt: kmh, unit: 'km/h' },
    { id: 'vspeed', opts: SPEEDS, fmt: kmh, unit: 'km/h' },
    { id: 'vstart', opts: [0, 10, 30, 50], fmt: sec, unit: ' giây' }
  ];
  var built = [];

  function build(g) {
    var src = document.getElementById(g.id); if (!src || src.dataset.chips) return;
    src.dataset.chips = '1';
    var wrap = document.createElement('div'); wrap.className = 'chips'; wrap.setAttribute('role', 'radiogroup');
    var lab = document.querySelector('label[for="' + g.id + '"]');
    if (lab) { if (!lab.id) lab.id = g.id + '_lab'; wrap.setAttribute('aria-labelledby', lab.id); }
    var btns = g.opts.map(function (v) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('role', 'radio');
      b.dataset.v = String(v); b.textContent = g.fmt(v);
      b.addEventListener('click', function () { src.value = String(v); src.dispatchEvent(new Event('change', { bubbles: true })); sync(); });
      wrap.appendChild(b); return b;
    });
    var other = document.createElement('button'); other.type = 'button'; other.className = 'chip'; other.setAttribute('role', 'radio'); other.textContent = 'Khác';
    wrap.appendChild(other);
    // ô nhập tay: dùng luôn input gốc, kèm đơn vị
    var box = document.createElement('span'); box.className = 'chip-other'; box.hidden = true;
    src.parentNode.insertBefore(wrap, src);
    box.appendChild(src); var u = document.createElement('span'); u.textContent = g.unit; box.appendChild(u); wrap.appendChild(box);
    var forced = false;
    other.addEventListener('click', function () { forced = true; sync(); src.focus(); });
    function sync() {
      var raw = String(src.value).trim(), cur = raw === '' ? NaN : Number(raw), hit = false;
      btns.forEach(function (b) { var on = Number(b.dataset.v) === cur; if (on) hit = true; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
      var isOther = !hit && (forced || raw !== '') || document.activeElement === src;
      if (hit) forced = false;
      other.classList.toggle('on', isOther); other.setAttribute('aria-checked', isOther ? 'true' : 'false');
      box.hidden = !isOther;
    }
    src.addEventListener('input', sync); src.addEventListener('change', sync);
    built.push(sync); sync();
  }
  GROUPS.forEach(build);
  window.Chips = { sync: function () { built.forEach(function (f) { f(); }); } };
})();
