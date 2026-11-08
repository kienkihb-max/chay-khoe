// Giao diện (docs/themes.js): hiện chỉ còn giao diện Xanh lá (Linh 08/11/2026 bỏ giao diện Đỏ).
// Chỉ một giao diện thì không hiện nút "Giao diện"; lựa chọn cũ không còn (vd 'do') phải quay về Xanh.
const { test, expect } = require('@playwright/test');

for (const url of ['/screening.html?mock=1', '/index.html']) {
  test('TH-1 ' + url + ': chỉ một giao diện, không có nút Giao diện, data-theme=xanh', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'xanh');
    await expect(page.locator('#themebtn')).toHaveCount(0);
  });
  test('TH-2 ' + url + ': lựa chọn cũ "do" trong localStorage quay về Xanh', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('ck_theme', 'do'); } catch (e) {} });
    await page.goto(url);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'xanh');
  });
}
