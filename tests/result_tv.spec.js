// Màn Kết quả thiết kế lại cho TV (tiến độ fe: 20261105-223322-fe.json) + ghi chú bác sĩ trên header.
// Lời người dùng: "redesign layout để có chính phụ", "chiếu lên tivi ... tự hào chụp lại",
// "đưa hết lên header đi", "bỏ hết nút PDF và ảnh rồi mà". Ghi chú (CẦN QUYẾT 7 = A): gõ xong (rời ô/Enter)
// cập nhật đúng dòng người đó trên Sheet theo mã, cột Ghi chú, đẩy PDF mới lên Drive, không thêm dòng trùng.
// Ảnh kết quả là canvas #res 1920x1080: đọc chữ/ảnh qua spy fillText/drawImage (e2e_helpers.installSpies).
// Ảnh để NHÌN khi chạy: đặt SHOT_DIR=<scratchpad> thì chụp cắt vùng vào đó (không lưu trong repo).
const { test, expect } = require('@playwright/test');
const path = require('path');
const H = require('./e2e_helpers');

const shot = async (loc, name) => { if (process.env.SHOT_DIR) await loc.screenshot({ path: path.join(process.env.SHOT_DIR, name + '.png') }); };
const inBox = (d, x0, y0, x1, y1) => d.x >= x0 && d.x <= x1 && d.y >= y0 && d.y <= y1;
const TIER = (v) => (v >= 85 ? 'XUẤT SẮC' : v >= 70 ? 'TỐT' : v >= 55 ? 'KHÁ' : 'CẦN CẢI THIỆN');
const TIER_LABELS = ['XUẤT SẮC', 'TỐT', 'KHÁ', 'CẦN CẢI THIỆN', 'CHƯA ĐỦ TIN CẬY'];

