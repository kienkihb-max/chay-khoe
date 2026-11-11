// Tab Demo (docs/demo.html) + thương hiệu "Hanoi Running Lab". Viết 07/11/2026, CHƯA CHẠY.
// Nguồn: yêu cầu master 07/11/2026 (nút #demolink trên #topnav mở demo.html; demo.html 6 phần, 3 ảnh mẫu, nút "Đăng ký đo thử" về index.html#/, không nạp MediaPipe).
const { test, expect } = require('@playwright/test');
const H = require('./e2e_helpers');

const MP = /vendor\/pose|mediapipe|pose\.js|\.wasm|\.tflite|pose_landmark/i;

test.describe('Thương hiệu Hanoi Running Lab', () => {
  test('BR-1 index: tiêu đề tab, chữ thương hiệu, có ảnh logo', async ({ page }) => {
    await page.goto('/screening.html?mock=1');
    await expect(page).toHaveTitle('Hanoi Running Lab');
    await expect(page.locator('#topnav .logo b').last()).toHaveText(/hanoi running lab/i);
    await expect(page.locator('#topnav .logo img')).toHaveCount(2);   // 2 biểu tượng: Savita + HRL
  });
  test('BR-2 demo.html: cùng tiêu đề + chữ, có ảnh logo', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page).toHaveTitle(/Hanoi Running Lab/);
    await expect(page.locator('#topnav .logo b').last()).toHaveText(/hanoi running lab/i);
    await expect(page.locator('#topnav .logo img')).toHaveCount(2);   // 2 biểu tượng: Savita + HRL
  });
});

