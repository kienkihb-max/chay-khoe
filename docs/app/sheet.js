/* app/sheet.js - gửi Google Sheet (sendRow, SHEET_COLS), báo đồng bộ. Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, S, tierOf, setDetail, makePdf } = App;
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { sendRow });
  // Gửi một người lên Google Sheet + Drive (PDF 4 trang + ảnh kết quả). Không lưu gì về máy.
  async function sendRow(row, pdf) {
    try {
      const R = S.result;
      pdf = pdf || (R ? makePdf(R) : null);
      const pngBlob = await new Promise((ok) => $('res').toBlob(ok, 'image/png'));
      const files = [];
      if (pdf) files.push({ name: row.id + '.pdf', mime: 'application/pdf', blob: pdf });
      if (pngBlob) files.push({ name: row.id + '.png', mime: 'image/png', blob: pngBlob });
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

  // ---------- Cột gửi lên Google Sheet ----------
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1HbknKhSQ1VpO6J11HzoLZMF1TYDDXtCsnUzV2dYw-0U/edit';
  // Code.gs tự thêm cột PDF và Ảnh kết quả ở cuối. Mã phải đứng đầu: là khóa ghi đè dòng.
  // Thời gian/Điểm/Kết luận lấy đúng trường như renderList; Hạng theo tierOf(điểm chung) như huy hiệu canvas Kết quả.
  const SHEET_COLS = [
    ['Mã', (r) => r.id], ['Thời gian', (r) => r.time], ['Họ tên', (r) => r.name], ['SĐT/Zalo', (r) => r.phone],
    ['Điểm', (r) => r.score_total], ['Hạng', (r) => (r.score_total === '' || r.score_total == null ? '' : (tierOf(r.score_total) || {}).label || '')],
    ['Điểm trái', (r) => r.score_L], ['Điểm phải', (r) => r.score_R], ['Đau/chấn thương', (r) => r.pain],
    ['Kết luận', (r) => r.conclusion], ['Ghi chú bác sĩ', (r) => r.note],
    ['Cờ tin cậy', (r) => r.flags],
    // điểm riêng từng góc (đo một góc thì góc kia trống) + chỉ số góc sau lưng (ngưỡng tạm); Code.gs ghi theo tên cột nên thêm cuối không lệch dữ liệu cũ
    ['Điểm góc ngang', (r) => r.score_side], ['Điểm góc sau', (r) => r.score_back],
    ['Sụt hông trái (°)', (r) => r.pelvic_drop_L], ['Sụt hông phải (°)', (r) => r.pelvic_drop_R],
    ['Gối đổ vào trái (°)', (r) => r.knee_valgus_L], ['Gối đổ vào phải (°)', (r) => r.knee_valgus_R],
    ['Bàn chân–đường giữa trái (cm)', (r) => r.foot_mid_L], ['Bàn chân–đường giữa phải (cm)', (r) => r.foot_mid_R],
    ['Độ rộng bước (cm)', (r) => r.step_width], ['Thân lắc ngang (°)', (r) => r.lat_trunk],
  ];
})(window.App);
