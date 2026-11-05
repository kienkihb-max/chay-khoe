# Đẩy kết quả về Google Sheet (làm 1 lần, ~3 phút)

1. Tạo một Google Sheet mới (sheets.new).
2. Menu **Tiện ích mở rộng → Apps Script**. Xóa code mẫu, dán toàn bộ nội dung file `Code.gs` vào, bấm Lưu.
3. Bấm **Triển khai → Tùy chọn triển khai mới** → loại **Ứng dụng web**:
   - Thực thi dưới tên: **Tôi**
   - Ai có quyền truy cập: **Bất kỳ ai**
   Bấm Triển khai, cấp quyền khi Google hỏi, rồi copy **URL ứng dụng web** (dạng `https://script.google.com/macros/s/.../exec`).
4. Trong app, bấm **Kết nối Google Sheet**, dán URL đó. Từ đó mỗi người đo xong, một dòng tự được thêm vào sheet "Kết quả".

Lưu ý: ai biết URL này đều ghi được vào sheet, nên đừng đăng URL công khai. Sửa Code.gs thì phải Triển khai lại (phiên bản mới).

## Module gửi `docs/sync.js`

- `Sync.push(headers, row, files)` gửi một người (dòng + file PDF/PNG lên Drive); `Sync.pending()` số mục chưa gửi; `Sync.flush()` gửi lại ngay.
- Hàng đợi chỉ là bộ đệm tạm trong IndexedDB (chịu được file nặng, sống qua tải lại trang), gửi xong là xóa. Không dùng IndexedDB được thì giữ trong bộ nhớ. Lỗi mạng: tự gửi lại sau 5s đến 60s hoặc khi có mạng.
- URL mặc định đã gắn sẵn; đổi bằng `?sheet=<url>` hoặc `Sync.url = '...'`. `?mock=1`: không gọi mạng, đẩy vào `window.__mockSheet`.
- Vì gọi kiểu no-cors, app không đọc được phản hồi: "không lỗi mạng" được coi là đã nhận. Kiểm sheet/Drive để chắc.
