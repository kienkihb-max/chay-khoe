# Testcase: Màn Kết quả TV + Ghi chú + Đồng bộ Sheet/Drive + Nút Dữ liệu

Viết 05/11/2026, cập nhật 07/11/2026 theo giao diện mới (qc). CHƯA CHẠY.
Luồng đo trong spec (measureOne): Bắt đầu đo -> màn xem lại `#rvok` "Chốt góc này" -> `#done` "Quay xong" -> Kết quả. Không có spec cho luồng chọn góc Ngang/Sau lưng và màn đo (đang được sửa). Cột "Nguồn" = AC của người dùng/master hoặc "tự suy ra". Cách chạy (đã chốt A): bật server riêng trong `docs/` (vd `python -m http.server 8123`), rồi
`BASE_URL=http://localhost:8123 npx -y -p @playwright/test playwright test -c tests/playwright.config.js --max-failures=3`.
Muốn nhìn ảnh: thêm `SHOT_DIR=<thư mục scratchpad>` (spec chụp cắt #res / #topnav vào đó, không lưu trong repo).

Ảnh kết quả là canvas `#res` 1920x1080: spec đọc chữ, ảnh, khung qua spy `fillText` / `drawImage` / `fillRect` (tests/e2e_helpers.js).

## 1. Màn Kết quả TV (tests/result_tv.spec.js)

| Mã | Ca | Kỳ vọng đo được |
|---|---|---|
| AC1 | Tầng 1 | Có tên (>=36px); điểm tổng = row.score_total, là chữ to nhất (>=160px); huy hiệu hạng trong ô tầng 1; KHÔNG còn nhãn ĐIỂM MẠNH (đã bỏ) |
| AC2 | Tầng 2 | Đúng 2 ô ảnh tỉ lệ 4:3 (sai số <0,01), có ảnh trong ô, có chữ góc gối (°) trên ảnh, "ĐIỂM CHÂN TRÁI/PHẢI" dưới ảnh kèm số hoặc lý do |
| AC3 | Tầng 3 | 3 nhãn Nhịp chạy / Chân đặt trước hông / Gối lúc chạm đất; giá trị >=72px, màu thuộc {xanh, cam, xám}; "NÊN CẢI THIỆN" có câu, không chứa từ chê |
| AC4 | Chỉ số phụ | Ảnh TV không có nhãn 6 chỉ số phụ; Chi tiết (bác sĩ) đủ 9 nhãn; PDF trong lần đẩy đầu có đủ 9 nhãn + "Kiểu tiếp đất" |
| AC5 | Góc + khung | Chữ "Chạy bộ cùng Bác sĩ Kiên" ở góc, không logo, không chữ "Savita", "Ngày đo dd/mm/yyyy", bacsikien.com; canvas 1920x1080, hiển thị 16:9 (sai số <0,02), nằm trọn màn 1920x1080; không chữ nào <22px (ngưỡng qc đặt cho 3 m, TV 55" 1080p) |
| CC1 | Hạng | Nhãn hạng khớp ngưỡng 85/70/55 với điểm tổng và từng chân |
| CC1 bổ sung | Biên 84/85, 69/70, 54/55 | `test.fixme`: chờ hook `window.__gait.tierOf` |
| AC6 | Header | #tolist, #notebtn, #tgdetail (trong #l3acts) nằm trong #topnav; không còn #next; #note là input ẩn; nút nav "Đo mới" có mặt; gọn chiều cao header, trên khung #res |
| AC6 | Bỏ nút PDF/ảnh | Không còn nút/link nào chữ PDF/ảnh/PNG/tải trên header và màn Kết quả |
| bổ sung | Không lộ lỗi dữ liệu | Không có undefined/NaN/null trên ảnh |
| bổ sung | Header 1440px | Không tràn mép, không xuống dòng, không chồng nút |
| bổ sung | Chỉ ở màn Kết quả | #notebtn, #tolist ẩn ở màn Danh sách |
| bổ sung | Chi tiết/Tổng quan | #tgdetail: "Chi tiết (bác sĩ)" -> mở bảng đổi "Tổng quan" -> bấm lại về "Chi tiết (bác sĩ)"; #detail ẩn/hiện theo |

### Ghi chú bác sĩ (drawer #notedrawer; nút #notebtn "Thêm ghi chú"/"Sửa ghi chú"; #notetxt, Lưu #notesave, Ctrl+Enter lưu; #note = input ẩn bản đã lưu)

Lưu = ghi cùng kết quả, gửi lại cả dòng + PDF mới (cùng Mã, Sheet ghi đè). Đóng khi đang sửa dở: hỏi #noteask (Tiếp tục sửa / Bỏ thay đổi).

| Mã | Ca biên | Kỳ vọng | Nguồn |
|---|---|---|---|
| Ghi chú | Mở drawer, gõ, Lưu (ca 1) | Sheet 1 dòng đúng Mã, cột `Ghi chú bác sĩ` = chữ; nút đổi "Sửa ghi chú"; mở lại thấy; lần đẩy cuối có PDF; không dòng trùng | AC ghi chú (CẦN QUYẾT 7=A) + drawer mới |
| Ca 1b | Gõ dở rồi bấm nền #notebg | Hiện "Ghi chú chưa lưu...", chưa lưu; Bỏ thay đổi đóng, #note và Sheet không đổi, không đẩy | tự suy ra (quy tắc ca biên) |
| Ca 2 | Enter / Ctrl+Enter | Enter xuống dòng, giữ chữ, drawer còn mở; Ctrl+Enter lưu, Sheet cập nhật, không đổi màn | tự suy ra |
| Ca 3 | Esc | Chưa sửa: đóng. Đang sửa: hỏi, chữ còn, Tiếp tục sửa quay lại ô | tự suy ra |
| Ca 4 | Mở rồi không nhập | Không viền đỏ/aria-invalid (B2); ✕ đóng không hỏi, không đẩy thừa; Lưu trống không lỗi | tự suy ra + ux-principle B2 |
| Ca 5 | Ô phụ thuộc | Không áp dụng (skip có lý do) | — |
| Ca 6 | Xoá hết rồi Lưu | Lưu rỗng, nút về "Thêm ghi chú", Sheet rỗng, vẫn 1 dòng | tự suy ra |
| Ca 7 | Sửa dở A, Bỏ thay đổi, mở B | B trống, A không mang chữ chưa lưu | tự suy ra |
| bổ sung | Ghi chú A không lẫn B | #note B rỗng, Sheet B rỗng | tự suy ra |
| bổ sung | "Đo mới" trên nav (thay #next) | #note và form trống, về màn Đo mới | master 07/11 |
| bổ sung | 300 ký tự + `<b>"&` | Header <=60px, lưu nguyên văn | tự suy ra |

Luật ô có định dạng: không áp dụng (ghi chú là chữ tự do).

## 2. Đồng bộ Sheet/Drive (tests/sync.spec.js, ?mock=1)

| Mã | Ca | Kỳ vọng |
|---|---|---|
| S-AC0 | API | window.Sync có push/pending/flush |
| S-AC1 | Payload | Đẩy 1 lần; headers đúng 11 cột SHEET_COLS (Mã, Thời gian, Họ tên, SĐT/Zalo, Điểm, Hạng, Điểm trái, Điểm phải, Đau/chấn thương, Kết luận, Ghi chú bác sĩ), không còn "Điểm chung (/100)"; row dài bằng headers, đúng mã/tên; files có PDF + PNG >1 KB, tên có mã; sheet giả có đúng mã đó; pending = 0 |
| S-AC2 | Không tải về máy | 0 sự kiện download, 0 `<a download>` bị bấm, 0 hộp chọn nơi lưu (cả khi cập nhật ghi chú) |
| S-AC3 (fixme) | Lỗi rồi gửi lại | Lỗi: pending >=1, sheet trống, có chỗ báo chưa gửi; hết lỗi + flush: pending 0, sheet đúng 1 dòng; danh sách vẫn có người đó |
| S-CC1 bổ sung | Tải lại trang | Hàng chờ còn, flush gửi được |
| S-CC2 bổ sung | 2 người lỗi liên tiếp | Gửi lại đúng thứ tự A, B, không trùng |
| S-CC3 bổ sung | flush 2 lần cùng lúc | Không gửi trùng |
| S-CC4 bổ sung | Có mạng lại | Tự gửi khi có sự kiện online |
| S-CC5 bổ sung | Sửa ghi chú khi đang lỗi | Gửi lại vẫn 1 dòng, ghi chú mới nhất |
| S-CC6 bổ sung | Dữ liệu mẫu | `await page.evaluate(() => window.__seed())` (nút #seedbtn đã bỏ) không đẩy lên Sheet |
| S-CC7 bổ sung | Tên trống | Sheet giả cột Họ tên = "Khách <Mã>" |

S-AC3, S-CC1..CC5 đang `test.fixme`: cần lỗi mạng giả mà docs/sync.js (?mock=1) chưa có cờ (`window.__mockSyncFail`). Sheet giả nối thêm mảng giá trị (không ghi đè theo Mã): helper lấy dòng cuối mỗi Mã.

## 3. Nút Dữ liệu (tests/data_link.spec.js)

| Mã | Ca | Kỳ vọng |
|---|---|---|
| D-AC1 | Màn Đo mới | Tab mới mở URL sheet 1HbknKhS...-0U; tab app không đổi màn |
| D-AC2 | Màn Danh sách, Kết quả | Như trên |
| D-AC3 | Gõ #/data | Không hiện màn Dữ liệu cũ (#L5, nút Excel/Kết nối Sheet) |
| D-CC1 bổ sung | noopener | window.opener của tab sheet = null |
| D-CC2 bổ sung | Bấm 2 lần | Không lỗi trang, không tải file |
| D-CC3 bổ sung | Bàn phím | Focus + Enter mở được |

## 4. Tab Demo + thương hiệu (tests/demo.spec.js) - ca mới 07/11/2026

| Mã | Bước | Kỳ vọng | Nguồn |
|---|---|---|---|
| BR-1 | Mở index | Title "Chạy bộ cùng Bác sĩ Kiên"; #topnav .logo b cùng chữ; không có ảnh logo | master 07/11 |
| BR-2 | Mở demo.html | Như BR-1 | master 07/11 |
| DM-AC1 | Index, bấm #demolink (trên #topnav) | Sang demo.html cùng tab, thấy h1 | master 07/11 |
| DM-AC1b | 1440px, màn Danh sách | Nút Demo không tràn, cùng hàng, bấm được | tự suy ra |
| DM-AC2 | Mở demo.html | Đủ 6 phần: hero + 4 section (Quy trình 3 bước / App đo những gì / Kết quả mẫu / Câu hỏi thường gặp) + footer CTA; 3 step, 6 card, 3 details | master 07/11 |
| DM-AC3 | Cuộn tới ảnh mẫu | 3 ảnh .samples img có naturalWidth>0, có alt | master 07/11 |
| DM-AC4 | Bấm "Đăng ký đo thử" | href index.html#/, URL index.html#/, #L1 hiện | master 07/11 |
| DM-AC5 | Mở demo.html, theo dõi request | Không request/script pose, mediapipe, wasm, tflite; không có window.Pose/__gait | master 07/11 |
| DM-CC1 | Nav demo | Demo có aria-current; Đo mới / Danh sách về index.html#/ và #/list | tự suy ra |
| DM-CC2 | 1440px, Demo rồi Back | Không cuộn ngang, không lỗi trang, Back về index | tự suy ra |
| DM-CC3 | Đăng ký đo thử rồi gõ tên | Form dùng được | tự suy ra |

## 5. Họ tên không bắt buộc (tests/name_optional.spec.js) - ca mới 07/11/2026

| Mã | Bước | Kỳ vọng | Nguồn |
|---|---|---|---|
| NM-AC1 | Để trống tên, bấm Bắt đầu đo | #go bấm được, không aria-invalid, vào màn xem lại #rvok, #msg1 không báo thiếu tên | master 07/11 |
| NM-AC2 | Đo xong để trống tên | sub.name = "Khách <Mã>"; Danh sách cột Họ tên cùng chữ | master 07/11 |
| NM-AC3 | Như trên | Sheet giả cột Họ tên = "Khách <Mã>" | master 07/11 |
| NM-CC1 | Tên chỉ dấu cách | Coi như trống: Khách <Mã> | tự suy ra |
| NM-CC2 | Nhập "lê quốc bảo" | Giữ tên, viết hoa chữ đầu (titleCase), không thành Khách | tự suy ra |
| NM-CC3 | Hai người để trống tên | 2 Mã khác nhau, 2 dòng Danh sách | tự suy ra |
| NM-CC4 | Nhãn #name | Không có * / "bắt buộc" | tự suy ra |
| NM-CC5 | Tìm "Khách" ở Danh sách | Ra người không tên | tự suy ra |

## Selector / hook (sửa một chỗ: e2e_helpers.js)

- `TODO.syncStatus` = `#syncst` (có trong index.html).
- `TODO.mockFailFlag` = `window.__mockSyncFail`: CHƯA có trong docs/sync.js -> S-AC3, S-CC1..CC5 fixme.
- `NOTE_COL` = `Ghi chú bác sĩ`; `SHEET_HEADERS` = 11 cột SHEET_COLS.
- `window.__gait.tierOf` (ca biên ngưỡng hạng) vẫn fixme.
- Nút Dữ liệu: button "Dữ liệu" (#datalink) trong #topnav.
- Chưa chắc, cần chạy xác nhận: logo trên canvas #res (AC5), chữ nhãn drawer #noteask, cách bấm #notebg (force click), titleCase (NM-CC2), `#msg1`, vị trí cột Họ tên trong bảng Danh sách (td thứ 3).
