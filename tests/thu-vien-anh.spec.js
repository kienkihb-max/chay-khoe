const { test, expect } = require('@playwright/test');
const URL = 'http://localhost:8099/thu-vien-anh/';

test.describe('Thư viện ảnh', () => {
  test('lưới 19 ảnh, lightbox mở/đóng', async ({ page }) => {
    await page.goto(URL);
    const imgs = page.locator('#grid img');
    await expect(imgs).toHaveCount(19);
    await expect(page.locator('#grid')).not.toContainText(/\S/);
    await imgs.first().click();
    await expect(page.locator('#lb')).toHaveClass(/open/);
    const s1 = await page.locator('#lb img').getAttribute('src');
    await page.keyboard.press('ArrowRight');
    expect(await page.locator('#lb img').getAttribute('src')).not.toBe(s1);
    await page.keyboard.press('Escape');
    await expect(page.locator('#lb')).not.toHaveClass(/open/);
  });
  test('375px không cuộn ngang', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(URL);
    await expect(page.locator('#grid img')).toHaveCount(19);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