test.describe('Tab Demo', () => {
  test('DM-AC1 app Screening: nút Trang chủ (#demolink) nằm trên #topnav, bấm về Home (index.html) trong cùng tab', async ({ page }) => {
    await page.goto('/screening.html?mock=1');
    const b = page.locator('#topnav #demolink');
    await expect(b).toBeVisible();
    await expect(b).toHaveText('Trang chủ');
    await b.click();
    await page.waitForURL(/\/index\.html$/);
    await expect(page.locator('h1')).toHaveText('Phòng nghiên cứu và phân tích dáng chạy');
  });

  test.skip('DM-AC1b bổ sung: nút Trang chủ cũng bấm được ở màn Danh sách và nằm cùng hàng nav (1440px)' + ' [skip: đã ẩn theo yêu cầu 8/11]', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/screening.html?mock=1#/list');
    const nav = await page.locator('#topnav').boundingBox(), b = await page.locator('#demolink').boundingBox();
    expect(b.x + b.width).toBeLessThanOrEqual(1440);
    expect(b.y + b.height, 'không xuống dòng').toBeLessThanOrEqual(nav.y + nav.height + 1);
    await page.locator('#demolink').click();
    await page.waitForURL(/\/index\.html$/);
  });

  test('DM-AC2 Home học thuật: hero + 4 mục (Sứ mệnh, Công nghệ và phương pháp, Khám phá, Triết lý); không còn các mục Screening cũ', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('header.hero h1')).toHaveText('Phòng nghiên cứu và phân tích dáng chạy');
    const h2 = await page.locator('main section h2').allInnerTexts();
    expect(h2.map((x) => x.trim().toLowerCase())).toEqual(['sứ mệnh', 'công nghệ và phương pháp', 'khám phá hanoi running lab', 'triết lý của chúng tôi']);
    await expect(page.locator('.prin li')).toHaveCount(3);
    await expect(page.locator('.tl li')).toHaveCount(4);
    await expect(page.locator('.doors .door')).toHaveCount(3);
    await expect(page.locator('footer.closing')).toHaveText('HANOI RUNNING LAB – Where running meets science.');
    for (const old of ['.steps', '.cards', '.samples', '.refs', 'details', 'footer.cta']) await expect(page.locator(old), old).toHaveCount(0);
    expect(await page.locator('a.cite').getAttribute('href')).toBe('screening/chi-so.html#r9');
  });

  test('DM-AC3 trang Các chỉ số: 3 ảnh mẫu tải được (naturalWidth > 0), có alt; 9 chỉ số; 9 tài liệu', async ({ page }) => {
    await page.goto('/screening/chi-so.html');
    await expect(page.locator('[id^="cs"]')).toHaveCount(9);
    await expect(page.locator('li[id^="r"]')).toHaveCount(9);
    const imgs = page.locator('main img');
    await expect(imgs).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const im = imgs.nth(i);
      await im.scrollIntoViewIfNeeded();   // loading=lazy
      await expect.poll(() => im.evaluate((e) => e.complete && e.naturalWidth > 0), { message: 'ảnh mẫu ' + (i + 1) }).toBeTruthy();
      expect((await im.getAttribute('alt')) || '').not.toBe('');
    }
  });

  test('DM-AC4 CTA Screening trên Home to nhất, về screening.html; trang Hướng dẫn có Đo ngay mở màn Đo mới', async ({ page }) => {
    await page.goto('/index.html');
    const cta = page.locator('a.herocta');
    await expect(cta).toBeVisible();
    await expect(cta).toHaveText('SCREENING – PHÂN TÍCH DÁNG CHẠY');
    expect(await cta.getAttribute('href')).toBe('screening.html');
    const fsz = async (l) => parseFloat(await l.evaluate((e) => getComputedStyle(e).fontSize));
    for (const o of ['.btn2', '#topnav a.nv']) expect(await fsz(cta), 'CTA to hơn ' + o).toBeGreaterThan(await fsz(page.locator(o).first()));
    await page.goto('/screening/huong-dan.html');
    await expect(page.locator('.subnav a')).toHaveText(['Hướng dẫn', 'Các chỉ số', 'Đo ngay']);
    await page.locator('.subnav a.now').click();
    await page.waitForURL(/\/screening\.html#\/$/);
    await expect(page.locator('#L1')).toHaveClass(/show/);
  });

  test('DM-AC5 demo.html không nạp MediaPipe (không script/request pose, wasm, tflite)', async ({ page }) => {
    const reqs = [];
    page.on('request', (r) => { if (MP.test(r.url())) reqs.push(r.url()); });
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForLoadState('networkidle');
    expect(reqs, 'request liên quan MediaPipe').toEqual([]);
    const srcs = await page.locator('script[src]').evaluateAll((a) => a.map((s) => s.src));
    expect(srcs.filter((s) => MP.test(s))).toEqual([]);
    expect(await page.evaluate(() => typeof window.Pose + typeof window.__gait)).toBe('undefinedundefined');
  });

  test('DM-CC1 bổ sung: nav Home: Trang chủ đang chọn; thứ tự Trang chủ | Screening | Kiến thức | Thư viện ảnh; Screening mở 3 trang con', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html');
    await expect(page.locator('#topnav a[aria-current="page"]')).toHaveText('Trang chủ');
    expect((await page.locator('#navlinks > a.nv, #navlinks > .nvdrop > a.nv').allInnerTexts()).map((x) => x.trim())).toEqual(['Trang chủ', 'Screening', 'Kiến thức', 'Thư viện ảnh']);
    await page.locator('.nvdrop > a.nv').hover();
    await expect(page.locator('.nvmenu a')).toHaveText(['Hướng dẫn', 'Các chỉ số', 'Đo ngay']);
    expect(await page.locator('.nvmenu a').evaluateAll((a) => a.map((x) => x.getAttribute('href')))).toEqual(['screening/huong-dan.html', 'screening/chi-so.html', 'screening.html#/']);
  });

  test('DM-CC5 bổ sung: 375px thanh trên không tràn ngang, nút ☰ mở menu đủ 4 mục', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    for (const u of ['/index.html', '/screening/huong-dan.html', '/screening/chi-so.html', '/blog/']) {
      await page.goto(u);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), u).toBeTruthy();
    }
    await page.goto('/index.html');
    await page.click('#navtoggle');
    await expect(page.locator('#navlinks')).toBeVisible();
    await expect(page.locator('#navlinks a.nv:visible')).toHaveCount(4);
  });

  test('DM-CC2 bổ sung: ở 1440px không tràn ngang, không lỗi trang; nút Quay lại trình duyệt về index', async ({ page }) => {
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/screening.html?mock=1');
    await page.click('#demolink');
    await page.waitForURL(/\/index\.html$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'không cuộn ngang').toBeTruthy();
    await page.goBack();
    await expect(page.locator('#topnav')).toBeVisible();
    expect(errs).toEqual([]);
  });

  test('DM-CC3 bổ sung: mở Hướng dẫn rồi bấm Đo ngay, form Đo mới dùng được (nhập tên)', async ({ page }) => {
    await page.goto('/screening/huong-dan.html');
    await page.locator('.subnav a.now').click();
    await page.waitForURL(/\/screening\.html#\/$/);
    await page.fill('#name', 'Thử');
    await expect(page.locator('#name')).toHaveValue('Thử');
  });
});

test.describe('Bố cục Home/Screening', () => {
  test('RT-1 link cũ index.html#/list về Screening (#/), demo.html vẫn vào được', async ({ page }) => {
    await page.goto('/index.html?mock=1#/list');
    await page.waitForURL(/\/screening\.html\?mock=1/);
    await expect(page.locator('#L1')).toHaveClass(/show/);
    await expect(page.locator('#L4')).not.toHaveClass(/show/);
    expect(await page.evaluate(() => location.hash)).toBe('#/');
    await page.goto('/demo.html');
    await page.waitForURL(/\/index\.html$/);
    await expect(page.locator('#topnav a.nv.on')).toHaveText('Trang chủ');
  });
  test('RT-2 thứ tự nav app: Trang chủ | Screening | Kiến thức | Thư viện ảnh (Danh sách, Dữ liệu đã ẩn)', async ({ page }) => {
    await page.goto('/screening.html?mock=1');
    const t = (await page.locator('#topnav button:visible').allInnerTexts()).map((x) => x.trim()).filter((x) => x && x !== 'VI' && x !== 'EN');
    expect(t).toEqual(['Trang chủ', 'Screening', 'Kiến thức', 'Thư viện ảnh']);
  });
});
