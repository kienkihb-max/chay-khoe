// Họ tên không còn bắt buộc (app.js: name = titleCase(ô tên) || 'Khách ' + Mã). Viết 07/11/2026, CHƯA CHẠY.
// Nguồn: yêu cầu master 07/11/2026; ca biên theo quy tắc qc (gõ dở, chỉ dấu cách, tên dài).
const { test, expect } = require('@playwright/test');
const H = require('./e2e_helpers');

test.describe('Họ tên không bắt buộc', () => {
  test.beforeEach(async ({ page }) => { await H.installSpies(page); await H.openApp(page); });

  test('NM-AC1 để trống tên: nút "Bắt đầu đo" vẫn bấm được, không báo đỏ ô tên', async ({ page }) => {
    await expect(page.locator('#name')).toHaveValue('');
    await expect(page.locator('#go')).toBeEnabled();
    await page.fill('#height', '170');
    const inv = await page.locator('#name').evaluate((e) => e.getAttribute('aria-invalid'));
    expect(inv).not.toBe('true');
    await page.click('#go');
    await expect(page.locator('#rvok')).toBeVisible({ timeout: 120000 });   // vào được màn xem lại = đã bắt đầu đo
    await expect(page.locator('#msg1')).not.toContainText(/họ tên|nhập tên/i);
  });

  test.skip('NM-AC2 để trống tên: đo xong, bản ghi tên "Khách <Mã>" ở màn Kết quả và Danh sách' + ' [skip: đã ẩn theo yêu cầu 8/11]', async ({ page }) => {
    const id = await H.measureOne(page, { name: '' });
    expect(await page.evaluate(() => window.__gait.S.result.sub.name)).toBe('Khách ' + id);
    await page.click('#tolist');
    await expect(page.locator('#L4')).toHaveClass(/show/);
    const tr = page.locator('tr[data-id="' + id + '"]');
    await expect(tr).toBeVisible();
    await expect(tr.locator('td').nth(2)).toHaveText('Khách ' + id);
  });

  test('NM-AC3 để trống tên: cột Họ tên của sheet giả = "Khách <Mã>"', async ({ page }) => {
    const id = await H.measureOne(page, { name: '' });
    await expect.poll(async () => (await H.mockSheetRows(page)).filter((r) => r['Mã'] === id).map((r) => r['Họ tên'])).toEqual(['Khách ' + id]);
  });

  test('NM-CC1 bổ sung: tên chỉ có dấu cách coi như trống (Khách <Mã>)', async ({ page }) => {
    const id = await H.measureOne(page, { name: '   ' });
    expect(await page.evaluate(() => window.__gait.S.result.sub.name)).toBe('Khách ' + id);
  });

  test('NM-CC2 bổ sung: có nhập tên thì giữ tên (không thành Khách), viết hoa chữ đầu mỗi từ', async ({ page }) => {
    const id = await H.measureOne(page, { name: 'lê quốc bảo' });
    const name = await page.evaluate(() => window.__gait.S.result.sub.name);
    expect(name).toBe('Lê Quốc Bảo');
    expect(name).not.toContain('Khách');
    expect(id).toBeTruthy();
  });

  test.skip('NM-CC3 bổ sung: hai người cùng để trống tên có hai Mã khác nhau, hai dòng Danh sách' + ' [skip: đã ẩn theo yêu cầu 8/11]', async ({ page }) => {
    const a = await H.measureOne(page, { name: '' });
    await H.newMeasure(page);
    const b = await H.measureOne(page, { name: '' });
    expect(a).not.toBe(b);
    await page.click('#tolist');
    await expect(page.locator('tr[data-id]')).toHaveCount(2);
    await expect(page.locator('tr[data-id="' + a + '"] td').nth(2)).toHaveText('Khách ' + a);
    await expect(page.locator('tr[data-id="' + b + '"] td').nth(2)).toHaveText('Khách ' + b);
  });

  test('NM-CC4 bổ sung: ô tên không có dấu * / chữ "bắt buộc" trên nhãn', async ({ page }) => {
    const lab = await page.locator('label[for="name"]').innerText();
    expect(lab).not.toMatch(/\*|bắt buộc/i);
  });

  test.skip('NM-CC5 bổ sung: Danh sách tìm "Khách" ra người không tên' + ' [skip: đã ẩn theo yêu cầu 8/11]', async ({ page }) => {
    const id = await H.measureOne(page, { name: '' });
    await page.click('#tolist');
    await page.fill('#listq', 'Khách');
    await expect(page.locator('tr[data-id="' + id + '"]')).toBeVisible();
  });
});
