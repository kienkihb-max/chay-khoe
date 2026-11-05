/* mock_data.js - chỉ nạp khi có ?mock=1. Sinh dữ liệu mẫu (người que chạy) để xem màn Kết quả mà không phải đo tay.
   Cùng công thức với mock_pose.js nhưng đổi được nhịp, độ nảy, chân đặt trước hông, nghiêng thân, lệch trái/phải. */
window.MockData = (function () {
  const W = 1280, H = 720;
  // Người mẫu: tên Việt, số đo và dáng chạy khác nhau để điểm và kết luận khác nhau
  const PEOPLE = [
    { name: 'Nguyễn Văn Hùng', phone: '0901234567', height: 172, pain: '', cad: 172, bounce: 4, reach: 25, lean: 6, asym: 1 },
    { name: 'Trần Thị Mai Anh', phone: '0912345678', height: 158, pain: 'Đau gối phải khi chạy xa', cad: 160, bounce: 6.5, reach: 38, lean: 5, asym: 0.8 },
    { name: 'Lê Quốc Bảo', phone: '0988765432', height: 180, pain: '', cad: 182, bounce: 3.5, reach: 22, lean: 14, asym: 1 },
    { name: 'Phạm Thu Hà', phone: '0933456789', height: 163, pain: 'Căng bắp chân trái', cad: 150, bounce: 8, reach: 30, lean: 4, asym: 1.15 },
    { name: 'Đặng Minh Tuấn', phone: '0977123456', height: 168, pain: 'Đau lưng dưới', cad: 168, bounce: 5, reach: 42, lean: 16, asym: 0.85 },
  ];
  function landmarks(t, p) {
    const pxcm = 3 * p.height / 172, sh = p.cad / 60 / 2, hx = 640;
    const hipy = 300 + 4 * pxcm * 0 + p.bounce * pxcm * Math.sin(2 * Math.PI * (p.cad / 60) * t);
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5 * W, y: 0.3 * H, v: 1 }));
    const set = (j, x, y, v) => { lm[j] = { x, y, v }; };
    [[[11, 23, 25, 27, 29, 31], 0, .95, 1], [[12, 24, 26, 28, 30, 32], Math.PI, .75, p.asym]].forEach(([ids, shift, vis, k]) => {
      const ph = 2 * Math.PI * sh * t + shift, ax = hx + k * p.reach * pxcm * Math.cos(ph), ay = hipy + 85 * pxcm - 12 * pxcm * Math.max(-Math.sin(ph), 0);
      const kx = hx + .5 * (ax - hx) + 10 * pxcm, ky = hipy + 42 * pxcm;
      set(ids[0], hx + p.lean * pxcm, hipy - 50 * pxcm, vis); set(ids[1], hx, hipy, vis); set(ids[2], kx, ky, vis);
      set(ids[3], ax, ay, vis); set(ids[4], ax - 5 * pxcm, ay + 3 * pxcm, vis); set(ids[5], ax + 12 * pxcm, ay + 5 * pxcm, vis);
    });
    set(0, hx + 60, hipy - 170, 1); set(7, hx + 40, hipy - 165, 1); set(8, hx + 40, hipy - 165, 1);
    [[13, 15, 1], [14, 16, -1]].forEach(([e, w, sg]) => {
      const a = 0.5 * Math.sin(2 * Math.PI * sh * t + (sg > 0 ? 0 : Math.PI)), sx = hx + p.lean * pxcm, sy = hipy - 50 * pxcm;
      const ex = sx + 25 * pxcm * Math.sin(a), ey = sy + 25 * pxcm * Math.cos(a);
      set(e, ex, ey, .9); set(w, ex + 20 * pxcm * Math.cos(a) + 8 * pxcm, ey - 10 * pxcm, .9);
    });
    return lm;
  }
  // ảnh chụp tư thế: người que vẽ từ chính các điểm đó, JPEG nửa kích thước (sc = 0.5)
  function photo(lm, sc) {
    const cv = document.createElement('canvas'); cv.width = W * sc; cv.height = H * sc;
    const g = cv.getContext('2d'); g.fillStyle = '#20242b'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#343a44'; g.fillRect(0, cv.height * 0.85, cv.width, cv.height * 0.15);
    g.strokeStyle = '#e8eaed'; g.lineWidth = 8; g.lineCap = 'round'; g.lineJoin = 'round';
    const P = (j) => [lm[j].x * sc, lm[j].y * sc];
    for (const ch of [[11, 23, 25, 27, 31], [12, 24, 26, 28, 32], [11, 13, 15], [12, 14, 16], [11, 12], [23, 24]]) {
      g.beginPath(); ch.forEach((j, i) => { const q = P(j); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke();
    }
    const h = P(0); g.beginPath(); g.arc(h[0], h[1], 20, 0, 7); g.stroke();
    return new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.85));
  }
  // chuỗi khung hình y như lúc đo thật: {t, lm (pixel), vw, vh, blob, sc}
  async function frames(p, secs, fps) {
    const out = [], sc = 0.5;
    for (let i = 0; i < Math.floor(secs * fps); i++) {
      const lm = landmarks(i / fps, p);
      out.push({ t: i / fps, lm, vw: W, vh: H, sc, blob: i % 3 === 0 ? await photo(lm, sc) : null });
    }
    return out;
  }
  return { PEOPLE, frames };
})();
