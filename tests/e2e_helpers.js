// Hàm dùng chung cho result_tv.spec.js, sync.spec.js, data_link.spec.js.
// Mỗi test Playwright chạy trong context mới => localStorage + IndexedDB riêng, không chung state.
//
// ===== TODO selector / hook (fe chưa có trong code lúc viết spec, 05/11/2026) =====
// Sửa đúng một chỗ ở đây khi fe chốt tên.
const TODO = {
  // Nơi hiện trạng thái đồng bộ (vd "Còn 1 kết quả chưa gửi"). TODO: fe sync chưa có phần tử này.
  syncStatus: '#syncstat',
  // Cờ làm sheet giả báo lỗi ở ?mock=1. TODO: fe sync chưa chốt tên cờ.
  mockFailFlag: '__mockSyncFail',
  // Nút tạo dữ liệu mẫu (trước nằm ở màn #/data, màn này sẽ bỏ). TODO: vị trí mới chưa chốt.
  seedBtn: '#seedbtn',
};
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1HbknKhSQ1VpO6J11HzoLZMF1TYDDXtCsnUzV2dYw-0U';

// Ghi lại mọi chữ/ảnh vẽ lên canvas (ảnh kết quả #res là canvas nên không đọc được bằng DOM).
// Bản ghi: { cv: 'res' | 'other', t, px (cỡ chữ), x, y, fill } và ảnh { cv, img:true, dx, dy, dw, dh }.
async function installSpies(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('gait_auto', '0'); } catch (e) { /* bỏ qua */ }   // không chờ nhịp ổn định: đo giả chạy đúng giờ
    window.__draw = []; window.__dl = []; window.__sync = []; window.__savePicker = 0;
    const P = CanvasRenderingContext2D.prototype, tag = (c) => (c.canvas && c.canvas.id === 'res' ? 'res' : 'other');
    const px = (f) => { const m = /(\d+(?:\.\d+)?)px/.exec(f || ''); return m ? +m[1] : 0; };
    const ft = P.fillText;
    P.fillText = function (t, x, y, mw) { window.__draw.push({ cv: tag(this), t: String(t), px: px(this.font), x, y, mw, fill: String(this.fillStyle), align: this.textAlign }); return ft.apply(this, arguments); };
    const fr = P.fillRect;
    P.fillRect = function (x, y, w, h) { if (tag(this) === 'res') window.__draw.push({ cv: 'res', rect: true, x, y, w, h, fill: String(this.fillStyle) }); return fr.apply(this, arguments); };
    const di = P.drawImage;
    P.drawImage = function () {
      const a = arguments, n = a.length, r = n === 9 ? [a[5], a[6], a[7], a[8]] : n === 5 ? [a[1], a[2], a[3], a[4]] : [a[1], a[2], (a[0].width || 0), (a[0].height || 0)];
      window.__draw.push({ cv: tag(this), img: true, dx: r[0], dy: r[1], dw: r[2], dh: r[3] });
      return di.apply(this, arguments);
    };
    // không tự tải file về máy: ghi mọi <a download>.click() và hộp chọn nơi lưu
    const ac = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.hasAttribute('download')) window.__dl.push(this.download); return ac.apply(this, arguments); };
    if (window.showSaveFilePicker) { const sp = window.showSaveFilePicker; window.showSaveFilePicker = function () { window.__savePicker++; return sp.apply(this, arguments); }; }
    // bọc window.Sync.push (docs/sync.js nạp sau script này) để đọc payload
    let S0;
    Object.defineProperty(window, 'Sync', {
      configurable: true,
      get() { return S0; },
      set(v) {
        S0 = v;
        if (v && typeof v.push === 'function' && !v.push.__spy) {
          const p = v.push;
          v.push = function (headers, row, files) {
            window.__sync.push({
              headers: Array.isArray(headers) ? headers.slice() : headers,
              row: Array.isArray(row) ? row.slice() : row,
              files: (files || []).map((f) => ({ name: f && f.name, mime: f && (f.mime || f.type), size: f && (f.b64 ? f.b64.length : f.size || (f.blob && f.blob.size) || 0) })),
            });
            return p.apply(this, arguments);
          };
          v.push.__spy = true;
        }
      },
    });
  });
}

// Mở app ở chế độ giả: camera giả + pose giả + sheet giả. Đo ngắn: thu từ giây 4, phân tích 8 giây.
async function openApp(page, hash = '#/') {
  await page.goto('/index.html?mock=1&total=20&rec=4&clip=8' + hash);
  await page.waitForFunction(() => !document.getElementById('go').textContent.includes('chuẩn bị'), null, { timeout: 30000 });
}

// Đo một người bằng camera giả, chờ tới màn Kết quả.
async function measureOne(page, p = {}) {
  if (!(await page.locator('#L1.show').count())) await page.goto(page.url().replace(/#.*$/, '') + '#/');
  await page.fill('#name', p.name || 'Nguyễn Văn Hùng');
  if (p.height !== '') await page.fill('#height', String(p.height || 172));
  if (p.pain) await page.fill('#pain', p.pain);
  await page.click('#go');
  await page.waitForSelector('#L3.show', { timeout: 120000 });
  await page.waitForFunction(() => /^#\/result\//.test(location.hash));
  return page.evaluate(() => window.__gait.S.result.sub.id);
}

// Vẽ lại ảnh kết quả với dữ liệu hiện tại và trả về đúng các nét của lần vẽ đó.
async function redrawRes(page) {
  return page.evaluate(() => {
    window.__draw = [];
    window.__gait.drawResult(window.__gait.S.result);
    return window.__draw.filter((d) => d.cv === 'res');
  });
}

// Điểm tổng tính lại từ dòng đã lưu (row.score_total) để đối chiếu với số vẽ trên ảnh.
async function lastRow(page) { return page.evaluate(() => { const r = window.__gait.S.rows; return r[r.length - 1]; }); }

async function setMockFail(page, on) {
  await page.evaluate(([k, v]) => { window[k] = v; }, [TODO.mockFailFlag, on]);
}

// Đọc sheet giả thành các dòng { 'Mã': ..., 'Ghi chú': ..., ... }.
// Chấp nhận cả hai dạng window.__mockSheet: mảng object dòng (cũ, pushSheet) hoặc mảng payload {headers, rows, files}.
// Sheet giả phải mô phỏng Sheet thật: cập nhật theo Mã thì __mockSheet chỉ còn MỘT dòng mỗi mã (TODO fe sync: chốt dạng).
async function mockSheetRows(page) {
  return page.evaluate(() => {
    const out = [];
    for (const e of window.__mockSheet || []) {
      if (e && Array.isArray(e.rows) && Array.isArray(e.headers)) {
        for (const r of e.rows) { const o = {}; e.headers.forEach((h, i) => { o[h] = r[i]; }); o.__files = (e.files || []).length; out.push(o); }
      } else if (e && typeof e === 'object') out.push(Object.assign({ 'Mã': e.id, 'Họ tên': e.name, 'Ghi chú': e.note }, e));
    }
    return out;
  });
}
const NOTE_COL = 'Ghi chú';   // TODO: tên cột ghi chú trên Sheet (fe sync chốt)

module.exports = { TODO, SHEET_URL, NOTE_COL, installSpies, openApp, measureOne, redrawRes, lastRow, setMockFail, mockSheetRows };
