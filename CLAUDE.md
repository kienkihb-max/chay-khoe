# Ghi chú cho Claude Code

Dự án: app sàng lọc dáng chạy của bác sĩ Lê Trung Kiên (bacsikien.com). Người dùng là bác sĩ, trả lời tiếng Việt, giải thích kỹ thuật thật đơn giản.

- Thuần JS, không bundler. File chính: `docs/gait.js` (tính chỉ số, không phụ thuộc DOM, chạy cả Node), `docs/app.js` (giao diện, camera, video, PDF/Excel viết tay), `docs/index.html`.
- Dữ liệu người chạy chỉ lưu trong trình duyệt (localStorage) và file Excel người dùng chọn. Không gửi lên server.
- Tham chiếu chỉ số trong `docs/reference.js` chưa kiểm chứng, đừng coi là chuẩn y khoa.
- Kiểm thử: `tests/` dùng Playwright + stub MediaPipe; chạy `python3 -m http.server 8099` trong `docs/` trước.
- Việc còn dở: ghép bố cục kết luận (bảng so sánh Trái|Phải|Bình thường, chỉ nêu số bất thường, ô "chỉ mang tính tham khảo") vào ảnh/PDF; đồng bộ lại bản Python (`gait/`) nếu còn dùng; xin thêm video thật để chỉnh ngưỡng.
- TODO: đổ dữ liệu về Google Sheet. Đã có nút "Kết nối Google Sheet" (app.js, `pushSheet`) + `google-sheet/Code.gs` và `HUONG_DAN.md`; `?mock=1` dùng sheet giả. Còn: tạo sheet thật, triển khai Apps Script, thử gửi thật và kiểm dòng vào đúng cột.
- Blog: viết bài trong `content/blog/*.md` rồi chạy `node scripts/build-blog.mjs` (sinh `docs/blog/`, `sitemap.xml`, `robots.txt`; đổi tên miền ở `SITE_URL` đầu script); commit cả file sinh ra.
