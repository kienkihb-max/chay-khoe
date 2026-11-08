// Tự nhận góc quay từ khung xương MediaPipe: 'side' (ngang hông) hoặc 'back' (sau lưng); không chắc thì trả null.
// Dùng được trong trình duyệt (window.Angle) và trong node (module.exports).
(function (root) {
  // Ngưỡng (xem E:/claude-agents/reports/20261108-fe-tu-nhan-goc.md): đo trên video thật, giữ khoảng trống ở giữa để không đoán bừa.
  const T = {
    MIN_N: 45,          // cần ít nhất 45 khung đủ vai + hông (~1,5–3 giây)
    VIS: 0.5,           // điểm vai/hông phải có độ tin cậy ≥ 0,5
    SIDE_W: 0.30,       // độ rộng vai+hông / thân < 0,30 → hai vai, hai hông gần chồng nhau → góc bên
    BACK_W: 0.45,       // > 0,45 → thấy rõ bề ngang vai, hông → góc sau (hoặc trước)
    SIDE_A: 0.50,       // góc bên: hai cổ chân tách xa nhau theo chiều ngang khi sải bước (p90 khoảng cách / thân)
    BACK_A: 0.60,       // góc sau: cổ chân không văng xa theo chiều ngang
    FACE: 0.80,         // góc sau không thấy mặt: độ tin cậy trung vị của mũi + hai mắt phải thấp hơn mức này
  };
  const vis = (q) => (q ? (q.v != null ? q.v : q.visibility != null ? q.visibility : 1) : 0);
  // lm: 33 điểm {x, y, v|visibility}; x, y theo pixel (hoặc chuẩn hoá nhưng truyền sx, sy = kích thước khung)
  function feat(lm, sx, sy) {
    if (!lm || lm.length < 29) return null;
    sx = sx || 1; sy = sy || 1;
    for (const i of [11, 12, 23, 24]) if (!lm[i] || vis(lm[i]) < T.VIS) return null;
    const X = (i) => lm[i].x * sx, Y = (i) => lm[i].y * sy;
    const tor = Math.hypot((X(11) + X(12) - X(23) - X(24)) / 2, (Y(11) + Y(12) - Y(23) - Y(24)) / 2);
    if (!(tor > 1e-6)) return null;
    const w = (Math.abs(X(11) - X(12)) + Math.abs(X(23) - X(24))) / 2 / tor;
    const a = vis(lm[27]) >= T.VIS && vis(lm[28]) >= T.VIS ? Math.abs(X(27) - X(28)) / tor : NaN;
    const f = (vis(lm[0]) + vis(lm[2]) + vis(lm[5])) / 3;
    return { w, a, f };
  }
  const q = (arr, p) => { const s = arr.filter((v) => Number.isFinite(v)).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))] : NaN; };
  // fs: mảng kết quả feat (bỏ qua null). Trả { angle: 'side'|'back'|null, why, n, w, a, f }
  function decide(fs) {
    const ok = fs.filter(Boolean), n = ok.length;
    const w = q(ok.map((o) => o.w), 0.5), a = q(ok.map((o) => o.a), 0.9), f = q(ok.map((o) => o.f), 0.5);
    const out = { angle: null, why: '', n, w, a, f };
    if (n < T.MIN_N) { out.why = 'chưa đủ khung thấy rõ vai và hông'; return out; }
    if (w < T.SIDE_W && a > T.SIDE_A) { out.angle = 'side'; return out; }
    if (w > T.BACK_W && a < T.BACK_A && f < T.FACE) { out.angle = 'back'; return out; }
    out.why = !Number.isFinite(a) ? 'không thấy rõ hai cổ chân' : w < T.SIDE_W ? 'hai chân chưa sải bước rõ' : w > T.BACK_W && f >= T.FACE ? 'có vẻ quay trước mặt' : 'góc quay chéo, không rõ ngang hông hay sau lưng';
    return out;
  }
  const api = { T, feat, decide };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Angle = api;
})(typeof window !== 'undefined' ? window : this);
