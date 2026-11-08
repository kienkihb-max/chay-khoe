// Hàm dùng chung cho result_tv.spec.js, sync.spec.js, data_link.spec.js.
// Mỗi test Playwright chạy trong context mới => localStorage + IndexedDB riêng, không chung state.
//
// ===== Selector / hook (cập nhật 07/11/2026 theo giao diện mới) =====
// Sửa đúng một chỗ ở đây khi giao diện đổi.
const TODO = {
  syncStatus: '#syncst',                 // chỗ báo "còn N kết quả chưa gửi" (app.js đặt chữ khi Sync.pending() > 0)
  // TODO: cờ làm sheet giả báo lỗi CHƯA có trong docs/sync.js (send() ở ?mock=1 luôn thành công). Các ca cần lỗi mạng để test.fixme tới khi có cờ.
  mockFailFlag: '__mockSyncFail',
};
// 11 cột Sheet = SHEET_COLS trong docs/app.js (Code.gs tự thêm cột PDF + Ảnh kết quả ở cuối)
const SHEET_HEADERS = ['Mã', 'Thời gian', 'Họ tên', 'SĐT/Zalo', 'Điểm', 'Hạng', 'Điểm trái', 'Điểm phải', 'Đau/chấn thương', 'Kết luận', 'Ghi chú bác sĩ'];
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
  await page.goto('/screening.html?mock=1&total=20&rec=4&clip=8' + hash);
  await page.waitForFunction(() => !document.getElementById('go').textContent.includes('chuẩn bị'), null, { timeout: 30000 });
}

// Đo một người bằng camera giả, chờ tới màn Kết quả.
// Luồng mới: Bắt đầu đo -> màn xem lại (#rvok "Chốt góc này") -> #done "Quay xong" -> Kết quả. Mặc định góc đang chọn sẵn (không viết ca chọn góc Ngang/Sau lưng).
// p.name === '' => để trống tên (họ tên không còn bắt buộc, app đặt "Khách <Mã>").
async function measureOne(page, p = {}) {
  if (!(await page.locator('#L1.show').count())) await page.goto(page.url().replace(/#.*$/, '') + '#/');
  const name = p.name === undefined ? 'Nguyễn Văn Hùng' : p.name;
  await page.fill('#name', name);
  if (p.height !== '') await page.fill('#height', String(p.height || 172));
  if (p.pain) await page.fill('#pain', p.pain);
  await page.click('#go');
  await page.locator('#rvok').waitFor({ state: 'visible', timeout: 120000 });
  await page.click('#rvok');
  await page.waitForFunction(() => !document.getElementById('done').disabled, null, { timeout: 30000 });
  await page.click('#done');
  await page.waitForSelector('#L3.show', { timeout: 60000 });
  await page.waitForFunction(() => location.hash.startsWith('#/result/') || /^#\/result\//.test(location.hash));
  return page.evaluate(() => window.__gait.S.result.sub.id);
}

// Ghi chú bác sĩ: nút #notebtn mở drawer #notedrawer; gõ ở #notetxt; "Lưu" (#notesave) mới ghi. #note chỉ là input ẩn giữ bản đã lưu.
async function openNoteDrawer(page) { await page.click('#notebtn'); await page.waitForSelector('#notedrawer.open'); }
async function setNote(page, text) {
  await openNoteDrawer(page);
  await page.fill('#notetxt', text);
  await page.click('#notesave');
  await page.waitForFunction(() => !document.getElementById('notedrawer').classList.contains('open'), null, { timeout: 15000 });
}
// Bản ghi ghi chú đã lưu (input ẩn #note)
const savedNote = (page) => page.locator('#note').inputValue();
// Về màn Đo mới bằng nút "Đo mới" trên #topnav (ở màn Kết quả thì xoá form người trước)
async function newMeasure(page) { await page.click('#topnav button[data-nav="#/"]'); await page.waitForSelector('#L1.show'); }

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

// Đọc sheet giả thành các dòng { 'Mã': ..., 'Ghi chú bác sĩ': ..., ... }.
// docs/sync.js ở ?mock=1 nối thêm MẢNG GIÁ TRỊ (it.row, 11 cột theo SHEET_HEADERS) vào window.__mockSheet; không giữ headers và không ghi đè theo Mã.
// Sheet thật (Code.gs) ghi đè dòng theo Mã => ở đây lấy dòng CUỐI của mỗi Mã (giữ thứ tự xuất hiện lần đầu) để mô phỏng. Nhận cả dạng object/payload.
async function mockSheetRows(page) {
  const raw = await page.evaluate(() => (window.__mockSheet || []).map((e) => (Array.isArray(e) ? { arr: e } : { obj: e })));
  const by = new Map();
  for (const e of raw) {
    let o;
    if (e.arr) { o = {}; SHEET_HEADERS.forEach((h, i) => { o[h] = e.arr[i]; }); }
    else o = Object.assign({ 'Mã': e.obj.id }, e.obj);
    by.set(o['Mã'], o);   // Map giữ vị trí lần đầu, giá trị lần cuối
  }
  return [...by.values()];
}
// Số lần sheet giả nhận (chưa gộp theo Mã) - để kiểm "không đẩy thừa"
const mockSheetCount = (page) => page.evaluate(() => (window.__mockSheet || []).length);
const NOTE_COL = 'Ghi chú bác sĩ';

// Tạo dữ liệu mẫu bằng hook console (nút #seedbtn đã bỏ)
const seed = (page) => page.evaluate(() => window.__seed());

module.exports = { TODO, SHEET_URL, SHEET_HEADERS, NOTE_COL, installSpies, openApp, measureOne, openNoteDrawer, setNote, savedNote, newMeasure, redrawRes, lastRow, setMockFail, mockSheetRows, mockSheetCount, seed };
