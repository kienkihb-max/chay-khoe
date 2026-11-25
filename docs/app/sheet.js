/* app/sheet.js - gửi Google Sheet (sendRow, SHEET_COLS), báo đồng bộ. Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, S, tierOf, setDetail, makePdf } = App;
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { sendRow, shortResult });
  // Gửi một người lên Google Sheet + Drive (PDF 4 trang + ảnh kết quả). Không lưu gì về máy.
  async function sendRow(row, pdf) {
    try {
      const R = S.result;
      pdf = pdf || (R ? makePdf(R) : null);
      const files = [];   // chỉ gửi PDF (bác sĩ Kiên 25/11/2026: sheet chỉ cần tên, SĐT, thời gian, kết quả rút gọn, PDF)
      if (pdf) files.push({ name: pdfName(row), mime: 'application/pdf', blob: pdf });
      const p = Sync.push(SHEET_COLS.map((c) => c[0]), SHEET_COLS.map((c) => c[1](row) ?? ''), files);
      showSync(); await p;
    } catch (e) { console.warn('Chưa gửi được lên Google Sheet:', e); }
    showSync();
    return Sync.pending() > 0 ? 'Chờ gửi' : 'Đã gửi';
  }
  function showSync() {
    const n = Sync.pending(), e = $('syncst');
    e.style.display = n ? '' : 'none';
    e.textContent = n ? 'Chưa gửi ' + n + ' người · tự gửi lại' : '';
  }
  setInterval(showSync, 3000);
  $('tgdetail').addEventListener('click', () => setDetail($('detail').style.display !== 'block'));

  // ---------- Cột gửi lên Google Sheet (bác sĩ Kiên 25/11/2026: chỉ tên, SĐT, thời gian scan, kết quả rút gọn, PDF) ----------
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1HbknKhSQ1VpO6J11HzoLZMF1TYDDXtCsnUzV2dYw-0U/edit';   // eslint-disable-line no-unused-vars
  // Code.gs ghi vào tab "Kết quả" theo đúng thứ tự cột cố định, cột PDF (link Drive) do Code.gs tự điền. Mã (cuối) là khoá ghi đè dòng.
  const SHEET_COLS = [
    ['Họ tên', (r) => r.name], ['SĐT/Zalo', (r) => r.phone], ['Thời gian scan', (r) => r.time],
    ['Kết quả rút gọn', (r) => r.short || r.conclusion], ['Mã', (r) => r.id],
  ];
  // Tên file PDF trên Drive = tên khách như gõ ở bảng thông tin + ngày đo (bác sĩ Kiên 25/11/2026), vd "Hồ Phương 25-11-2026.pdf".
  // Bỏ ký tự không hợp lệ trong tên file. Trùng tên không sao: Code.gs thay file theo Mã khách, không theo tên.
  function pdfName(row) {
    const nm = String(row.name || ('Khách ' + row.id)).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(row.time || '');
    return nm + (m ? ' ' + m[1] + '-' + m[2] + '-' + m[3] : '') + '.pdf';
  }
  // Kết quả rút gọn: điểm + hạng, rồi câu tóm tắt (rvSummary: số chỉ số trong khoảng tham chiếu, chỉ số cần chú ý). Góc sau lưng: kết luận cũ.
  function shortResult(R, row) {
    const sc = row && row.score_total !== '' && row.score_total != null ? row.score_total : null;
    const t = sc != null ? tierOf(sc) || {} : {}, tn = (App.RV_BADGE && App.RV_BADGE[t.key]) || t.name || t.label || '';
    const head = sc != null ? 'Điểm ' + sc + '/100' + (tn ? ' (' + tn + ')' : '') + '. ' : '';
    const sum = R && R.comb && R.res && App.rvSummary ? App.rvSummary(R) : (row && row.conclusion) || '';
    const warn = App.poorFrameWarn ? App.poorFrameWarn(R) : '';
    return (head + sum + (warn ? ' Lưu ý: ' + warn : '')).trim();
  }
})(window.App);
