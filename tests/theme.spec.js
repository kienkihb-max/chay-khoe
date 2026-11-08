// Giao diện (docs/themes.js): nút "Giao diện" trên #topnav, đổi tức thì, nhớ lựa chọn, font chỉ nạp khi chọn giao diện Đỏ.
const { test, expect } = require('@playwright/test');

const moss = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--moss').trim().toUpperCase());
const pick = async (page, id) => { await page.click('#themebtn'); await page.click('#thememenu button[data-theme="' + id + '"]'); };
test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
});

for (const url of ['/index.html?mock=1', '/demo.html']) {
  test('TH-1 ' + url + ': mặc định Xanh, đổi sang Đỏ tức thì và nhớ sau khi tải lại', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('#topnav #themebtn')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'xanh');
    expect(await moss(page)).toBe('#1F4D2B');
    await expect(page.locator('#themefont-do')).toHaveCount(0);        // font chưa nạp khi dùng Xanh
    await pick(page, 'do');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'do');
    expect(await moss(page)).toBe('#D4161C');
    await expect(page.locator('#themefont-do')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'do');
    expect(await moss(page)).toBe('#D4161C');
    await pick(page, 'xanh');
    expect(await moss(page)).toBe('#1F4D2B');
  });
}

test('TH-2 nhãn không chứa tên thương hiệu', async ({ page }) => {
  await page.goto('/index.html?mock=1');
  await page.click('#themebtn');
  const t = (await page.locator('#thememenu').innerText()).toLowerCase();
  expect(t).not.toMatch(/techcombank|marathon|hanoi|savita/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#thememenu')).toBeHidden();
});

test('TH-3 localStorage bị chặn: trang vẫn chạy, đổi giao diện vẫn được', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  await page.goto('/index.html?mock=1');
  await pick(page, 'do');
  expect(await moss(page)).toBe('#D4161C');
});
