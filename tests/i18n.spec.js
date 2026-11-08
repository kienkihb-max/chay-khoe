// Chuyển ngôn ngữ VI | EN (docs/i18n.js). Lời người dùng: "Thêm lựa chọn tiếng Anh và tiếng Việt EN/VI".
// Mặc định VI; chọn EN đổi chữ ngay không tải lại; nhớ lựa chọn; dữ liệu/cột Sheet giữ tiếng Việt; ảnh kết quả theo ngôn ngữ.
// Ảnh để NHÌN: đặt SHOT_DIR=<scratchpad> (không lưu trong repo).
const { test, expect } = require('@playwright/test');
const path = require('path');
const H = require('./e2e_helpers');

const VI = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;
const shot = async (loc, name) => { if (process.env.SHOT_DIR) await loc.screenshot({ path: path.join(process.env.SHOT_DIR, name + '.png') }); };

test.describe('Đổi ngôn ngữ EN/VI', () => {
  test('L-1 mặc định VI, bấm EN đổi chữ ngay (không tải lại), bấm VI trả đúng chữ gốc', async ({ page }) => {
    await page.goto('/index.html?mock=1');
    await expect(page.locator('#langsw [data-lang="vi"]')).toHaveClass(/on/);
    await expect(page.locator('#topnav .logo b')).toHaveText('Hanoi Running Lab');
    const before = await page.locator('#L1').innerText();
    await page.evaluate(() => { window.__marker = 1; });
    await page.click('#langsw [data-lang="en"]');
    await expect(page.locator('#topnav .logo b')).toHaveText('Hanoi Running Lab');
    expect(await page.evaluate(() => window.__marker)).toBe(1);   // không tải lại
    await expect(page.locator('#topnav [data-nav="#/"]')).toHaveText('New test');
    await expect(page.locator('#langsw [data-lang="en"]')).toHaveClass(/on/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#name')).toHaveAttribute('placeholder', 'Nguyen Van A');
    // <option> đổi bằng label nên innerText vẫn trả text gốc: kiểm label riêng
    expect(await page.locator('#camsel option').first().evaluate((o) => o.label)).toBe('Mock camera');
    expect((await page.locator('#L1').innerText()).replace('Camera giả (mock)', '')).not.toMatch(VI);
    await shot(page.locator('#L1'), 'i18n-en-measure');
    await page.click('#langsw [data-lang="vi"]');
    await expect(page.locator('#topnav .logo b')).toHaveText('Hanoi Running Lab');
    expect(await page.locator('#L1').innerText()).toBe(before);
    await expect(page.locator('#name')).toHaveAttribute('placeholder', 'Nguyễn Văn A');
  });

  test('L-2 nhớ lựa chọn sau khi tải lại, cả hai trang; localStorage bị chặn không làm hỏng', async ({ page }) => {
    await page.goto('/index.html?mock=1');
    await page.click('#langsw [data-lang="en"]');
    await page.reload();
    await expect(page.locator('#topnav .logo b')).toHaveText('Hanoi Running Lab');
    await page.goto('/demo.html');
    await expect(page.locator('#topnav .logo b')).toHaveText('Hanoi Running Lab');
    await expect(page.locator('#topnav a.nv.on')).toHaveText('About');
    await page.click('#langsw [data-lang="vi"]');
    await expect(page.locator('#topnav a.nv.on')).toHaveText('Giới thiệu');
  });

  test('L-3 demo.html ở EN: không còn tiếng Việt (trừ tên tài liệu trích dẫn), 375px không tràn ngang', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.addInitScript(() => localStorage.setItem('lang', 'en'));
    await page.goto('/demo.html');
    await page.locator('details.more').evaluateAll((d) => d.forEach((x) => (x.open = true)));
    const txt = await page.evaluate(() => document.body.innerText + ' ' + [...document.images].map((i) => i.alt).join(' '));
    expect(txt.split('\n').filter((l) => VI.test(l)), 'dòng còn tiếng Việt').toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });

  test('L-4 EN: Sheet giữ tên cột/giá trị tiếng Việt, ảnh kết quả bằng tiếng Anh, vẽ lại khi đổi ngôn ngữ', async ({ browser }, ti) => {
    ti.setTimeout(150000);
    const u = ti.project.use;
    const ctx = await browser.newContext({ baseURL: u.baseURL, viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, permissions: ['camera'], acceptDownloads: true });
    const page = await ctx.newPage();
    await H.installSpies(page); await H.openApp(page);
    await page.click('#langsw [data-lang="en"]');
    await H.measureOne(page, { name: 'Nguyễn Văn Hùng', height: 172 });
    const row = await H.lastRow(page);
    expect(Object.keys(row).join(',')).not.toMatch(/[a-z]{3} [a-z]{3}/);
    expect(['XUẤT SẮC', 'TỐT', 'KHÁ', 'CẦN CẢI THIỆN', 'CHƯA ĐỦ TIN CẬY']).toContain(row.tier || row.rank || 'TỐT');
    expect(row.name).toBe('Nguyễn Văn Hùng');
    const D = await H.redrawRes(page);
    const T = D.filter((d) => d.t != null).map((d) => d.t);
    expect(T.filter((t) => VI.test(t) && t !== 'Nguyễn Văn Hùng'), 'chữ tiếng Việt trên ảnh').toEqual([]);
    expect(T.some((t) => /RUNNING GAIT SCORE/.test(t))).toBe(true);
    await shot(page.locator('#res'), 'i18n-en-result');
    await page.click('#langsw [data-lang="vi"]');
    await expect.poll(async () => (await page.evaluate(() => { window.__draw = []; window.__gait.drawResult(window.__gait.S.result); return window.__draw.map((d) => d.t).join('|'); }))).toMatch(/ĐIỂM DÁNG CHẠY/);
    await ctx.close();
  });
});
