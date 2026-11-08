// Tab Demo (docs/demo.html) + thương hiệu "Chạy bộ cùng Bác sĩ Kiên". Viết 07/11/2026, CHƯA CHẠY.
// Nguồn: yêu cầu master 07/11/2026 (nút #demolink trên #topnav mở demo.html; demo.html 6 phần, 3 ảnh mẫu, nút "Đăng ký đo thử" về index.html#/, không nạp MediaPipe).
const { test, expect } = require('@playwright/test');
const H = require('./e2e_helpers');

const MP = /vendor\/pose|mediapipe|pose\.js|\.wasm|\.tflite|pose_landmark/i;

test.describe('Thương hiệu Chạy bộ cùng Bác sĩ Kiên', () => {
  test('BR-1 index: tiêu đề tab, chữ thương hiệu, không ảnh logo', async ({ page }) => {
    await page.goto('/index.html?mock=1');
    await expect(page).toHaveTitle('Chạy bộ cùng Bác sĩ Kiên');
    await expect(page.locator('#topnav .logo b')).toHaveText('Chạy bộ cùng Bác sĩ Kiên');
    await expect(page.locator('#topnav .logo img')).toHaveCount(0);   // đã bỏ ảnh logo
  });
  test('BR-2 demo.html: cùng tiêu đề + chữ, không ảnh logo', async ({ page }) => {
    await page.goto('/demo.html');
    await expect(page).toHaveTitle(/Chạy bộ cùng Bác sĩ Kiên/);
    await expect(page.locator('#topnav .logo b')).toHaveText('Chạy bộ cùng Bác sĩ Kiên');
    await expect(page.locator('#topnav .logo img')).toHaveCount(0);   // đã bỏ ảnh logo
  });
});

test.describe('Tab Demo', () => {
  test('DM-AC1 index: nút Demo (#demolink) nằm trên #topnav, bấm mở demo.html trong cùng tab', async ({ page }) => {
    await page.goto('/index.html?mock=1');
    const b = page.locator('#topnav #demolink');
    await expect(b).toBeVisible();
    await expect(b).toHaveText('Demo');
    await b.click();
    await page.waitForURL(/\/demo\.html/);
    await expect(page.locator('h1')).toContainText('Đánh giá dáng chạy bằng AI');
  });

  test('DM-AC1b bổ sung: nút Demo cũng bấm được ở màn Danh sách và nằm cùng hàng nav (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html?mock=1#/list');
    const nav = await page.locator('#topnav').boundingBox(), b = await page.locator('#demolink').boundingBox();
    expect(b.x + b.width).toBeLessThanOrEqual(1440);
    expect(b.y + b.height, 'không xuống dòng').toBeLessThanOrEqual(nav.y + nav.height + 1);
    await page.locator('#demolink').click();
    await page.waitForURL(/\/demo\.html/);
  });

  test('DM-AC2 demo.html có đủ 6 phần: hero, 3 bước, App đo gì, Kết quả mẫu, Câu hỏi thường gặp, chân trang CTA', async ({ page }) => {
    await page.goto('/demo.html');
    await expect(page.locator('header.hero h1')).toBeVisible();
    const h2 = await page.locator('main section h2').allInnerTexts();
    expect(h2).toEqual(['Quy trình 3 bước', 'App đo những gì', 'Kết quả mẫu', 'Câu hỏi thường gặp']);
    await expect(page.locator('footer.cta')).toBeVisible();
    expect(await page.locator('header.hero, main section, footer.cta').count(), 'tổng số phần').toBe(6);
    await expect(page.locator('.steps .step')).toHaveCount(3);
    await expect(page.locator('.cards .card')).toHaveCount(6);
    await expect(page.locator('details')).toHaveCount(3);
  });

  test('DM-AC3 3 ảnh mẫu tải được (naturalWidth > 0), có alt', async ({ page }) => {
    await page.goto('/demo.html');
    const imgs = page.locator('.samples img');
    await expect(imgs).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const im = imgs.nth(i);
      await im.scrollIntoViewIfNeeded();   // loading=lazy
      await expect.poll(() => im.evaluate((e) => e.complete && e.naturalWidth > 0), { message: 'ảnh mẫu ' + (i + 1) }).toBeTruthy();
      expect((await im.getAttribute('alt')) || '').not.toBe('');
    }
  });

  test('DM-AC4 nút "Đăng ký đo thử" về index.html#/ và hiện màn Đo mới', async ({ page }) => {
    await page.goto('/demo.html');
    const cta = page.getByRole('link', { name: 'Đăng ký đo thử' });
    await expect(cta).toBeVisible();
    expect(await cta.getAttribute('href')).toBe('index.html#/');
    await cta.click();
    await page.waitForURL(/\/index\.html#\/$/);
    await expect(page.locator('#L1')).toHaveClass(/show/);
  });

  test('DM-AC5 demo.html không nạp MediaPipe (không script/request pose, wasm, tflite)', async ({ page }) => {
    const reqs = [];
    page.on('request', (r) => { if (MP.test(r.url())) reqs.push(r.url()); });
    await page.goto('/demo.html');
    await page.waitForLoadState('networkidle');
    for (const i of await page.locator('.samples img').all()) await i.scrollIntoViewIfNeeded();
    await page.waitForLoadState('networkidle');
    expect(reqs, 'request liên quan MediaPipe').toEqual([]);
    const srcs = await page.locator('script[src]').evaluateAll((a) => a.map((s) => s.src));
    expect(srcs.filter((s) => MP.test(s))).toEqual([]);
    expect(await page.evaluate(() => typeof window.Pose + typeof window.__gait)).toBe('undefinedundefined');
  });

  test('DM-CC1 bổ sung: nav trên demo.html: Demo đang chọn (aria-current), Đo mới / Danh sách đi về index.html', async ({ page }) => {
    await page.goto('/demo.html');
    await expect(page.locator('#topnav a[aria-current="page"]')).toContainText('Demo');
    expect(await page.getByRole('link', { name: 'Đo mới' }).getAttribute('href')).toBe('index.html#/');
    expect(await page.getByRole('link', { name: /Danh sách/ }).getAttribute('href')).toBe('index.html#/list');
    await page.getByRole('link', { name: /Danh sách/ }).click();
    await page.waitForURL(/\/index\.html#\/list/);
    await expect(page.locator('#L4')).toHaveClass(/show/);
  });

  test('DM-CC2 bổ sung: ở 1440px không tràn ngang, không lỗi trang; nút Quay lại trình duyệt về index', async ({ page }) => {
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html?mock=1');
    await page.click('#demolink');
    await page.waitForURL(/\/demo\.html/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'không cuộn ngang').toBeTruthy();
    await page.goBack();
    await expect(page.locator('#topnav')).toBeVisible();
    expect(errs).toEqual([]);
  });

  test('DM-CC3 bổ sung: mở demo.html rồi bấm Đăng ký đo thử, form Đo mới dùng được (nhập tên)', async ({ page }) => {
    await page.goto('/demo.html');
    await page.getByRole('link', { name: 'Đăng ký đo thử' }).click();
    await page.waitForURL(/\/index\.html#\/$/);
    await page.fill('#name', 'Thử');
    await expect(page.locator('#name')).toHaveValue('Thử');
  });
});
