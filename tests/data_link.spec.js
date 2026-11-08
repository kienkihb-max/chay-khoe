// Nút "Dữ liệu" trên header: "bấm vào đây cho mở google sheet". Mở sheet ở tab mới, không còn màn #/data.
// Không gọi Google thật: chặn docs.google.com và trả trang giả.
const { test, expect } = require('@playwright/test');
const H = require('./e2e_helpers');

const dataBtn = (page) => page.locator('#topnav').getByRole('link', { name: 'Dữ liệu' }).or(page.locator('#topnav').getByRole('button', { name: 'Dữ liệu' }));

test.describe('Nút Dữ liệu mở Google Sheet', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.route('https://docs.google.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<title>sheet giả</title>ok' }));
    await H.installSpies(page);
    await H.openApp(page);
  });

  const openFrom = async (page, context) => {
    const hash0 = await page.evaluate(() => location.hash);
    const [tab] = await Promise.all([context.waitForEvent('page'), dataBtn(page).click()]);
    await tab.waitForLoadState('domcontentloaded');
    expect(tab.url().startsWith(H.SHEET_URL), 'mở đúng sheet: ' + tab.url()).toBeTruthy();
    expect(await page.evaluate(() => location.hash), 'tab app không đổi màn').toBe(hash0);
    return tab;
  };

  test.skip('D-AC1 ở màn Đo mới: bấm Dữ liệu mở sheet ở tab mới [skip: đã ẩn nút Dữ liệu theo yêu cầu 8/11]', async ({ page, context }) => {
    await expect(dataBtn(page)).toBeVisible();
    await openFrom(page, context);
    await expect(page.locator('#L1')).toHaveClass(/show/);
  });

  test.skip('D-AC2 ở màn Danh sách và màn Kết quả cũng mở được [skip: đã ẩn nút Dữ liệu theo yêu cầu 8/11]', async ({ page, context }) => {
    await page.click('#topnav button[data-nav="#/list"]');
    await expect(page.locator('#L4')).toHaveClass(/show/);
    await (await openFrom(page, context)).close();
    await H.measureOne(page);
    await openFrom(page, context);
    await expect(page.locator('#L3')).toHaveClass(/show/);
  });

  test.skip('D-AC3 không còn màn #/data: gõ thẳng #/data không hiện màn Dữ liệu cũ [skip: đã ẩn nút Dữ liệu theo yêu cầu 8/11]', async ({ page }) => {
    await page.goto(page.url().replace(/#.*$/, '') + '#/data');
    await page.waitForTimeout(300);
    await expect(page.locator('#L5.show')).toHaveCount(0);
    await expect(page.locator('#xpick:visible, #gsbtn:visible, #xdl:visible')).toHaveCount(0);
  });

  test.skip('D-CC1 bổ sung: tab sheet mở với noopener (không trỏ ngược về app) [skip: đã ẩn nút Dữ liệu theo yêu cầu 8/11]', async ({ page, context }) => {
    const tab = await openFrom(page, context);
    expect(await tab.evaluate(() => window.opener)).toBeNull();
  });

  test.skip('D-CC2 bổ sung: bấm 2 lần mở 2 tab, app không lỗi, không tải file [skip: đã ẩn nút Dữ liệu theo yêu cầu 8/11]', async ({ page, context }) => {
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await (await openFrom(page, context)).close();
    await (await openFrom(page, context)).close();
    expect(errs).toEqual([]);
    expect(await page.evaluate(() => window.__dl)).toEqual([]);
  });

  test.skip('D-CC3 bổ sung: dùng bàn phím (Tab tới nút + Enter) cũng mở được [skip: đã ẩn nút Dữ liệu theo yêu cầu 8/11]', async ({ page, context }) => {
    await dataBtn(page).focus();
    const [tab] = await Promise.all([context.waitForEvent('page'), page.keyboard.press('Enter')]);
    expect(tab.url().startsWith(H.SHEET_URL)).toBeTruthy();
  });
});
