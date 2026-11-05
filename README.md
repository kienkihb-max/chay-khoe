# Chạy khỏe không chấn thương – Sàng lọc dáng chạy

Web app chạy hoàn toàn trên trình duyệt (không cần server, không cần cài thư viện): dùng MediaPipe Pose đo dáng chạy từ camera ngang, xuất ảnh kết quả, PDF 4 trang trả khách và Excel tổng hợp.

## Cấu trúc
- `docs/` – toàn bộ app (index.html, app.js, gait.js, reference.js, vendor/pose = MediaPipe tự host). Thư mục này cũng là thư mục xuất bản GitHub Pages.
- `windows/` – chạy không cần cài: `start.bat` + `server.ps1` (PowerShell mở http://localhost:8765). Để dùng, chép thêm thư mục `docs/` thành `app/` cạnh `start.bat`.
- `tests/` – bộ thử bằng Playwright với MediaPipe giả lập (stub_pose.js).

## Chạy thử
```
cd docs && python3 -m http.server 8099   # rồi mở http://localhost:8099
```
Tham số URL: `?total=120&rec=50&clip=15&cx=1` (giây). Camera chỉ hoạt động ở https hoặc localhost.

## Đưa lên GitHub Pages
Settings → Pages → Source: Deploy from a branch → `main` / thư mục `/docs`.
Thư mục `docs/vendor/pose/` (~24 MB) PHẢI được commit, nếu không trang sẽ không nhận diện được.

## Cần bác sĩ rà lại
- `docs/reference.js`: khoảng bình thường các chỉ số (ghi theo trí nhớ, chưa kiểm chứng; các chỉ số mở rộng chỉ là ước lượng).
- `docs/app.js`: hàm `conclusion()`, `EXER` (bài tập gợi ý), cách tính điểm `scores()`.
