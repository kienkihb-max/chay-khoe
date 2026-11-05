// Cấu hình nhỏ cho các file *.spec.js trong tests/ (không thêm package vào repo).
// Chạy (khi được bảo chạy): trong docs/ bật server riêng, vd `python -m http.server 8123`, rồi
//   BASE_URL=http://localhost:8123 npx -y -p @playwright/test playwright test -c tests/playwright.config.js --max-failures=3
// Script node cũ (ex.js, vids.js...) không thuộc bộ này.
module.exports = {
  testDir: __dirname,
  testMatch: /.*\.spec\.js$/,
  timeout: 150000,            // một lần đo giả ~20 giây + phân tích; giữ cố định, không tăng
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8099',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1920, height: 1080 },   // khung TV 16:9
    deviceScaleFactor: 1,
    acceptDownloads: true,
    permissions: ['camera'],
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  },
};
