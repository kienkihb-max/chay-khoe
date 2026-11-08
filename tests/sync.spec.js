// Đồng bộ Sheet/Drive qua docs/sync.js (fe sync đang viết). API dự kiến: window.Sync.push(headers,row,files), pending(), flush().
// Lời người dùng: "ko tự động lưu dữ liệu về máy, mọi dữ liệu đẩy hết lên google drive".
// Kiểm ở ?mock=1: sheet giả window.__mockSheet. Cờ lỗi giả CHƯA có trong docs/sync.js => các ca cần lỗi mạng đang test.fixme (xem e2e_helpers.TODO.mockFailFlag).
// Cập nhật 07/11/2026: Sheet 11 cột (SHEET_COLS), ghi chú qua drawer, nav 'Đo mới' thay '#next'.
const { test, expect } = require('@playwright/test');
const H = require('./e2e_helpers');

const pending = (page) => page.evaluate(async () => { const p = await window.Sync.pending(); return Array.isArray(p) ? p.length : +p; });
const flush = (page) => page.evaluate(async () => { await window.Sync.flush(); });
const idsOnSheet = async (page) => (await H.mockSheetRows(page)).map((r) => r['Mã']);

test.describe('Đồng bộ Sheet/Drive (?mock=1)', () => {
  test.beforeEach(async ({ page }) => {
    await H.installSpies(page);
    await H.openApp(page);
  });

  test('S-AC0 có module Sync với push/pending/flush', async ({ page }) => {
    const t = await page.evaluate(() => window.Sync && ['push', 'pending', 'flush'].map((k) => typeof window.Sync[k]));
    expect(t).toEqual(['function', 'function', 'function']);
  });

  test('S-AC1 đo xong: đẩy đúng 1 lần, payload có headers, row khớp headers, files có PDF + ảnh PNG', async ({ page }) => {
    const id = await H.measureOne(page, { name: 'Lê Quốc Bảo', height: 180 });
    await expect.poll(() => page.evaluate(() => window.__sync.length)).toBe(1);
    const p = (await page.evaluate(() => window.__sync))[0];
    expect(Array.isArray(p.headers) && p.headers.length).toBe(11);
    expect(p.headers, '11 cột đúng thứ tự SHEET_COLS').toEqual(H.SHEET_HEADERS);
    expect(p.headers, 'cột Điểm chung (/100) đã bỏ').not.toContain('Điểm chung (/100)');
    for (const h of ['Mã', 'Họ tên', 'Điểm', 'Hạng', H.NOTE_COL]) expect(p.headers, 'cột ' + h).toContain(h);
    expect(p.row.length, 'row dài bằng headers').toBe(p.headers.length);
    expect(p.row[p.headers.indexOf('Mã')]).toBe(id);
    expect(p.row[p.headers.indexOf('Họ tên')]).toBe('Lê Quốc Bảo');
    const pdf = p.files.find((f) => /pdf/i.test(f.mime || '')), png = p.files.find((f) => /image\/png/i.test(f.mime || ''));
    expect(pdf, 'file PDF').toBeTruthy(); expect(png, 'file ảnh PNG').toBeTruthy();
    expect(pdf.size).toBeGreaterThan(1000); expect(png.size).toBeGreaterThan(1000);
    expect(pdf.name, 'tên file có mã người').toContain(id);
    // sheet giả nhận đúng 1 dòng
    await expect.poll(() => idsOnSheet(page)).toEqual([id]);
    expect(await pending(page)).toBe(0);
  });

  test.skip('S-AC2 không tự tải file nào về máy (PDF, ảnh, Excel, video)' + ' [skip: đã ẩn theo yêu cầu 8/11]', async ({ page }) => {
    let dl = 0; page.on('download', () => { dl++; });
    const id = await H.measureOne(page);
    await H.setNote(page, 'kiểm tải');   // cập nhật ghi chú (drawer + Lưu) cũng không tải
    await expect.poll(async () => (await H.mockSheetRows(page)).filter((r) => r['Mã'] === id).map((r) => r[H.NOTE_COL])).toEqual(['kiểm tải']);
    await page.waitForTimeout(1500);
    expect(dl, 'sự kiện download').toBe(0);
    expect(await page.evaluate(() => window.__dl), 'thẻ <a download> bị bấm').toEqual([]);
    expect(await page.evaluate(() => window.__savePicker), 'hộp chọn nơi lưu').toBe(0);
  });

  test.fixme('S-AC3 [chờ cờ lỗi giả trong sync.js] lỗi mạng: xếp hàng, không mất dữ liệu; hết lỗi thì flush gửi lại đúng 1 dòng', async ({ page }) => {
    await H.setMockFail(page, true);
    const id = await H.measureOne(page);
    await expect.poll(() => pending(page)).toBeGreaterThanOrEqual(1);
    expect(await idsOnSheet(page)).toEqual([]);
    // TODO selector: chỗ báo "còn N kết quả chưa gửi" (H.TODO.syncStatus)
    await expect(page.locator(H.TODO.syncStatus)).toContainText(/chưa gửi|đang chờ|1/i);
    await H.setMockFail(page, false);
    await flush(page);
    await expect.poll(() => pending(page)).toBe(0);
    expect(await idsOnSheet(page)).toEqual([id]);
    // kết quả vẫn mở lại được trong máy (không mất)
    await page.click('#tolist');
    await expect(page.locator('tr[data-id="' + id + '"]')).toBeVisible();
  });

  test.fixme('S-CC1 bổ sung [chờ cờ lỗi giả trong sync.js]: hàng chờ còn sau khi tải lại trang, rồi gửi được', async ({ page }) => {
    await H.setMockFail(page, true);
    const id = await H.measureOne(page);
    await expect.poll(() => pending(page)).toBeGreaterThanOrEqual(1);
    await page.reload();
    await page.waitForFunction(() => window.Sync);
    expect(await pending(page), 'hàng chờ giữ qua tải lại').toBeGreaterThanOrEqual(1);
    await flush(page);   // sau reload cờ lỗi đã mất => sheet giả nhận
    await expect.poll(() => pending(page)).toBe(0);
    expect(await idsOnSheet(page)).toEqual([id]);
  });

  test.fixme('S-CC2 bổ sung [chờ cờ lỗi giả trong sync.js]: lỗi liên tiếp 2 người, gửi lại giữ đúng thứ tự, không trùng', async ({ page }) => {
    await H.setMockFail(page, true);
    const a = await H.measureOne(page, { name: 'Người A' });
    await H.newMeasure(page);
    const b = await H.measureOne(page, { name: 'Người B' });
    await expect.poll(() => pending(page)).toBeGreaterThanOrEqual(2);
    await H.setMockFail(page, false);
    await flush(page);
    await expect.poll(() => pending(page)).toBe(0);
    expect(await idsOnSheet(page)).toEqual([a, b]);
  });

  test.fixme('S-CC3 bổ sung [chờ cờ lỗi giả trong sync.js]: bấm flush hai lần cùng lúc không gửi trùng', async ({ page }) => {
    await H.setMockFail(page, true);
    const id = await H.measureOne(page);
    await expect.poll(() => pending(page)).toBeGreaterThanOrEqual(1);
    await H.setMockFail(page, false);
    await page.evaluate(() => Promise.all([window.Sync.flush(), window.Sync.flush()]));
    await expect.poll(() => pending(page)).toBe(0);
    expect(await idsOnSheet(page)).toEqual([id]);
  });

  test.fixme('S-CC4 bổ sung [chờ cờ lỗi giả trong sync.js]: có mạng lại (sự kiện online) thì tự gửi, không cần bấm', async ({ page, context }) => {
    await H.setMockFail(page, true);
    const id = await H.measureOne(page);
    await expect.poll(() => pending(page)).toBeGreaterThanOrEqual(1);
    await H.setMockFail(page, false);
    await context.setOffline(true); await context.setOffline(false);   // phát offline -> online
    await expect.poll(() => pending(page), { timeout: 15000 }).toBe(0);
    expect(await idsOnSheet(page)).toEqual([id]);
  });

  test.fixme('S-CC5 bổ sung [chờ cờ lỗi giả trong sync.js]: ghi chú cập nhật khi đang lỗi thì xếp hàng; gửi lại vẫn 1 dòng, ghi chú mới nhất', async ({ page }) => {
    const id = await H.measureOne(page);
    await expect.poll(() => idsOnSheet(page)).toEqual([id]);
    await H.setMockFail(page, true);
    await H.setNote(page, 'lần 1');
    await H.setNote(page, 'lần 2');
    await expect.poll(() => pending(page)).toBeGreaterThanOrEqual(1);
    await H.setMockFail(page, false);
    await flush(page);
    await expect.poll(() => pending(page)).toBe(0);
    const rows = (await H.mockSheetRows(page)).filter((r) => r['Mã'] === id);
    expect(rows.map((r) => r[H.NOTE_COL])).toEqual(['lần 2']);
  });

  test('S-CC6 bổ sung: tạo dữ liệu mẫu (?mock=1, window.__seed()) không đẩy lên Sheet/Drive', async ({ page }) => {
    test.setTimeout(240000);
    await H.seed(page);
    expect(await page.evaluate(() => window.__gait.S.rows.length)).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__sync.length)).toBe(0);
    expect(await idsOnSheet(page)).toEqual([]);
  });

  test('S-CC7 bổ sung: để trống họ tên, dòng đẩy lên Sheet có Họ tên = "Khách <Mã>"', async ({ page }) => {
    const id = await H.measureOne(page, { name: '' });
    await expect.poll(async () => (await H.mockSheetRows(page)).filter((r) => r['Mã'] === id).map((r) => r['Họ tên'])).toEqual(['Khách ' + id]);
  });
});