// ===== Nhóm chỉ đọc: đo MỘT lần, các test chỉ xem (không đổi dữ liệu) =====
test.describe.serial('Màn Kết quả TV - bố cục', () => {
  let ctx, page, D, row, PDF;
  test.beforeAll(async ({ browser }, ti) => {
    ti.setTimeout(150000);
    const u = ti.project.use;
    ctx = await browser.newContext({ baseURL: u.baseURL, viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, permissions: ['camera'], acceptDownloads: true }); page = await ctx.newPage();
    await H.installSpies(page); await H.openApp(page);
    await H.measureOne(page, { name: 'Nguyễn Văn Hùng', height: 172 });
    // chữ trên các trang PDF (canvas ngoài #res) dựng lúc đẩy lên Drive, lấy trước khi vẽ lại
    PDF = await page.evaluate(() => window.__draw.filter((d) => d.cv === 'other' && !d.img).map((d) => d.t));
    D = await H.redrawRes(page); row = await H.lastRow(page);
  });
  test.afterAll(async () => { await ctx.close(); });

  test('AC1 tầng 1: tên + điểm tổng thật to + huy hiệu hạng + 1 dòng điểm mạnh', async () => {
    const T = D.filter((d) => d.t != null);
    const name = T.find((d) => d.t === 'Nguyễn Văn Hùng');
    expect(name, 'tên người chạy có trên ảnh').toBeTruthy();
    expect(name.px).toBeGreaterThanOrEqual(36);
    const score = T.find((d) => d.t === String(row.score_total));
    expect(score, 'điểm tổng ' + row.score_total + ' có trên ảnh').toBeTruthy();
    expect(score.px, 'điểm tổng là chữ to nhất ảnh').toBe(Math.max(...T.map((d) => d.px)));
    expect(score.px).toBeGreaterThanOrEqual(160);
    const badge = T.find((d) => TIER_LABELS.includes(d.t) && inBox(d, 48, 124, 648, 716));
    expect(badge, 'huy hiệu hạng ở tầng 1').toBeTruthy();
    const k = T.findIndex((d) => d.t === 'ĐIỂM MẠNH');
    expect(k, 'nhãn ĐIỂM MẠNH').toBeGreaterThan(-1);
    const lines = new Set(T.filter((d) => d.t.trim() && inBox(d, 48, T[k].y + 1, 648, 716)).map((d) => d.y));
    expect(lines.size, 'điểm mạnh 1 câu (tối đa 2 dòng do xuống dòng)').toBeGreaterThanOrEqual(1);
    expect(lines.size).toBeLessThanOrEqual(2);
    await shot(page.locator('#res'), 'AC1-res-mac-dinh');
  });

  test('AC2 tầng 2: hai ảnh chân trái/phải khung 4:3 có khung xương + góc gối, điểm từng chân dưới ảnh', async () => {
    // khung ảnh = nền tối của ô ảnh (fillRect màu #1b2a34 trong drawPhoto). TODO: đổi màu nếu fe đổi nền ô ảnh.
    const frames = D.filter((d) => d.rect && d.fill.toLowerCase() === '#1b2a34' && d.y < 600).sort((a, b) => a.x - b.x);
    expect(frames.length, 'hai ô ảnh trái + phải').toBe(2);
    for (const f of frames) expect(Math.abs(f.w / f.h - 4 / 3), 'khung 4:3 (' + f.w + 'x' + f.h + ')').toBeLessThan(0.01);
    const imgs = D.filter((d) => d.img);
    for (const f of frames) expect(imgs.some((i) => i.dx >= f.x - 1 && i.dx < f.x + f.w), 'có ảnh chụp trong ô x=' + f.x).toBeTruthy();
    const T = D.filter((d) => d.t != null);
    for (const [lb, x0, x1] of [['ĐIỂM CHÂN TRÁI', 640, 1270], ['ĐIỂM CHÂN PHẢI', 1270, 1900]]) {
      const l = T.find((d) => d.t === lb);
      expect(l, lb).toBeTruthy();
      expect(l.y, lb + ' nằm dưới ảnh').toBeGreaterThan(562);
      const ang = T.filter((d) => /°/.test(d.t) && d.x >= x0 && d.x <= x1 && d.y < 562);
      expect(ang.length, 'góc gối (°) vẽ trên ảnh ' + lb).toBeGreaterThan(0);
      const v = T.find((d) => d.x >= x0 && d.x <= x1 && d.y > l.y && (/^\d+$/.test(d.t) || /Chưa đủ tin cậy|Không đo được/.test(d.t)));
      expect(v, 'điểm hoặc lý do dưới ' + lb).toBeTruthy();
    }
    await shot(page.locator('#res'), 'AC2-res-hai-anh');
  });

  test('AC3 tầng 3: ba chỉ số chính chữ lớn một màu trạng thái + 1 việc nên cải thiện giọng tích cực', async () => {
    const T = D.filter((d) => d.t != null);
    for (const lb of ['Nhịp chạy', 'Chân đặt trước hông', 'Gối lúc chạm đất']) {
      const l = T.find((d) => d.t === lb);
      expect(l, lb).toBeTruthy();
      const val = T.find((d) => Math.abs(d.x - l.x) < 10 && d.y > l.y && d.y < l.y + 130 && d.px >= 72);
      expect(val, 'giá trị ' + lb + ' chữ lớn (>=72px)').toBeTruthy();
      expect(['#0b7a5c', '#b7791f', '#8a97a1'], 'một màu trạng thái').toContain(val.fill.toLowerCase());
    }
    const k = T.findIndex((d) => d.t === 'NÊN CẢI THIỆN');
    expect(k).toBeGreaterThan(-1);
    const tip = T.filter((d) => d.x >= 1260 && d.y > T[k].y && d.y < 970 && d.px >= 28).map((d) => d.t).join(' ');
    expect(tip.length).toBeGreaterThan(10);
    expect(tip, 'giọng tích cực: không dùng từ chê').not.toMatch(/\b(sai|kém|tệ|xấu|nguy hiểm)\b/i);
  });

  test('AC4 chỉ số còn lại chỉ ở PDF và Chi tiết bác sĩ; PDF vẫn đủ bảng số đo', async () => {
    const REF = await page.evaluate(() => window.GAIT_REF.metrics);
    const MAIN = ['cadence', 'overstride', 'knee_ic'];
    const T = D.filter((d) => d.t != null).map((d) => d.t);
    for (const k of ['vert_osc', 'trunk', 'shank_ic', 'knee_mid', 'hip_ext', 'knee_swing'])
      expect(T.some((t) => t.includes(REF[k].label)), 'ảnh TV không có ' + REF[k].label).toBeFalsy();
    // Chi tiết bác sĩ: bảng đủ 9 chỉ số
    await page.click('#tgdetail');
    await expect(page.locator('#detail')).toBeVisible();
    const det = await page.locator('#detail').innerText();
    for (const k of [...MAIN, 'vert_osc', 'trunk', 'shank_ic', 'knee_mid', 'hip_ext', 'knee_swing']) expect(det, 'Chi tiết có ' + REF[k].label).toContain(REF[k].label);
    await page.click('#tgdetail');
    // PDF: dựng khi đẩy lên Drive. Bảng số đo trong PDF phải đủ 9 chỉ số + kiểu tiếp đất.
    const files = await page.evaluate(() => (window.__sync[0] || {}).files || []);
    expect(files.some((f) => /pdf/i.test(f.mime || f.name)), 'có file PDF trong lần đẩy đầu').toBeTruthy();
    const pdf = PDF.join('\n');
    for (const k of [...MAIN, 'vert_osc', 'trunk', 'shank_ic', 'knee_mid', 'hip_ext', 'knee_swing']) expect(pdf, 'PDF có ' + REF[k].label).toContain(REF[k].label);
    expect(pdf).toContain('Kiểu tiếp đất');
  });

  test('AC5 góc có logo, ngày đo, bacsikien.com; khung 16:9; chữ đọc được từ 3 m', async () => {
    const T = D.filter((d) => d.t != null);
    expect(T.some((d) => d.t === 'CHẠY BỘ CÙNG BÁC SĨ KIÊN' || d.t === 'K'), 'logo').toBeTruthy();
    const today = await page.evaluate(() => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear(); });
    expect(T.some((d) => d.t.includes(today)), 'ngày đo ' + today).toBeTruthy();
    expect(T.some((d) => d.t === 'bacsikien.com')).toBeTruthy();
    const size = await page.evaluate(() => [document.getElementById('res').width, document.getElementById('res').height]);
    expect(size).toEqual([1920, 1080]);
    const b = await page.locator('#res').boundingBox();
    expect(Math.abs(b.width / b.height - 16 / 9), 'khung hiển thị 16:9').toBeLessThan(0.02);
    const vh = await page.evaluate(() => innerHeight);
    expect(b.y + b.height, 'cả khung nằm trong màn TV, không phải cuộn').toBeLessThanOrEqual(vh + 1);
    // 3 m trên TV 55" 1080p: chữ >= 22px trên ảnh 1920 (ngưỡng qc đặt, xem TESTCASES)
    const small = T.filter((d) => d.t.trim() && d.px < 22).map((d) => d.t + ' (' + d.px + 'px)');
    expect(small, 'chữ nhỏ hơn 22px').toEqual([]);
    await shot(page.locator('#res'), 'AC5-res-16-9');
  });

  test('CC1 hạng theo điểm tổng 85/70/55 khớp số trên ảnh', async () => {
    const T = D.filter((d) => d.t != null);
    const badge = T.find((d) => TIER_LABELS.includes(d.t) && inBox(d, 48, 124, 648, 716));
    expect(badge.t).toBe(row.score_total === '' ? 'CHƯA ĐỦ TIN CẬY' : TIER(row.score_total));
    for (const [s, x0, x1] of [['score_L', 640, 1270], ['score_R', 1270, 1900]]) {
      if (row[s] === '') continue;
      const lab = T.find((d) => TIER_LABELS.includes(d.t) && d.x >= x0 && d.x <= x1 && d.y > 600);
      expect(lab && lab.t, s).toBe(TIER(row[s]));
    }
  });

  test.fixme('CC1 bổ sung: ngưỡng biên 84/85, 69/70, 54/55 (chờ hook window.__gait.tierOf)', async () => {
    // TODO hook: fe đưa tierOf vào window.__gait để kiểm biên mà không phải dựng dữ liệu cho đúng điểm.
    const r = await page.evaluate(() => [84, 85, 69, 70, 54, 55, 0, 100].map((v) => window.__gait.tierOf(v).label));
    expect(r).toEqual(['TỐT', 'XUẤT SẮC', 'KHÁ', 'TỐT', 'CẦN CẢI THIỆN', 'KHÁ', 'CẦN CẢI THIỆN', 'XUẤT SẮC']);
  });

  test('AC6 header: Về danh sách, Đo người tiếp theo, ghi chú, Chi tiết nằm trên header, trên khung kết quả', async () => {
    const nav = page.locator('#topnav');
    const nb = await nav.boundingBox(), rb = await page.locator('#res').boundingBox();
    for (const sel of ['#tolist', '#next', '#note', '#tgdetail']) {
      const el = nav.locator(sel);
      await expect(el, sel + ' nằm trong header').toBeVisible();
      const b = await el.boundingBox();
      expect(b.y >= nb.y - 1 && b.y + b.height <= nb.y + nb.height + 1, sel + ' gọn trong chiều cao header').toBeTruthy();
      expect(b.y + b.height, sel + ' trên khung kết quả').toBeLessThanOrEqual(rb.y + 1);
    }
    await shot(nav, 'AC6-header-L3');
  });

  test('AC6 bỏ hết nút PDF và ảnh trên màn Kết quả', async () => {
    const btns = page.locator('#topnav button:visible, #topnav a:visible, #L3 button:visible, #L3 a:visible');
    const txt = await btns.allInnerTexts();
    expect(txt.filter((t) => /pdf|ảnh|png|tải|lưu ảnh/i.test(t)), 'không còn nút PDF/ảnh').toEqual([]);
    await expect(page.locator('#savepdf:visible, #savepng:visible, #saveimg:visible')).toHaveCount(0);
  });

  test('CC bổ sung: không có chữ undefined/NaN/null trên ảnh kết quả', async () => {
    expect(D.filter((d) => d.t != null && /undefined|NaN|null/.test(d.t)).map((d) => d.t)).toEqual([]);
  });

  test('CC bổ sung: header vừa một hàng ở 1440 px (không tràn, không chồng nút)', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    try {
      const nb = await page.locator('#topnav').boundingBox();
      const boxes = [];
      for (const sel of ['#topnav .logo', '#topnav button[data-nav]', '#tolist', '#next', '#note', '#tgdetail']) for (const b of await page.locator(sel).all()) if (await b.isVisible()) boxes.push([sel, await b.boundingBox()]);
      for (const [sel, b] of boxes) expect(b.x + b.width, sel + ' không tràn mép phải').toBeLessThanOrEqual(1440);
      for (const [sel, b] of boxes) expect(b.y + b.height, sel + ' không xuống dòng').toBeLessThanOrEqual(nb.y + nb.height + 1);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i][1], c = boxes[j][1];
        const ov = a.x < c.x + c.width - 1 && c.x < a.x + a.width - 1 && a.y < c.y + c.height - 1 && c.y < a.y + a.height - 1;
        expect(ov, boxes[i][0] + ' chồng ' + boxes[j][0]).toBeFalsy();
      }
      await shot(page.locator('#topnav'), 'CC-header-1440');
    } finally { await page.setViewportSize({ width: 1920, height: 1080 }); }
  });

  test('CC bổ sung: ô ghi chú và nút Kết quả chỉ hiện ở màn Kết quả', async () => {
    await page.goto(page.url().replace(/#.*$/, '') + '#/list');
    await expect(page.locator('#L4')).toHaveClass(/show/);
    await expect(page.locator('#note')).toBeHidden();
    await expect(page.locator('#tolist')).toBeHidden();
  });
});

