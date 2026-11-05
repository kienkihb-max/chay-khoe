# Testcase: Màn Kết quả TV + Ghi chú + Đồng bộ Sheet/Drive + Nút Dữ liệu

Viết 05/11/2026 (qc). CHƯA CHẠY. Cách chạy (đã chốt A): bật server riêng trong `docs/` (vd `python -m http.server 8123`), rồi
`BASE_URL=http://localhost:8123 npx -y -p @playwright/test playwright test -c tests/playwright.config.js --max-failures=3`.
Muốn nhìn ảnh: thêm `SHOT_DIR=<thư mục scratchpad>` (spec chụp cắt #res / #topnav vào đó, không lưu trong repo).

Ảnh kết quả là canvas `#res` 1920x1080: spec đọc chữ, ảnh, khung qua spy `fillText` / `drawImage` / `fillRect` (tests/e2e_helpers.js).

## 1. Màn Kết quả TV (tests/result_tv.spec.js)

| Mã | Ca | Kỳ vọng đo được |
|---|---|---|
| AC1 | Tầng 1 | Có tên (>=36px); điểm tổng = row.score_total, là chữ to nhất (>=160px); huy hiệu hạng trong ô tầng 1; điểm mạnh 1 câu (<=2 dòng) |
| AC2 | Tầng 2 | Đúng 2 ô ảnh tỉ lệ 4:3 (sai số <0,01), có ảnh trong ô, có chữ góc gối (°) trên ảnh, "ĐIỂM CHÂN TRÁI/PHẢI" dưới ảnh kèm số hoặc lý do |
| AC3 | Tầng 3 | 3 nhãn Nhịp chạy / Chân đặt trước hông / Gối lúc chạm đất; giá trị >=72px, màu thuộc {xanh, cam, xám}; "NÊN CẢI THIỆN" có câu, không chứa từ chê |
| AC4 | Chỉ số phụ | Ảnh TV không có nhãn 6 chỉ số phụ; Chi tiết (bác sĩ) đủ 9 nhãn; PDF trong lần đẩy đầu có đủ 9 nhãn + "Kiểu tiếp đất" |
| AC5 | Góc + khung | Logo, "Ngày đo dd/mm/yyyy", bacsikien.com; canvas 1920x1080, hiển thị 16:9 (sai số <0,02), nằm trọn màn 1920x1080; không chữ nào <22px (ngưỡng qc đặt cho 3 m, TV 55" 1080p) |
| CC1 | Hạng | Nhãn hạng khớp ngưỡng 85/70/55 với điểm tổng và từng chân |
| CC1 bổ sung | Biên 84/85, 69/70, 54/55 | `test.fixme`: chờ hook `window.__gait.tierOf` |
| AC6 | Header | #tolist, #next, #note, #tgdetail nằm trong #topnav, gọn chiều cao header, trên khung #res |
| AC6 | Bỏ nút PDF/ảnh | Không còn nút/link nào chữ PDF/ảnh/PNG/tải trên header và màn Kết quả |
| bổ sung | Không lộ lỗi dữ liệu | Không có undefined/NaN/null trên ảnh |
| bổ sung | Header 1440px | Không tràn mép, không xuống dòng, không chồng nút |
| bổ sung | Chỉ ở màn Kết quả | #note, #tolist ẩn ở màn Danh sách |

### Ghi chú bác sĩ trên header (quyết A: rời ô/Enter thì cập nhật đúng dòng theo mã, cột Ghi chú, đẩy PDF mới, không thêm dòng trùng)

| Mã | Ca biên | Kỳ vọng |
|---|---|---|
| Ghi chú | Gõ rồi Tab (ca 1) | Sheet giả đúng 1 dòng mã đó, cột Ghi chú = chữ đã gõ; mở lại thấy; lần đẩy cuối có PDF |
| Ca 1b | Gõ dở rồi bấm ra ngoài | Vẫn lưu, Sheet cập nhật |
| Ca 2 | Enter | Giá trị còn, không đổi màn, Sheet cập nhật |
| Ca 3 | Esc | Không xoá chữ, không rời màn, mở lại vẫn còn |
| Ca 4 | Để trống rồi rời ô | Không viền đỏ / aria-invalid (luật B2), không đẩy thừa |
| Ca 5 | Ô phụ thuộc | Không áp dụng (skip có lý do) |
| Ca 6 | Xoá hết | Lưu rỗng, Sheet cột Ghi chú rỗng, vẫn 1 dòng |
| Ca 7 | Gõ cho A rồi mở B ngay (<300 ms) | B trống, A vẫn lưu, Sheet A có ghi chú, B không |
| bổ sung | Đo người tiếp theo | Ô ghi chú trống |
| bổ sung | 300 ký tự + `<b>"&` | Header không vỡ (<=60px), lưu nguyên văn |

Luật ô có định dạng (chặn chữ/ký tự sai): không áp dụng, ghi chú là chữ tự do.

## 2. Đồng bộ Sheet/Drive (tests/sync.spec.js, ?mock=1)

| Mã | Ca | Kỳ vọng |
|---|---|---|
| S-AC0 | API | window.Sync có push/pending/flush |
| S-AC1 | Payload | Đẩy 1 lần; headers có Mã, Họ tên, Điểm chung (/100), Ghi chú; row dài bằng headers, đúng mã/tên; files có PDF + PNG >1 KB, tên có mã; sheet giả có đúng mã đó; pending = 0 |
| S-AC2 | Không tải về máy | 0 sự kiện download, 0 `<a download>` bị bấm, 0 hộp chọn nơi lưu (cả khi cập nhật ghi chú) |
| S-AC3 | Lỗi rồi gửi lại | Lỗi: pending >=1, sheet trống, có chỗ báo chưa gửi; hết lỗi + flush: pending 0, sheet đúng 1 dòng; danh sách vẫn có người đó |
| S-CC1 bổ sung | Tải lại trang | Hàng chờ còn, flush gửi được |
| S-CC2 bổ sung | 2 người lỗi liên tiếp | Gửi lại đúng thứ tự A, B, không trùng |
| S-CC3 bổ sung | flush 2 lần cùng lúc | Không gửi trùng |
| S-CC4 bổ sung | Có mạng lại | Tự gửi khi có sự kiện online |
| S-CC5 bổ sung | Sửa ghi chú khi đang lỗi | Gửi lại vẫn 1 dòng, ghi chú mới nhất |
| S-CC6 bổ sung | Dữ liệu mẫu | Không đẩy lên Sheet (`test.fixme`: chờ vị trí nút dữ liệu mẫu) |

## 3. Nút Dữ liệu (tests/data_link.spec.js)

| Mã | Ca | Kỳ vọng |
|---|---|---|
| D-AC1 | Màn Đo mới | Tab mới mở URL sheet 1HbknKhS...-0U; tab app không đổi màn |
| D-AC2 | Màn Danh sách, Kết quả | Như trên |
| D-AC3 | Gõ #/data | Không hiện màn Dữ liệu cũ (#L5, nút Excel/Kết nối Sheet) |
| D-CC1 bổ sung | noopener | window.opener của tab sheet = null |
| D-CC2 bổ sung | Bấm 2 lần | Không lỗi trang, không tải file |
| D-CC3 bổ sung | Bàn phím | Focus + Enter mở được |

## Selector / hook còn TODO (sửa một chỗ: `TODO` trong tests/e2e_helpers.js)

- `TODO.syncStatus` = `#syncstat`: chỗ báo "còn N kết quả chưa gửi".
- `TODO.mockFailFlag` = `window.__mockSyncFail`: cờ làm sheet giả báo lỗi.
- `TODO.seedBtn` = `#seedbtn`: nút dữ liệu mẫu sau khi bỏ màn #/data.
- `NOTE_COL` = `Ghi chú`: tên cột ghi chú trên Sheet.
- Dạng `window.__mockSheet`: spec đọc được cả mảng object dòng lẫn mảng payload {headers, rows, files}; sheet giả phải cập nhật theo Mã (mỗi mã 1 dòng).
- `window.__gait.tierOf` (cho ca biên ngưỡng hạng).
- Nút Dữ liệu: tìm theo role link/button tên "Dữ liệu" trong #topnav.