// ===== Ghi chú bác sĩ trên header: mỗi test một context riêng =====
test.describe('Ghi chú bác sĩ (header) - lưu cùng kết quả + cập nhật Sheet theo mã', () => {
  test.beforeEach(async ({ page }) => { await H.installSpies(page); await H.openApp(page); });

  const reopen = async (page, id) => {
    await page.click('#tolist');
    await expect(page.locator('#L4')).toHaveClass(/show/);
    await page.click('tr[data-id="' + id + '"]');
    await expect(page.locator('#L3')).toHaveClass(/show/);
    await page.waitForFunction((i) => location.hash === '#/result/' + i, id);
  };
  const sheetOf = async (page, id) => (await H.mockSheetRows(page)).filter((r) => r['Mã'] === id);

  test('AC ghi chú: gõ rồi rời ô (Tab) thì lưu cùng kết quả, mở lại thấy, Sheet đúng 1 dòng có ghi chú (ca biên 1)', async ({ page }) => {
    const id = await H.measureOne(page, { name: 'Trần Thị Mai Anh', height: 158 });
    await page.click('#note'); await page.keyboard.type('Cần tập mông', { delay: 20 });
    await page.keyboard.press('Tab');
    await expect.poll(async () => (await sheetOf(page, id)).map((r) => r[H.NOTE_COL])).toEqual(['Cần tập mông']);
    await reopen(page, id);
    await expect(page.locator('#note')).toHaveValue('Cần tập mông');
    // PDF mới (có ghi chú) được đẩy lên Drive
    const pushes = await page.evaluate(() => window.__sync);
    expect(pushes.length, 'có lần đẩy cập nhật sau lần đầu').toBeGreaterThanOrEqual(2);
    expect(pushes[pushes.length - 1].files.some((f) => /pdf/i.test(f.mime || f.name))).toBeTruthy();
    expect((await sheetOf(page, id)).length, 'không thêm dòng trùng mã').toBe(1);
  });

  test('CC ca biên 1b: gõ dở rồi bấm ra ngoài (vào ảnh kết quả) vẫn lưu', async ({ page }) => {
    const id = await H.measureOne(page);
    await page.fill('#note', 'Gối phải');
    await page.locator('#res').click({ position: { x: 200, y: 400 } });
    await expect.poll(async () => (await sheetOf(page, id)).map((r) => r[H.NOTE_COL])).toEqual(['Gối phải']);
  });

  test('CC ca biên 2: gõ rồi Enter: giá trị còn nguyên, lưu + cập nhật Sheet, không chuyển màn', async ({ page }) => {
    const id = await H.measureOne(page);
    await page.fill('#note', 'Theo dõi lại sau 4 tuần');
    await page.press('#note', 'Enter');
    await expect(page.locator('#note')).toHaveValue('Theo dõi lại sau 4 tuần');
    await expect(page.locator('#L3')).toHaveClass(/show/);
    expect(await page.evaluate(() => location.hash)).toBe('#/result/' + id);
    await expect.poll(async () => (await sheetOf(page, id)).map((r) => r[H.NOTE_COL])).toEqual(['Theo dõi lại sau 4 tuần']);
  });

  test('CC ca biên 3: Esc không xoá chữ đã gõ, không rời màn Kết quả', async ({ page }) => {
    const id = await H.measureOne(page);
    await page.fill('#note', 'Esc thử');
    await page.press('#note', 'Escape');
    await expect(page.locator('#note')).toHaveValue('Esc thử');
    await expect(page.locator('#L3')).toHaveClass(/show/);
    await reopen(page, id);
    await expect(page.locator('#note')).toHaveValue('Esc thử');
  });

  test('CC ca biên 4: ô ghi chú để trống rồi rời ô: không báo đỏ, không đẩy cập nhật thừa', async ({ page }) => {
    await H.measureOne(page);
    const n0 = await page.evaluate(() => window.__sync.length);
    await page.click('#note'); await page.keyboard.press('Tab');
    const st = await page.locator('#note').evaluate((e) => { const m = getComputedStyle(e).borderColor.match(/\d+/g).map(Number); return { inv: e.getAttribute('aria-invalid'), red: m[0] > 180 && m[1] < 110 && m[2] < 110 }; });
    expect(st.inv).not.toBe('true');
    expect(st.red, 'không viền đỏ (luật B2)').toBeFalsy();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => window.__sync.length), 'không đẩy khi ghi chú không đổi').toBe(n0);
  });

  test('CC ca biên 5: ô phụ thuộc - không áp dụng (ghi chú không phụ thuộc ô nào)', async () => {
    test.skip(true, 'Không áp dụng: ô ghi chú không có ô phụ thuộc.');
  });

  test('CC ca biên 6: xoá hết ghi chú rồi rời ô: lưu rỗng, Sheet cột Ghi chú rỗng, vẫn 1 dòng', async ({ page }) => {
    const id = await H.measureOne(page);
    await page.fill('#note', 'Tạm'); await page.press('#note', 'Tab');
    await expect.poll(async () => (await sheetOf(page, id)).map((r) => r[H.NOTE_COL])).toEqual(['Tạm']);
    await page.fill('#note', ''); await page.press('#note', 'Tab');
    await expect.poll(async () => (await sheetOf(page, id)).map((r) => r[H.NOTE_COL] || '')).toEqual(['']);
    await reopen(page, id);
    await expect(page.locator('#note')).toHaveValue('');
  });

  test('CC ca biên 7: gõ ghi chú người A rồi mở người B ngay: B không mang ghi chú A, A vẫn lưu', async ({ page }) => {
    const a = await H.measureOne(page, { name: 'Người A' });
    await page.click('#next');
    const b = await H.measureOne(page, { name: 'Người B' });
    await expect(page.locator('#note'), 'người mới: ô ghi chú trống').toHaveValue('');
    await reopen(page, a);
    await page.fill('#note', 'Ghi chú của A');
    await page.click('#tolist');                     // rời ngay, trước 300 ms
    await page.click('tr[data-id="' + b + '"]');
    await expect(page.locator('#L3')).toHaveClass(/show/);
    await expect(page.locator('#note')).toHaveValue('');
    await expect.poll(async () => (await sheetOf(page, a)).map((r) => r[H.NOTE_COL])).toEqual(['Ghi chú của A']);
    expect((await sheetOf(page, b)).map((r) => r[H.NOTE_COL] || '')).toEqual(['']);
    await reopen(page, a);
    await expect(page.locator('#note')).toHaveValue('Ghi chú của A');
  });

  test('CC bổ sung: Đo người tiếp theo xoá ô ghi chú', async ({ page }) => {
    await H.measureOne(page);
    await page.fill('#note', 'abc'); await page.press('#note', 'Tab');
    await page.click('#next');
    await expect(page.locator('#L1')).toHaveClass(/show/);
    await expect(page.locator('#note')).toHaveValue('');
  });

  test('CC bổ sung: ghi chú dài 300 ký tự + ký tự đặc biệt không làm vỡ header, lưu đúng nguyên văn', async ({ page }) => {
    const id = await H.measureOne(page);
    const v = ('<b>"Đau" & mỏi</b>; ' + 'gối trái '.repeat(40)).slice(0, 300);
    await page.fill('#note', v); await page.press('#note', 'Tab');
    const nb = await page.locator('#topnav').boundingBox();
    expect(nb.height).toBeLessThanOrEqual(60);
    await expect(page.locator('#tgdetail')).toBeVisible();
    await expect.poll(async () => (await sheetOf(page, id)).map((r) => r[H.NOTE_COL])).toEqual([v]);
    await reopen(page, id);
    await expect(page.locator('#note')).toHaveValue(v);
  });
});
