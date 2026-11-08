/* i18n.js — chuyển ngôn ngữ VI | EN cho cả hai trang (index.html, demo.html).
 *
 * Cách làm: app vẫn sinh chuỗi TIẾNG VIỆT như cũ (dữ liệu lưu, tên cột Google Sheet, khoá dữ liệu không đổi).
 * File này dịch ở "đầu ra" khi đang ở chế độ EN:
 *   - chữ trên trang (text node, placeholder/title/alt/aria-label, <option>) + MutationObserver cho nội dung vẽ sau;
 *   - chữ vẽ lên canvas (fillText/measureText) => ảnh kết quả và PDF theo ngôn ngữ đang chọn;
 *   - alert/confirm.
 * Chế độ VI: không làm gì (trả đúng chuỗi gốc). Lựa chọn lưu ở localStorage 'lang' (mặc định vi).
 * Thêm câu mới: thêm cặp [tiếng Việt, tiếng Anh] vào DICT (khoá dài thắng khoá ngắn).
 */
(function () {
  'use strict';
  var KEY = 'lang';
  var DICT = [
    // ===== Thương hiệu, thanh trên =====
    [`HANOI RUNNING LAB`, `HANOI RUNNING LAB`],
    [`Hanoi Running Lab`, `Hanoi Running Lab`],
    [`Đo mới`, `New test`], [`Danh sách đã đo`, `Measured runners`], [`Danh sách`, `List`], [`Dữ liệu`, `Data`], [`Giới thiệu`, `About`],
    [`Mở Google Sheet ở tab mới`, `Open Google Sheet in a new tab`], [`Đóng`, `Close`],
    [`Chưa gửi `, `Not sent: `], [` người · tự gửi lại`, ` · will retry automatically`],
    [`Chờ gửi`, `Pending`], [`Đã gửi`, `Sent`], [`Đã lưu`, `Saved`],
    [`Chưa gửi được lên Google Sheet:`, `Could not send to Google Sheet:`],
    // ===== Màn Đo =====
    [`Đánh giá dáng chạy bằng AI – trong 2 phút`, `AI running gait assessment – in 2 minutes`],
    [`Đánh giá dáng chạy bằng AI`, `AI running gait assessment`],
    [`Phân tích chuyển động bằng AI, đánh giá cân bằng hai chân. Có kết quả sau `, `AI motion analysis that assesses the balance between both legs. Results after `],
    [`Đăng ký thông tin`, `Register`], [`Chạy 2 phút, hệ thống tự ghi nhận`, `Run for 2 minutes, recorded automatically`],
    [`Nhận báo cáo và khuyến nghị`, `Get your report and advice`],
    [`Kết quả mang tính sàng lọc, không thay thế chẩn đoán y khoa.`, `Results are for screening only and do not replace a medical diagnosis.`],
    [`● Ghi hình`, `● Record`], [`Lưu video cả buổi chạy`, `Save video of the whole run`], [`Đang xin quyền camera...`, `Requesting camera permission...`],
    [`Thông tin người tham gia`, `Participant information`], [`Quay trực tiếp`, `Live camera`], [`Tải video lên`, `Upload video`],
    [`GÓC QUAY`, `CAMERA ANGLE`], [`Ngang`, `Side`], [`Sau lưng`, `Rear`],
    [`HỌ VÀ TÊN`, `FULL NAME`], [`SỐ ĐIỆN THOẠI / ZALO (TÙY CHỌN)`, `PHONE / ZALO (OPTIONAL)`],
    [`CHIỀU CAO (CM, TÙY CHỌN)`, `HEIGHT (CM, OPTIONAL)`], [`Giúp kết quả chính xác hơn. Mặc định 165 cm.`, `Makes the result more accurate. Default 165 cm.`],
    [`TIỀN SỬ ĐAU, CHẤN THƯƠNG (NẾU CÓ)`, `PAIN OR INJURY HISTORY (IF ANY)`],
    [`FILE VIDEO (quay ngang hông, thấy cả hai chân)`, `VIDEO FILE (filmed from the side at hip height, both legs visible)`],
    [`FILE VIDEO (quay sau lưng, thấy cả hai chân)`, `VIDEO FILE (filmed from behind, both legs visible)`],
    [`Chưa chọn video`, `No video selected`], [`BẮT ĐẦU TỪ GIÂY`, `START AT SECOND`], [`Nên chọn đoạn đã chạy ổn định`, `Pick a part where the pace is already steady`],
    [`TỐC ĐỘ MÁY (KM/H)`, `TREADMILL SPEED (KM/H)`], [`VIDEO QUAY CHẬM (SLOW-MO)?`, `SLOW-MOTION VIDEO?`],
    [`Tự nhận biết (khuyên dùng)`, `Auto-detect (recommended)`], [`Không, video quay thường`, `No, normal video`],
    [`Quay chậm gấp 2 (60 → 30 khung/giây)`, `Slow-mo x2 (60 → 30 fps)`], [`Quay chậm gấp 4 (120 → 30)`, `Slow-mo x4 (120 → 30)`], [`Quay chậm gấp 8 (240 → 30)`, `Slow-mo x8 (240 → 30)`],
    [`Video slow-mo phát chậm hơn thực tế nên nhịp chạy sẽ bị đo thấp nếu chọn sai.`, `Slow-motion video plays slower than real time, so cadence will be measured too low if this is set wrong.`],
    [`⚙ Cài đặt đo (mặc định)`, `⚙ Measurement settings (default)`], [`KIỂU CHẠY`, `RUN MODE`],
    [`Chuẩn: chạy 2 phút, phân tích 15 giây`, `Standard: 2-minute run, 15 s analysed`], [`Nhanh: chạy 1 phút, phân tích 15 giây`, `Quick: 1-minute run, 15 s analysed`],
    [`Kỹ: chạy 2,5 phút, phân tích 30 giây`, `Thorough: 2.5-minute run, 30 s analysed`], [`Đầy đủ: chạy 3 phút, phân tích 60 giây`, `Full: 3-minute run, 60 s analysed`],
    [`Tùy chỉnh (chọn bên dưới)`, `Custom (set below)`], [`TỐC ĐỘ MÁY CHẠY (KM/H)`, `TREADMILL SPEED (KM/H)`],
    [`FPS CAMERA / PHÂN TÍCH`, `CAMERA / ANALYSIS FPS`], [`60 (cần máy khỏe)`, `60 (needs a fast computer)`], [`ĐỘ PHÂN GIẢI CAMERA`, `CAMERA RESOLUTION`],
    [`ĐOẠN PHÂN TÍCH (GIÂY)`, `ANALYSIS WINDOW (SECONDS)`], [`BẮT ĐẦU THU Ở GIÂY`, `START CAPTURE AT SECOND`], [`TỔNG THỜI GIAN CHẠY (GIÂY)`, `TOTAL RUN TIME (SECONDS)`],
    [`Tự nhận biết nhịp chạy ổn định rồi mới bắt đầu thu (nếu chưa ổn định thì thu muộn nhất vào cuối thời gian cho phép)`, `Detects a steady cadence before capturing starts (if it never settles, capture starts at the latest at the end of the allowed time)`],
    [`Đang chuẩn bị...`, `Preparing...`], [`Quay xong · xuất kết quả`, `Recording done · export result`],
    [`Tạo dữ liệu mẫu (5 người)`, `Create sample data (5 people)`], [`CÒN LẠI`, `REMAINING`], [`Đo ngay`, `Measure now`],
    [`Kết thúc sớm`, `Finish early`], [`Dừng, không lưu`, `Stop, do not save`], [`Dừng đo và không lưu kết quả của lần này?`, `Stop measuring and discard this result?`],
    [`Nguyễn Văn A`, `Nguyen Van A`], [`165 nếu bỏ trống`, `165 if left empty`], [`Để trống nếu không`, `Leave empty if none`], [`Tìm tên / SĐT`, `Search name / phone`],
    [`Ghi chú bác sĩ (in vào PDF)`, `Doctor's note (printed in the PDF)`],
    // ===== app.js: ghi hình, video, camera =====
    [`Trình duyệt này không hỗ trợ ghi hình. Dùng Chrome hoặc Edge.`, `This browser does not support recording. Use Chrome or Edge.`],
    [`Không bắt đầu ghi hình được: `, `Could not start recording: `], [`■ Dừng và lưu · `, `■ Stop and save · `], [`Đang ghi hình...`, `Recording...`],
    [`Đã lưu video `, `Video saved `], [`) vào thư mục Downloads.`, `) to the Downloads folder.`],
    [`chiều cao 100–230 cm (hoặc để trống)`, `height 100–230 cm (or leave empty)`], [`Còn thiếu: `, `Missing: `], [`Hãy chọn file video`, `Please choose a video file`],
    [`Phân tích video`, `Analyse video`], [`Bắt đầu đo · `, `Start measuring · `], [`Bắt đầu (thử `, `Start (trial `],
    [`Đã chốt góc `, `Angle confirmed: `], [` và `, ` and `], [`. Quay lại một góc đã chốt sẽ thay lần quay cũ.`, `. Re-recording a confirmed angle replaces the earlier take.`],
    [`Tổng thời gian được nâng lên `, `Total time raised to `], [` giây để đủ chỗ cho đoạn phân tích. `, ` s to leave room for the analysis window. `],
    [`Máy chạy `, `Treadmill `], [` km/h. Đoạn phân tích `, ` km/h. Analysis window `], [` giây bắt đầu ở giây `, ` s starting at second `],
    [`. FPS thực tế phụ thuộc tốc độ máy tính (xem dòng "Nhận diện … khung/giây" khi đang đo).`, `. Actual FPS depends on the computer's speed (see the "Detecting … fps" line while measuring).`],
    [`CAMERA GIẢ (MOCK)`, `MOCK CAMERA`], [`Camera giả (mock) – máy không có camera thật · `, `Mock camera – no real camera on this device · `], [`Camera giả (mock)`, `Mock camera`],
    [`Không mở được camera: `, `Could not open the camera: `], [` (cần mở bằng https, ví dụ GitHub Pages)`, ` (must be opened over https, e.g. GitHub Pages)`], [`(dọc)`, `(portrait)`],
    [`Đang chế độ thử (mock): khung xương là hình giả`, `Test mode (mock): the skeleton is simulated`],
    [`Phân tích video quay sẵn: chọn file, chọn đoạn chạy ổn định rồi bấm phân tích.`, `Analyse a recorded video: choose a file, pick a steady stretch, then press Analyse.`],
    [`Không tải được mô hình nhận diện: `, `Could not load the pose model: `],
    [`Đang mở video...`, `Opening video...`], [`Không mở được video này (thử định dạng MP4).`, `Could not open this video (try MP4).`],
    [`Đang nhận biết video có quay chậm không...`, `Checking whether the video is slow-motion...`],
    [`Video quá ngắn: cần ít nhất `, `Video too short: needs at least `], [` giây video (= 6 giây thực tế) sau điểm bắt đầu`, ` s of video (= 6 real seconds) after the start point`],
    [` vì video quay chậm gấp `, ` because the video is slow-motion x`], [`Đang phân tích video · còn khoảng `, `Analysing video · about `],
    [`Đang tính kết quả...`, `Calculating result...`], [`Đã đo xong · giữ nhịp chạy đến hết giờ`, `Measured · keep running until time is up`],
    [`Chạy thoải mái · đang chờ nhịp chạy ổn định`, `Run comfortably · waiting for a steady cadence`], [`Chạy thoải mái · sắp thu hình sau `, `Run comfortably · capture starts in `],
    [`ĐANG THU HÌNH · `, `CAPTURING · `], [` · nhịp đã ổn định`, ` · cadence is steady`], [`hết giờ chờ`, `wait timed out`], [`ổn định`, `steady`], [` (nhịp ~`, ` (cadence ~`],
    [`Nhận diện `, `Detecting `], [`khung/giây`, `fps`], [`TIẾN ĐỘ`, `PROGRESS`], [`đo ngay`, `measure now`],
    [`thiếu vendor/tasks-vision/vision_bundle.js`, `missing vendor/tasks-vision/vision_bundle.js`],
    [`Không đo được: `, `Could not measure: `], [` Hãy bấm Bắt đầu để đo lại.`, ` Press Start to measure again.`], [`Không đo được`, `Not measurable`],
    [`Góc gối `, `Knee angle `], [`CÒN LẠI`, `REMAINING`], [`Khách `, `Guest `],
    [`Quay lại`, `Back`], [`Chốt góc này`, `Confirm this angle`], [`Xem lại góc `, `Review angle `],
    [`Chưa bắt được khung hình`, `Frame not captured`], [`Chưa bắt được khung chạm đất`, `Ground-contact frame not captured`],
    // ===== Cờ tin cậy / kiểm tra chất lượng =====
    [`máy chỉ nhận diện `, `the computer only detects `], [` khung/giây (cần từ 20)`, ` fps (20 or more needed)`], [`chỉ nhận diện được người ở `, `a person was only detected in `], [`% số khung hình`, `% of frames`],
    [`nhịp chạy đo được `, `measured cadence of `], [` bước/phút không hợp lý`, ` steps/min is not plausible`],
    [` (nếu là video quay chậm, hãy chọn đúng hệ số ở ô "Video quay chậm")`, ` (if this is a slow-motion video, choose the right factor in "Slow-motion video")`],
    [`: hai cách đo nhịp lệch nhau (`, `: the two cadence methods disagree (`], [`: vị trí đặt chân bất thường (`, `: unusual foot placement (`], [` cm), có thể nhận diện sai`, ` cm), may be a detection error`],
    [`Dưới ngưỡng tin cậy`, `Below reliability threshold`], [`Nghi bắt sai mốc`, `Suspected event mis-detection`], [` · tin cậy `, ` · reliability `],
    [`±X là độ dao động giữa các bước (nửa khoảng tứ phân vị), không phải sai số đã kiểm chứng.`, `±X is the variation between steps (half the interquartile range), not a validated error.`],
    [` (dựa trên chân `, ` (based on the `], [`; chân `, `; `], [` chưa đủ tin cậy)`, ` not reliable enough)`],
    [`Chân có cờ tin cậy không được tính vào chỉ số này.`, `A leg with a reliability flag is not counted in this metric.`], [` Chỉ số này không được tính vào điểm.`, ` This metric is not counted in the score.`],
    [`Không đáng tin: `, `Unreliable: `], [`KHÔNG ĐÁNG TIN: `, `UNRELIABLE: `], [`có cờ tin cậy`, `has reliability flags`], [`Cờ tin cậy`, `Reliability flags`],
    [`Tên: Dưới ngưỡng tin cậy ±X / Nghi bắt sai mốc: lý do`, `Name: Below reliability threshold ±X / Suspected event mis-detection: reason`],
    [`Không thấy người trong hình (có `, `No person visible in the image (`], [` khung hình nhận diện được).`, ` frames detected).`],
    [`Khung hình kém: `, `Poor video quality: `], [`Khung hình kém`, `Poor video quality`], [`% khung hình có điểm mờ bị bỏ`, `% of frames with blurry points dropped`], [`chỉ còn `, `only `],
    [`. Thử đo lại: đủ sáng, quay trọn người từ đầu đến chân, mặc quần áo khác màu nền.`, `. Try again: good light, film the whole body from head to toe, wear clothes that contrast with the background.`],
    [`Không nhận diện được người trong video (thiếu khung xương).`, `Could not detect a person in the video (no skeleton found).`],
    [`Mốc chạm đất có thể bắt sai (gối lúc chạm đất ngoài khoảng thường gặp, hoặc chân chạm sau hông nhiều)`, `Ground-contact events may be mis-detected (knee angle at initial contact outside the usual range, or the foot lands far behind the hip)`],
    [`Không đo được gối lúc chạm đất`, `Could not measure knee at initial contact`], [`Gối lúc chạm đất `, `Knee at initial contact `], [`° ngoài `, `° outside `],
    [`Bàn chân chạm sau hông `, `Foot lands behind the hip `], [`Không đo được góc sau lưng`, `Could not measure rear-view angles`],
    [`: phát hiện quá ít bước rõ (<2)`, `: too few clear steps detected (<2)`], [`: phát hiện quá ít bước (<3)`, `: too few steps detected (<3)`],
    [`mặt đất`, `ground`], [`ra ngoài`, `outward`], [`Gót`, `Heel`], [`Mũi chân`, `Forefoot`], [`Giữa bàn`, `Midfoot`],
    [`trong khoảng`, `within range`],
    // ===== Chân trái / phải =====
    [`CHÂN TRÁI`, `LEFT LEG`], [`CHÂN PHẢI`, `RIGHT LEG`], [`ĐIỂM CHÂN `, `LEG SCORE `], [`TRÁI`, `LEFT`], [`PHẢI`, `RIGHT`],
    [`Chân trái`, `Left leg`], [`Chân phải`, `Right leg`], [`chân trái`, `left leg`], [`chân phải`, `right leg`], [`Trái`, `Left`], [`Phải`, `Right`], [`trái`, `left`], [`phải`, `right`],
    [`Không đo được chân này`, `This leg could not be measured`], [`chân `, `leg `],
    // ===== Chỉ số (tên) =====
    [`Cadence (nhịp chạy)`, `Cadence`], [`Nhịp chạy`, `Cadence`], [`bước/phút`, `steps/min`],
    [`Nhấp nhô (hông)`, `Vertical oscillation (hip)`], [`Nhấp nhô`, `Vertical oscillation`], [`Nghiêng thân trước`, `Forward trunk lean`], [`Nghiêng thân`, `Trunk lean`],
    [`Chân đặt trước hông`, `Foot ahead of hip (overstride)`], [`Tiếp đất trước thân`, `Landing ahead of body`], [`Gối lúc chạm đất`, `Knee at initial contact`],
    [`Gập gối lúc chạm đất`, `Knee flexion at initial contact`], [`Gập gối lúc chạm`, `Knee flexion at contact`], [`Góc cẳng chân lúc chạm`, `Shank angle at contact`],
    [`Bàn chân trước hông lúc chạm`, `Foot ahead of hip at contact`], [`Gập gối tối đa (đứng)`, `Peak knee flexion (stance)`], [`Duỗi hông lúc rời đất`, `Hip extension at toe-off`],
    [`Gập gối tối đa (đưa chân)`, `Peak knee flexion (swing)`], [`Thời gian chạm đất`, `Ground contact time`], [`Thời gian bay`, `Flight time`], [`Tỉ lệ chạm đất / bước`, `Contact ratio per step`],
    [`Độ đều nhịp bước (dao động)`, `Step-time variability`], [`Lệch nhịp trái–phải`, `Left–right cadence asymmetry`], [`Lệch thời gian chạm đất trái–phải`, `Left–right contact time asymmetry`],
    [`Nâng đùi tối đa`, `Peak thigh lift`], [`Gót hất ra sau (cao so với mặt đất)`, `Heel recovery (height above ground)`], [`Biên độ vung tay`, `Arm swing range`], [`Góc gập khuỷu`, `Elbow flexion angle`],
    [`Đầu nghiêng trước`, `Forward head tilt`], [`Sụt hông bên không trụ`, `Contralateral hip drop`], [`Gối đổ vào trong (nhìn từ sau)`, `Knee valgus (rear view)`], [`Bàn chân so với đường giữa`, `Foot position relative to midline`],
    [`Độ rộng bước`, `Step width`], [`Thân lắc ngang`, `Lateral trunk sway`], [`Sụt hông`, `Hip drop`], [`Gối đổ vào`, `Knee valgus`], [`Thân lắc`, `Trunk sway`],
    [`Sụt hông trái (°)`, `Hip drop, left (°)`], [`Kiểu tiếp đất`, `Foot strike pattern`],
    [`ước lượng, chưa kiểm chứng`, `estimate, not validated`], [`tham khảo Bramah 2018`, `see Bramah 2018`], [`TẠM, chờ bác sĩ duyệt`, `PROVISIONAL, awaiting doctor review`], [`tham khảo`, `reference`],
    [`góc hông–gối–cổ chân 2D`, `2D hip–knee–ankle angle`],
    // ===== Nhận xét theo chỉ số (reference.js) =====
    [`Cadence thấp: bước dài, thường kèm tiếp đất xa trước thân. Tăng 5-10% có thể giảm tải khớp gối/hông.`, `Low cadence: long strides, often with landing far ahead of the body. Raising it by 5-10% can reduce knee/hip load.`],
    [`Cadence cao hơn khoảng thông thường: thường không đáng lo, xem cùng độ dài bước.`, `Cadence above the usual range: usually not a concern, consider it together with stride length.`],
    [`Nhấp nhô thấp: dáng chạy 'phẳng', thường tốt.`, `Low oscillation: a 'flat' running style, usually good.`],
    [`Nhấp nhô cao: tốn năng lượng nâng cơ thể, tăng lực va chạm mỗi bước.`, `High oscillation: wastes energy lifting the body and increases impact forces with every step.`],
    [`Thân quá thẳng/ngả sau: dễ tiếp đất xa trước thân.`, `Trunk too upright or leaning back: makes it easy to land far ahead of the body.`],
    [`Thân gập trước nhiều: tăng tải hông/lưng, xem lại gập từ hông hay gập lưng.`, `Strong forward lean: increases hip/back load; check whether the bend comes from the hips or the back.`],
    [`Gối quá duỗi lúc chạm đất: tăng lực va chạm.`, `Knee too straight at initial contact: increases impact force.`],
    [`Gối gập nhiều lúc chạm đất: cần cơ tứ đầu hoạt động nhiều hơn.`, `Large knee flexion at initial contact: demands more work from the quadriceps.`],
    [`Cẳng chân thẳng đứng/ra sau: tiếp đất dưới trọng tâm (tốt).`, `Shank vertical or angled backward: landing under the centre of mass (good).`],
    [`Cẳng chân đưa mạnh ra trước: dấu hiệu overstride, tăng lực phanh.`, `Shank swung well forward: a sign of overstride, increases braking force.`],
    [`Chạm đất sau/ngay dưới hông.`, `Landing behind or right under the hip.`],
    [`Chạm đất xa phía trước hông: overstride, giảm cadence thường giúp cải thiện.`, `Landing far ahead of the hip: overstride; raising cadence usually helps.`],
    [`Gối ít gập khi chịu tải: giảm hấp thụ lực.`, `Little knee flexion under load: reduced force absorption.`],
    [`Gối gập sâu khi chịu tải: cần nhiều sức mạnh cơ đùi.`, `Deep knee flexion under load: needs a lot of thigh muscle strength.`],
    [`Duỗi hông hạn chế: xem độ linh hoạt cơ gập hông / sức mạnh mông.`, `Limited hip extension: check hip flexor flexibility and glute strength.`],
    [`Duỗi hông nhiều: có thể kèm ưỡn lưng bù trừ.`, `Large hip extension: may come with compensatory lower-back arching.`],
    [`Gót lên thấp: bước chân 'lê', thường pace chậm.`, `Low heel recovery: a 'shuffling' stride, usually at a slow pace.`],
    [`Gót hất cao: nhiều năng lượng cho giai đoạn đưa chân.`, `High heel recovery: more energy spent in the swing phase.`],
    [`Chạm đất ngắn: thường gặp ở người chạy nhanh, nhẹ chân.`, `Short ground contact: common in fast, light-footed runners.`],
    [`Chạm đất lâu: bàn chân 'dính' mặt đường, thường kèm bước dài/phanh.`, `Long ground contact: the foot 'sticks' to the ground, often with long strides and braking.`],
    [`Nhịp bước chưa đều: có thể do mệt, chưa quen máy chạy hoặc mất cân bằng.`, `Uneven step rhythm: may be due to fatigue, unfamiliarity with the treadmill or poor balance.`],
    [`Hai chân bước không đều nhau: nên khám lâm sàng nếu kèm đau một bên.`, `The two legs step unevenly: get a clinical exam if there is one-sided pain.`],
    [`Hai chân chạm đất lâu mỏng khác nhau: có thể một bên yếu hoặc đang né đau.`, `The two legs differ in ground contact time: one side may be weaker or avoiding pain.`],
    [`Nâng gối thấp: bước 'lê', cơ gập hông có thể yếu.`, `Low knee lift: a 'shuffling' stride, the hip flexors may be weak.`],
    [`Nâng gối cao: tốn năng lượng, thường ở tốc độ nhanh.`, `High knee lift: costs energy, usually at fast speeds.`],
    [`Hông bên không trụ nâng lên khi chống chân: ít gặp, xem lại cách đặt máy quay.`, `Non-stance hip rises during stance: uncommon, re-check the camera placement.`],
    [`Hông bên không trụ tụt nhiều khi chống chân: cơ mông nhỡ (cơ dạng hông) bên trụ có thể yếu.`, `Non-stance hip drops a lot during stance: the gluteus medius (hip abductor) on the stance side may be weak.`],
    [`Gối choãi ra ngoài khi chống chân.`, `Knee bows outward during stance.`],
    [`Gối đổ vào trong khi chống chân: tăng tải mặt trước/trong gối, xem sức mạnh mông và kiểm soát gối.`, `Knee collapses inward during stance: increases load on the front/inner knee; check glute strength and knee control.`],
    [`Bàn chân đặt chéo qua đường giữa (chạy như trên dây): tăng tải dải chậu chày, mặt trong cẳng chân.`, `Foot crosses the midline (running as if on a tightrope): increases load on the iliotibial band and inner shin.`],
    [`Bàn chân đặt xa đường giữa: bước dạng rộng.`, `Foot lands far from the midline: wide step.`],
    [`Hai bàn chân đặt chéo nhau.`, `The two feet cross over each other.`],
    [`Bước dạng rộng: thân dễ lắc ngang.`, `Wide step: the trunk tends to sway sideways.`],
    [`Thân lắc sang hai bên nhiều: có thể bù cho hông yếu, tốn năng lượng.`, `Large side-to-side trunk sway: may compensate for weak hips and wastes energy.`],
    // ===== Kết luận / lời khuyên =====
    [`Các chỉ số chính đều nằm trong khoảng tham chiếu.`, `All main metrics are within the reference range.`], [`Các chỉ số chính đều nằm trong khoảng bình thường. `, `All main metrics are within the normal range. `],
    [`Cần chú ý: `, `Needs attention: `], [`Cần chỉnh: `, `To work on: `], [`Lưu ý: `, `Note: `],
    [`Dáng chạy tốt: các chỉ số chính nằm trong khoảng bình thường.`, `Good running form: the main metrics are within the normal range.`],
    [`Các chỉ số đủ tin cậy nằm trong khoảng bình thường (`, `The reliable metrics are within the normal range (`], [` chỉ số có cờ tin cậy, không đưa vào kết luận).`, ` metric(s) with reliability flags excluded from the conclusion).`],
    [`Chưa đủ tin cậy để kết luận.`, `Not reliable enough to draw a conclusion.`], [`Chưa đủ tin cậy`, `Not reliable enough`], [`CHƯA ĐỦ TIN CẬY`, `NOT RELIABLE ENOUGH`], [`Lý do: `, `Reason: `],
    [`Hãy đo lại: camera đặt ngang vuông góc, thấy cả người từ đầu đến chân, đủ sáng, và dòng "Nhận diện … khung/giây" khi đo nên từ 20 trở lên.`, `Please measure again: camera placed square to the side, whole body visible from head to toe, good light, and the "Detecting … fps" line during measuring should be 20 or more.`],
    [`nhịp chạy chậm`, `slow cadence`], [`đặt chân xa trước hông`, `foot lands far ahead of the hip`], [`nảy lên xuống nhiều`, `too much bouncing`],
    [`thân quá thẳng hoặc ngả sau`, `trunk too upright or leaning back`], [`thân gập trước nhiều`, `strong forward trunk lean`], [`gối gập nhiều lúc chạm đất`, `too much knee flexion at initial contact`],
    [`gối gần thẳng lúc chạm đất`, `knee nearly straight at initial contact`], [`hai chân không đều`, `uneven legs`],
    [` chưa đủ tin cậy: `, ` not reliable enough: `], [` chỉ số dựa trên chân `, ` metric(s) based on the `],
    [`Tăng nhịp chạy khoảng 5% (khoảng `, `Raise your cadence by about 5% (to about `], [` bước/phút), bước ngắn lại và đặt chân gần dưới thân người.`, ` steps/min), shorten your stride and land your foot closer under your body.`],
    [`Chạy "êm" hơn: đẩy người về phía trước thay vì nảy lên, giữ nhịp nhanh và bước nhẹ.`, `Run more smoothly: push yourself forward instead of bouncing up, keep a quick cadence and light steps.`],
    [`Nghiêng nhẹ cả người về trước từ cổ chân (không gập lưng), mắt nhìn xa phía trước.`, `Lean the whole body slightly forward from the ankles (do not bend at the back) and look far ahead.`],
    [`Đứng thẳng hơn, giữ bụng gồng nhẹ, tránh gập người về trước.`, `Stand taller, lightly brace your core and avoid folding forward.`],
    [`Tăng sức mạnh đùi và mông (squat, bước lên bục) 2 buổi mỗi tuần.`, `Strengthen your thighs and glutes (squats, step-ups) 2 sessions a week.`],
    [`Chạm đất nhẹ nhàng, giữ gối hơi mềm để giảm sốc.`, `Land softly and keep the knee slightly bent to reduce shock.`],
    [`Hai chân khác nhau rõ: nên kiểm tra thêm sức mạnh và độ linh hoạt hai bên.`, `The two legs differ clearly: have strength and flexibility checked on both sides.`],
    [`Giữ kỹ thuật hiện tại, tập sức mạnh 2 buổi mỗi tuần và đo lại sau 4–6 tuần.`, `Keep your current technique, do strength work 2 sessions a week and re-test after 4–6 weeks.`],
    [`Bạn đang có đau (`, `You currently have pain (`], [`): nên được bác sĩ thăm khám trực tiếp.`, `): you should see a doctor in person.`],
    [`Có đau khi chạy: nên được bác sĩ khám trực tiếp`, `Pain while running: you should see a doctor in person`],
    [`Hai chân khác nhau rõ ở gối hoặc vị trí đặt chân`, `The two legs clearly differ in knee angle or foot placement`],
    [`Nhịp chạy `, `Cadence `], [`, thấp hơn khoảng bình thường`, `, below the normal range`], [`Chân đặt trước hông `, `Foot ahead of hip `], [` cm, xa hơn bình thường`, ` cm, farther than normal`],
    [`Nảy lên xuống `, `Vertical bounce `], [` cm, cao hơn bình thường`, ` cm, higher than normal`], [`Thân nghiêng `, `Trunk lean `], [`°, thẳng hơn bình thường`, `°, more upright than normal`], [`°, gập nhiều hơn bình thường`, `°, leaning more than normal`],
    [`Gối gập `, `Knee flexion `], [`° lúc chạm đất, gần thẳng`, `° at initial contact, nearly straight`], [`° lúc chạm đất, nhiều hơn bình thường`, `° at initial contact, more than normal`],
    [`Duỗi hông `, `Hip extension `], [`°, hạn chế`, `°, limited`], [`Gối gập tối đa lúc đứng `, `Peak knee flexion in stance `], [`°, ít hơn bình thường`, `°, less than normal`],
    [`Gối gập tối đa lúc đưa chân `, `Peak knee flexion in swing `], [`°, thấp hơn bình thường`, `°, lower than normal`],
    // tip trên ảnh kết quả
    [`Bước ngắn lại một chút, đặt chân gần dưới hông sẽ nhẹ gối hơn`, `A slightly shorter stride, landing closer under the hip, will be easier on your knees`],
    [`Đẩy người về phía trước thay vì nảy lên sẽ chạy êm và đỡ mệt hơn`, `Pushing forward instead of bouncing up will make running smoother and less tiring`],
    [`Nghiêng nhẹ cả người về trước từ cổ chân sẽ giúp bước chạy trôi hơn`, `Leaning the whole body slightly forward from the ankles will make your stride flow better`],
    [`Giữ thân thẳng hơn một chút, gồng bụng nhẹ sẽ giúp lưng thoải mái hơn`, `Standing a little taller and lightly bracing your core will make your back more comfortable`],
    [`Giữ gối hơi mềm khi chạm đất sẽ giảm sốc cho khớp`, `Keeping the knee slightly soft at landing will reduce shock to the joints`],
    [`Tập thêm sức mạnh đùi và mông sẽ giúp gối vững hơn khi tiếp đất`, `More thigh and glute strength will keep the knee steadier at landing`],
    [`Giãn cơ gập hông đều đặn sẽ giúp sải chân ra sau thoải mái hơn`, `Regular hip flexor stretching will make the backward stride more comfortable`],
    [`Tập hạ người chậm trên một chân sẽ giúp gối nhún chịu lực tốt hơn`, `Slow single-leg lowering drills will help the knee absorb load better`],
    [`Tập gót chạm mông nhẹ nhàng sẽ giúp vung chân gọn và nhanh hơn`, `Gentle butt kicks will help you swing the leg through more compactly and quickly`],
    [`Tập thêm bài một chân sẽ giúp hai chân đều nhau hơn`, `More single-leg exercises will help even out the two legs`],
    [`Đo lại với camera đặt ngang, thấy rõ cả người để có kết quả chính xác hơn`, `Measure again with the camera square to the side and the whole body clearly visible for a more accurate result`],
    [`Tăng nhịp lên khoảng `, `Raise cadence to about `], [` bước/phút sẽ giúp chạy nhẹ nhàng hơn`, ` steps/min to make running feel lighter`],
    [`Giữ phong độ này! Tập sức mạnh 2 buổi mỗi tuần và đo lại sau 4–6 tuần`, `Keep it up! Do strength work 2 sessions a week and re-test after 4–6 weeks`],
    // ===== Bài tập =====
    [`Tăng nhịp bước (Cadence training)`, `Cadence training`],
    [`Chạy nhẹ theo máy gõ nhịp (Metronome) 170–175 bước/phút, 3 buổi mỗi tuần, mỗi buổi 5–10 phút trong buổi chạy nhẹ. Tăng dần khoảng 5% mỗi tuần.`, `Easy runs with a metronome at 170–175 steps/min, 3 sessions a week, 5–10 minutes each within an easy run. Increase gradually by about 5% a week.`],
    [`Chạy lướt, bớt nảy (Reduce vertical oscillation)`, `Reduce vertical oscillation`],
    [`Cue "chạy dưới trần thấp" (Run under a low ceiling): đẩy người về trước thay vì nhảy lên. Thêm nhảy dây (Jump rope) nhẹ 3 hiệp x 1 phút để quen bước nhẹ và ngắn.`, `Cue "run under a low ceiling": drive forward instead of jumping up. Add light jump rope, 3 sets x 1 minute, to get used to light, short steps.`],
    [`Nghiêng nhẹ từ cổ chân (Ankle lean drill)`, `Ankle lean drill`],
    [`Đứng sát tường, nghiêng cả người về trước từ cổ chân (Wall lean), không gập lưng, rồi chạy bước nhỏ. Lặp lại 5 lần x 20 giây trước buổi chạy.`, `Stand close to a wall and lean the whole body forward from the ankles (wall lean) without bending at the back, then run with small steps. Repeat 5 times x 20 seconds before a run.`],
    [`Giữ thân vững hơn (Core stability)`, `Core stability`],
    [`Plank 3 x 30–45 giây và Bird-dog 3 x 10 lần mỗi bên, 3 buổi mỗi tuần. Khi chạy nhìn xa, bụng gồng nhẹ.`, `Plank 3 x 30–45 seconds and bird-dog 3 x 10 reps each side, 3 sessions a week. While running, look far ahead and keep the core lightly braced.`],
    [`Đặt chân gần dưới thân (Reduce overstriding)`, `Reduce overstriding`],
    [`Chạy bước ngắn nhanh (Fast feet drill) 4 x 30 giây, chạm đất ngay dưới hông. Kết hợp tăng nhịp bước khoảng 5%.`, `Fast feet drill 4 x 30 seconds, landing right under the hip. Combine with about a 5% higher cadence.`],
    [`Mềm gối lúc chạm đất (Soft landing)`, `Soft landing`],
    [`Nhảy xuống từ bục thấp (Box drop landing) rồi giữ gối mềm 3 x 8 lần; chạy chậm tập chạm đất nhẹ.`, `Box drop landing: step down from a low box and hold a soft knee, 3 x 8 reps; run slowly practising a light landing.`],
    [`Tăng sức mạnh đùi và mông (Quad and glute strength)`, `Quad and glute strength`],
    [`Squat 3 x 12, Step-up (bước lên bục) 3 x 10 mỗi chân, Glute bridge (cầu mông) 3 x 12; 2 buổi mỗi tuần.`, `Squat 3 x 12, step-up 3 x 10 each leg, glute bridge 3 x 12; 2 sessions a week.`],
    [`Mở hông ra sau (Hip extension)`, `Hip extension`],
    [`Giãn cơ gập hông (Hip flexor stretch) 3 x 30 giây mỗi bên, tư thế quỳ một gối. Cầu mông một chân (Single-leg glute bridge) 3 x 10 mỗi bên. Thêm Standing hip extension (nâng chân ra sau khi đứng) 3 x 12.`, `Hip flexor stretch 3 x 30 seconds each side in a half-kneeling position. Single-leg glute bridge 3 x 10 each side. Add standing hip extension (lift the leg backward while standing) 3 x 12.`],
    [`Tăng khả năng nhún khi chịu tải (Eccentric control)`, `Eccentric control`],
    [`Hạ người một chân chậm (Step-down) 3 x 8 mỗi chân, giữ gối thẳng hàng với bàn chân.`, `Slow single-leg step-down 3 x 8 each leg, keeping the knee in line with the foot.`],
    [`Gót vung lên sau (Heel recovery)`, `Heel recovery`],
    [`Gót chạm mông (Butt kicks) 3 x 20 m và nâng gối cao (High knees) 3 x 20 m, 2 buổi mỗi tuần trước khi chạy.`, `Butt kicks 3 x 20 m and high knees 3 x 20 m, 2 sessions a week before running.`],
    [`Cân bằng hai chân (Single-leg training)`, `Single-leg training`],
    [`Đứng một chân giữ thăng bằng (Single-leg balance) 3 x 30 giây, Single-leg glute bridge 3 x 10, Step-up 3 x 10 mỗi bên. Nên kiểm tra thêm sức mạnh và linh hoạt hai bên.`, `Single-leg balance 3 x 30 seconds, single-leg glute bridge 3 x 10, step-up 3 x 10 each side. Also have strength and flexibility checked on both sides.`],
    [`Bài tập gợi ý cho bạn`, `Suggested exercises for you`],
    [`Tên bài tập kèm thuật ngữ tiếng Anh để dễ tra cứu video hướng dẫn. Bài tập mang tính gợi ý chung, hãy dừng nếu thấy đau và hỏi bác sĩ hoặc huấn luyện viên trước khi tập nếu bạn đang chấn thương.`, `Exercise names are given in standard English terms so you can look up tutorial videos. The exercises are general suggestions: stop if you feel pain, and ask a doctor or coach before training if you are injured.`],
    [`Điểm dáng chạy và bài tập gợi ý`, `Running gait score and suggested exercises`],
    // ===== Màn kết quả / ảnh / PDF =====
    [`Tổng quan`, `Overview`], [`Chi tiết (bác sĩ)`, `Details (doctor)`],
    [`Ngày đo `, `Test date `], [`quay góc sau lưng`, `rear view recorded`], [`ĐIỂM DÁNG CHẠY`, `RUNNING GAIT SCORE`], [`ĐIỂM CHUNG`, `OVERALL SCORE`], [`ĐIỂM GÓC SAU`, `REAR-VIEW SCORE`],
    [`Góc ngang `, `Side view `], [`Góc sau `, `Rear view `], [` · góc ngang `, ` · side view `], [` · góc sau `, ` · rear view `],
    [`Chưa quay góc ngang nên chưa có nhịp chạy, gối và hông.`, `The side view has not been recorded yet, so cadence, knee and hip metrics are missing.`],
    [`Tốt`, `Good`], [`Thấp`, `Low`], [`Cao`, `High`], [`tốt`, `good`], [`thấp`, `low`], [`cao`, `high`],
    [`XUẤT SẮC`, `EXCELLENT`], [`TỐT`, `GOOD`], [`KHÁ`, `FAIR`], [`CẦN CẢI THIỆN`, `NEEDS WORK`], [`Cần cải thiện`, `Needs work`], [`Hạng Tốt`, `Rank Good`], [`Hạng Khá`, `Rank Fair`], [`Xuất sắc`, `Excellent`], [`Khá`, `Fair`],
    [`NÊN CẢI THIỆN`, `TO IMPROVE`], [`GHI CHÚ`, `NOTES`], [`NHẬN XÉT CỦA BÁC SĨ`, `DOCTOR'S COMMENTS`],
    [`Ngưỡng góc sau lưng đang tạm, chờ bác sĩ duyệt. Quay thêm góc ngang để có đánh giá đầy đủ.`, `Rear-view thresholds are provisional, awaiting doctor review. Record the side view too for a full assessment.`],
    [`Sàng lọc 2D bằng AI, chỉ mang tính tham khảo, không thay thế khám lâm sàng.`, `AI 2D screening, for reference only; it does not replace a clinical examination.`],
    [` Chân xa camera kém tin cậy hơn.`, ` The leg farther from the camera is less reliable.`], [` Chân có cờ tin cậy không được tính vào điểm ở chỉ số đó.`, ` A leg with a reliability flag is not counted in the score for that metric.`],
    [` Ngưỡng góc sau lưng đang tạm, chờ bác sĩ duyệt.`, ` Rear-view thresholds are provisional, awaiting doctor review.`],
    [`Cuối buổi so với đầu buổi: nhịp chạy`, `End vs. start of session: cadence`], [`Cuối buổi so với đầu buổi: nhấp nhô`, `End vs. start of session: vertical oscillation`], [`thay đổi nhiều`, `changed a lot`],
    [`Nhìn từ sau lưng`, `Rear view`], [`Nhìn từ sau`, `Rear view`], [`Nhìn ngang`, `Side view`], [`ngưỡng góc sau đang tạm, chờ bác sĩ duyệt`, `rear-view thresholds provisional, awaiting doctor review`],
    [`Ngưỡng góc sau lưng đang TẠM, chờ bác sĩ duyệt`, `Rear-view thresholds are PROVISIONAL, awaiting doctor review`],
    [`Bình thường (tạm)`, `Normal (provisional)`], [`Bình thường`, `Normal`], [`Trong khoảng bình thường (tạm).`, `Within the normal range (provisional).`], [`Ngoài khoảng bình thường (tạm).`, `Outside the normal range (provisional).`],
    [`Chỉ số góc sau đo 2D từ video quay sau lưng; khoảng bình thường đang tạm, chờ bác sĩ duyệt. Chỉ mang tính tham khảo, không thay thế khám lâm sàng.`, `Rear-view metrics are measured in 2D from video filmed from behind; the normal ranges are provisional, awaiting doctor review. For reference only; they do not replace a clinical examination.`],
    [`Chỉ số của bạn nằm trong khoảng bình thường.`, `Your metric is within the normal range.`], [`Chỉ số ngoài khoảng bình thường.`, `Metric outside the normal range.`],
    [`Khoảng bình thường: cả ba kiểu đều có thể gặp ở người chạy khỏe`, `Normal range: all three patterns occur in healthy runners`], [`Khoảng bình thường: `, `Normal range: `],
    [`Ý nghĩa các chỉ số của bạn`, `What your metrics mean`],
    [`Số bước chân mỗi phút. Bước ngắn và nhanh hơn thường giúp giảm lực va đập lên gối và hông.`, `Steps per minute. Shorter, quicker steps usually reduce impact on the knees and hips.`],
    [`Mức hông nhấp nhô lên xuống mỗi bước. Càng ít thì càng tiết kiệm sức và đỡ va đập.`, `How much the hips move up and down with each step. Less means saved energy and less impact.`],
    [`Độ nghiêng thân người về phía trước khi chạm đất. Nghiêng nhẹ từ hông là hợp lý.`, `How far the trunk leans forward at landing. A slight lean from the hips is reasonable.`],
    [`Khoảng cách bàn chân đặt trước hông lúc chạm đất. Đặt quá xa trước người sẽ tạo lực phanh mỗi bước.`, `How far the foot lands ahead of the hip at contact. Landing too far ahead creates a braking force with every step.`],
    [`Độ gập của gối lúc bàn chân chạm đất. Gối hơi gập giúp giảm sốc cho khớp.`, `Knee bend at the moment the foot touches down. A slightly bent knee reduces shock to the joints.`],
    [`Phần bàn chân chạm đất trước: gót, giữa bàn hoặc mũi chân. Không có kiểu đúng tuyệt đối; quan trọng là chạm đất gần dưới thân người.`, `Which part of the foot lands first: heel, midfoot or forefoot. No pattern is absolutely right; what matters is landing close under the body.`],
    [`Kết quả sàng lọc 2D bằng AI trong 15 giây chạy, chỉ mang tính tham khảo, không thay thế khám và chẩn đoán lâm sàng. Nếu đang đau hoặc chấn thương, hãy gặp bác sĩ.`, `AI 2D screening result from a 15-second run window, for reference only; it does not replace a clinical examination and diagnosis. If you are in pain or injured, see a doctor.`],
    [`Liên hệ: `, `Contact: `], [`Bảng số đo chi tiết`, `Detailed measurement table`],
    [`Chỉ số`, `Metric`], [`Đánh giá`, `Rating`], [`Tham chiếu`, `Reference`],
    [`Mốc thời gian chạm đất/bay ước lượng từ video 30 khung/giây (sai số khoảng ±33 ms). Các chỉ số không có khoảng bình thường chỉ để theo dõi. Chân xa camera kém tin cậy hơn.`, `Ground contact and flight times are estimated from 30 fps video (error about ±33 ms). Metrics without a normal range are for tracking only. The leg farther from the camera is less reliable.`],
    [`Không đo được từ camera ngang: gối vào trong, hông tụt, bàn chân xoay trong/ngoài, bước chéo, bề rộng bước (cần thêm camera sau). Chỉ mang tính tham khảo, không thay thế bác sĩ.`, `Not measurable from the side camera: knee valgus, hip drop, foot rotation in/out, cross-over steps, step width (a rear camera is needed). For reference only; it does not replace a doctor.`],
    [`Điểm cho biết bao nhiêu chỉ số chính nằm trong khoảng bình thường (`, `The score shows how many main metrics are within the normal range (`], [`). Đây là điểm tham khảo, không phải chẩn đoán.`, `). This is a reference score, not a diagnosis.`],
    [`(/100, tham khảo)`, `(/100, reference)`], [`Điểm: chung `, `Score: overall `], [` · trái `, ` · left `], [` · phải `, ` · right `],
    [`Chẩn đoán: `, `Diagnostics: `], [` khung/giây phân tích · nhận diện `, ` fps analysed · detected `], [`% khung hình (`, `% of frames (`], [` · video quay chậm gấp `, ` · slow-motion video x`],
    [` · đạt kiểm tra độ tin cậy`, ` · passed the reliability check`],
    [`: số bước · độ tin cậy`, `: step count · reliability`], [` bước · vis `, ` steps · vis `], [` (thấp)`, ` (low)`], [` bước`, ` steps`],
    [`Lưu ý`, `Note`], [` Chỉ số có cờ không được tính vào điểm; chip và chấm của chỉ số đó được làm mờ.`, ` Flagged metrics are not counted in the score; their chip and dot are dimmed.`],
    [` chân trái · `, ` left leg · `], [` chân phải · chấm tô màu theo đánh giá (xanh = tốt, vàng = thấp/cao) · thanh xám = ngoài khoảng bình thường`, ` right leg · dots are coloured by rating (green = good, yellow = low/high) · grey bar = outside the normal range`],
    [`Trái: `, `Left: `], [`Phải: `, `Right: `], [`Trái `, `Left `], [`Phải `, `Right `],
    // ===== Lưu, danh sách, ghi chú =====
    [`Trình duyệt không có IndexedDB`, `This browser has no IndexedDB`], [`Không lưu được kết quả chi tiết để mở lại:`, `Could not save the detailed result for reopening:`],
    [`Không có dữ liệu chi tiết của `, `No detailed data for `], [` (người này đo trước khi app lưu kết quả chi tiết), nên không mở lại được màn kết quả. Thông tin tóm tắt vẫn có trong danh sách và Google Sheet.`, ` (measured before the app stored detailed results), so the result screen cannot be reopened. The summary is still in the list and in Google Sheet.`],
    [`Không tìm thấy mã `, `Code not found: `], [` trong danh sách.`, ` in the list.`], [`Không lưu được ghi chú:`, `Could not save the note:`], [`Sửa ghi chú`, `Edit note`], [`Thêm ghi chú`, `Add note`], [`Ghi chú bác sĩ · `, `Doctor's note · `],
    [`Ghi chú chưa lưu. Đóng và bỏ thay đổi?`, `Unsaved note. Close and discard changes?`], [`Tiếp tục sửa`, `Keep editing`], [`Bỏ thay đổi`, `Discard changes`], [`Về danh sách`, `Back to list`], [`Lưu`, `Save`], [`Ghi chú bác sĩ`, `Doctor's note`],
    [`Không có kết quả khớp.`, `No matching results.`], [`Chưa có ai được đo.`, `Nobody has been measured yet.`], [`Không tạo được`, `Could not create`],
    [`Mã`, `Code`], [`Thời gian`, `Time`], [`Họ tên`, `Name`], [`SĐT/Zalo`, `Phone/Zalo`], [`Điểm`, `Score`], [`Kết luận`, `Conclusion`], [`Hạng`, `Rank`],
    [`Chưa có`, `None yet`], [`chưa có`, `none yet`],
    // ===== Trang Giới thiệu (demo.html) =====
    [`Giới thiệu – Đánh giá dáng chạy bằng AI | Hanoi Running Lab`, `About – AI running gait assessment | Hanoi Running Lab`],
    [`Camera ghi lại khi bạn chạy trên máy chạy bộ, AI nhận diện khung xương, đo các góc khớp và so sánh hai chân. Kết quả có ngay sau buổi chạy.`, `A camera films you running on the treadmill; AI detects your skeleton, measures joint angles and compares both legs. Results are ready right after the run.`],
    [`Quy trình 3 bước`, `How it works in 3 steps`], [`Họ tên, chiều cao (không bắt buộc).`, `Name and height (optional).`], [`Chạy 2 phút`, `Run for 2 minutes`],
    [`Camera đặt ngang hông, có thể quay thêm góc sau lưng.`, `Camera placed at hip height from the side; you can also record a rear view.`], [`Nhận báo cáo`, `Get your report`],
    [`Điểm tổng, điểm từng chân, chỉ số chính và khuyến nghị.`, `Overall score, score per leg, main metrics and recommendations.`],
    [`Các chỉ số quan trọng`, `Key metrics`],
    [`Ba chỉ số đầu (nhịp chạy, chân đặt trước hông, góc gối lúc chạm đất) thường được chú ý nhất. Các chỉ số phía sau giúp nhìn dáng chạy đầy đủ hơn.`, `The first three metrics (cadence, foot ahead of hip, knee angle at initial contact) usually get the most attention. The remaining metrics give a fuller picture of your running form.`],
    [`Là gì:`, `What it is:`], [`Vì sao quan trọng:`, `Why it matters:`], [`Khoảng tham khảo:`, `Reference range:`],
    [`số bước mỗi phút.`, `steps per minute.`],
    [`nhịp thấp thường đi kèm bước dài, chân đặt xa trước thân; tăng nhịp 5–10% có thể giảm tải gối và hông.`, `a low cadence often goes with long strides and landing far ahead of the body; raising cadence by 5–10% can reduce knee and hip load.`],
    [`165–180 bước/phút (phạt điểm khi thấp hơn).`, `165–180 steps/min (points deducted below this).`], [`Tài liệu [`, `Refs [`], [`Tài liệu `, `Refs `], [`Chưa có trích dẫn`, `No citation yet`], [`(cách xác định mốc chạm đất)`, `(how ground-contact events are determined)`],
    [`Chân đặt trước hông (overstride)`, `Foot ahead of hip (overstride)`], [`khoảng cách từ bàn chân đến hông theo phương ngang lúc chạm đất.`, `horizontal distance from the foot to the hip at initial contact.`],
    [`chân đặt quá xa phía trước tạo lực phanh và tăng tải gối.`, `landing too far ahead creates braking force and increases knee load.`], [`−5 đến 10 cm (phạt điểm khi lớn hơn 10 cm).`, `−5 to 10 cm (points deducted above 10 cm).`],
    [`Góc gối lúc chạm đất`, `Knee angle at initial contact`], [`độ gập của gối ngay khi bàn chân chạm đất.`, `knee flexion at the moment the foot touches down.`],
    [`gối hơi gập giúp hấp thụ lực va chạm; gối quá duỗi làm lực dồn lên khớp.`, `a slightly bent knee absorbs impact; a knee that is too straight sends the force into the joint.`],
    [`Góc cẳng chân lúc chạm đất`, `Shank angle at initial contact`], [`độ nghiêng của cẳng chân so với phương thẳng đứng lúc chạm đất.`, `tilt of the shank relative to vertical at initial contact.`],
    [`cẳng chân đưa mạnh ra trước là dấu hiệu overstride.`, `a shank thrown far forward is a sign of overstride.`],
    [`Gập gối giữa pha trụ`, `Knee flexion at mid-stance`], [`độ gập gối tối đa khi chân chống đỡ cơ thể.`, `peak knee flexion while the leg supports the body.`], [`cho biết gối hấp thụ lực nhiều hay ít.`, `shows how much force the knee absorbs.`],
    [`Độ nghiêng thân trước`, `Forward trunk lean`], [`góc thân so với phương thẳng đứng.`, `trunk angle relative to vertical.`],
    [`thân quá thẳng dễ đặt chân xa trước; gập nhiều tăng tải hông và lưng.`, `a very upright trunk makes it easy to land far ahead; a lot of lean increases hip and back load.`],
    [`độ duỗi hông khi chân đẩy rời mặt đất.`, `hip extension as the leg pushes off the ground.`], [`duỗi hạn chế có thể liên quan độ linh hoạt cơ gập hông hoặc sức mạnh mông.`, `limited extension may be related to hip flexor flexibility or glute strength.`],
    [`thời gian bàn chân tiếp xúc mặt máy mỗi bước.`, `how long the foot stays on the belt in each step.`], [`chạm đất lâu thường kèm bước dài và phanh.`, `long ground contact usually goes with long strides and braking.`],
    [`200–300 ms (ước lượng, chưa kiểm chứng).`, `200–300 ms (estimate, not validated).`],
    [`Cân bằng trái–phải`, `Left–right balance`], [`độ lệch nhịp bước và thời gian chạm đất giữa hai chân.`, `difference in step rhythm and ground contact time between the two legs.`],
    [`hai chân khác nhau nhiều có thể do mệt, yếu một bên hoặc né đau.`, `a large difference between the legs may be due to fatigue, one-sided weakness or avoiding pain.`],
    [`lệch nhịp dưới 4%, lệch thời gian chạm đất dưới 8% (ước lượng, chưa kiểm chứng).`, `cadence asymmetry under 4%, contact time asymmetry under 8% (estimate, not validated).`],
    [`Khoảng tham khảo chỉ mang tính tham khảo, chưa phải chuẩn y khoa; giá trị ở khoảng 10 km/h trên máy chạy. Nếu quay thêm góc sau lưng, app còn đo sụt hông và gối đổ vào trong (ngưỡng tạm, đang chờ bác sĩ duyệt).`, `Reference ranges are a guide only, not a medical standard; values are for about 10 km/h on a treadmill. If you also record a rear view, the app measures hip drop and knee valgus (provisional thresholds, awaiting doctor review).`],
    [`Kết quả mẫu`, `Sample results`], [`Nhịp chạy tốt (172 bước/phút), gối chạm đất tốt (25°). Nên bước ngắn lại một chút, đặt chân gần dưới hông.`, `Good cadence (172 steps/min), good knee angle at initial contact (25°). A slightly shorter stride, landing closer under the hip, would help.`],
    [`Nhịp hơi thấp (162 bước/phút), chân đặt xa trước hông (28 cm).`, `Slightly low cadence (162 steps/min), foot lands far ahead of the hip (28 cm).`],
    [`Nhịp thấp (144 bước/phút), chân đặt xa trước hông (27 cm), nên tăng nhịp.`, `Low cadence (144 steps/min), foot lands far ahead of the hip (27 cm); raise your cadence.`],
    [`Cả ba mẫu là ảnh người que từ dữ liệu giả lập, không phải người thật.`, `All three samples are stick-figure images from simulated data, not real people.`],
    [`Câu hỏi thường gặp`, `FAQ`], [`Có cần gắn cảm biến không?`, `Do I need to wear sensors?`], [`Không, AI chỉ cần video.`, `No, the AI only needs video.`],
    [`Video có được gửi đi đâu không?`, `Is the video sent anywhere?`], [`Phân tích ngay trên máy đo; chỉ kết quả được lưu để bác sĩ theo dõi.`, `It is analysed right on the measuring computer; only the results are stored so the doctor can follow up.`],
    [`Kết quả có chính xác không?`, `Is the result accurate?`], [`Đây là công cụ sàng lọc, giúp phát hiện dấu hiệu cần chú ý; không thay thế khám và chẩn đoán của bác sĩ.`, `This is a screening tool that helps spot signs worth attention; it does not replace a doctor's examination and diagnosis.`],
    [`Cơ sở khoa học`, `Scientific basis`], [`Tài liệu tham khảo`, `References`], [`Xem thêm`, `See more`],
    [`App dựa trên phân tích video 2D nhìn từ mặt bên: AI nhận dạng khung xương, rồi xác định mốc chạm đất theo động học của chân. Các chỉ số được chọn theo y văn về cơ học chạy bộ. Khoảng tham khảo trong app chưa phải chuẩn y khoa.`, `The app is based on 2D video analysis from the side: AI recognises the skeleton, then determines ground-contact events from the leg's kinematics. The metrics are chosen from the literature on running biomechanics. The reference ranges in the app are not a medical standard.`],
    [`Hỗ trợ: tăng nhịp 5–10% giảm tải gối, hông.`, `Supports: raising cadence by 5–10% reduces knee and hip load.`], [`Hỗ trợ: nhịp chạy, độ dài bước.`, `Supports: cadence and stride length.`],
    [`Hỗ trợ: chân đặt trước hông, góc cẳng chân và góc gối lúc chạm đất.`, `Supports: foot ahead of hip, shank angle and knee angle at initial contact.`],
    [`Hỗ trợ: quy trình quay video và các chỉ số nhìn từ mặt bên.`, `Supports: the video recording protocol and side-view metrics.`], [`Hỗ trợ: độ tin cậy của phân tích video.`, `Supports: reliability of video analysis.`],
    [`Hỗ trợ: video 2D thấy khác biệt (hông/khung chậu giữa pha trụ) giữa người có và không đau gối.`, `Supports: 2D video shows differences (hip/pelvis in mid-stance) between runners with and without knee pain.`],
    [`Hỗ trợ: kiểu tiếp đất của bàn chân.`, `Supports: foot strike pattern.`], [`Hỗ trợ: xác định mốc chạm đất.`, `Supports: determining ground-contact events.`], [`Hỗ trợ: mô hình nhận dạng tư thế của MediaPipe.`, `Supports: MediaPipe's pose estimation model.`],
    [`Đăng ký đo thử`, `Book a trial test`],
    [`Kết quả mẫu Người chạy A: 76 điểm, hạng Tốt`, `Sample result, Runner A: 76 points, rank Good`], [`Kết quả mẫu Người chạy B: 62 điểm, hạng Khá`, `Sample result, Runner B: 62 points, rank Fair`], [`Kết quả mẫu Người chạy C: 53 điểm, hạng Cần cải thiện`, `Sample result, Runner C: 53 points, rank Needs work`],
    [`Hạng Khá · `, `Rank Fair · `], [`Hạng Tốt · `, `Rank Good · `], [`/100`, `/100`],
    ["Số bước mỗi phút, nhịp hợp lý giúp giảm lực dồn lên gối.", "Steps per minute; a sensible cadence reduces the load on the knees."],
    ["Đặt chân quá xa phía trước dễ \"phanh\", tăng tải gối.", "Landing the foot too far ahead tends to \"brake\" and increases knee load."],
    ["Gối hơi gập giúp hấp thụ lực tốt hơn.", "A slightly bent knee absorbs force better."],
    ["Độ nghiêng thân", "Trunk lean"],
    ["Góc sau lưng (nếu quay)", "Rear view (if filmed)"],
    ["Sụt hông, gối đổ vào trong.", "Hip drop, knee collapsing inward."],
    ["dựa trên chân trái; chân phải chưa đủ tin cậy", "based on the left leg; the right leg is not reliable enough"],
    ["dựa trên chân phải; chân trái chưa đủ tin cậy", "based on the right leg; the left leg is not reliable enough"],
    ["Gối ", "Knee "],
    ["App đo những gì", "What the app measures"],
    ["Camera giả (mock)", "Mock camera"],
    [" phút chạy.", " min of running."],
    // ===== Từ ghép còn lại =====
    [` giây`, ` s`], [` phút`, ` min`], [`khung hình`, `frames`]
  ];

  var lang = 'vi';
  try { var sv = localStorage.getItem(KEY); if (sv === 'en' || sv === 'vi') lang = sv; } catch (e) { /* trình duyệt chặn storage: dùng mặc định */ }

  // ---- Bộ dịch: một regex, khoá dài trước; biên từ chỉ kiểm khi mép khoá là chữ cái ----
  var MAP = new Map(), keys = [];
  DICT.forEach(function (p) { if (!MAP.has(p[0])) keys.push(p[0]); MAP.set(p[0], p[1]); });
  keys.sort(function (a, b) { return b.length - a.length; });
  var LET = /[\p{L}\p{N}]/u;
  var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); };
  var RE = new RegExp(keys.map(function (k) {
    var a = LET.test(k[0]) ? '(?<![\\p{L}\\p{N}])' : '', b = LET.test(k[k.length - 1]) ? '(?![\\p{L}\\p{N}])' : '';
    return a + esc(k) + b;
  }).join('|'), 'gu');
  var cache = new Map();
  function t(s) {
    if (lang !== 'en' || typeof s !== 'string' || !s) return s;
    var r = cache.get(s);
    if (r === undefined) { r = s.replace(/^Cao (?=[0-9])/, "Height ").replace(RE, function (m) { return MAP.get(m); }); if (cache.size > 4000) cache.clear(); cache.set(s, r); }
    return r;
  }

  // ---- DOM ----
  var H1 = { 'Đánh giá': 'Running gait', 'dáng chạy': 'assessment' };   // h1 trang chính: "Đánh giá" ở đây không phải cột "Rating"
  var labelled = new WeakSet();
  function skipEl(p) { return p.closest && p.closest('[data-i18n-skip],script,style'); }
  function tx(node) {
    var p = node.parentNode; if (!p || !/\S/.test(node.data) || skipEl(p)) return;
    if (p.nodeName === 'OPTION') {   // không đổi text (vì <option> không có value thì value = text): đặt label
      if (p.parentNode && p.parentNode.id === 'camsel' && node.data !== 'Camera giả (mock)') return;   // tên camera thật giữ nguyên
      var e1 = t(node.data); if (e1 !== node.data) { p.label = e1; labelled.add(p); } else if (labelled.has(p)) { p.removeAttribute('label'); labelled.delete(p); }
      return;
    }
    if (node.__en !== undefined && node.data === node.__en) return;
    var vi = node.data, en = (p.nodeName === 'H1' && H1[vi.trim()]) || t(vi);
    if (en !== vi) { node.__vi = vi; node.__en = en; node.data = en; } else node.__en = undefined;
  }
  function untx(node) {
    var p = node.parentNode;
    if (p && p.nodeName === 'OPTION') { if (labelled.has(p)) { p.removeAttribute('label'); labelled.delete(p); } return; }
    if (node.__en !== undefined && node.data === node.__en) node.data = node.__vi;
    node.__en = undefined;
  }
  var ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];
  function at(el, restore) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i]; if (!el.hasAttribute(a)) continue;
      var st = el.__ia || (el.__ia = {}), cur = el.getAttribute(a), s = st[a];
      if (restore) { if (s && cur === s.en) el.setAttribute(a, s.vi); delete st[a]; continue; }
      if (s && cur === s.en) continue;
      var en = t(cur); if (en !== cur) { st[a] = { vi: cur, en: en }; el.setAttribute(a, en); } else delete st[a];
    }
  }
  function walk(root, restore) {
    if (root.nodeType === 3) { restore ? untx(root) : tx(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (skipEl(root)) return; at(root, restore); }
    var tw = document.createTreeWalker(root, 5 /* element + text */), n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) restore ? untx(n) : tx(n);
      else at(n, restore);
    }
  }
  var obs = null;
  function startObs() {
    if (obs || !window.MutationObserver) return;
    obs = new MutationObserver(function (ms) {
      if (lang !== 'en') return;
      ms.forEach(function (m) {
        if (m.type === 'characterData') tx(m.target);
        else if (m.type === 'attributes') at(m.target);
        else m.addedNodes.forEach(function (n) { walk(n); });
      });
    });
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // ---- Canvas: ảnh kết quả, trang PDF ----
  var CP = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (CP) {
    ['fillText', 'strokeText'].forEach(function (fn) {
      var o = CP[fn]; CP[fn] = function (text) { arguments[0] = t(text); return o.apply(this, arguments); };
    });
    var om = CP.measureText; CP.measureText = function (text) { return om.call(this, t(text)); };
  }
  // ---- alert / confirm ----
  var oa = window.alert, oc = window.confirm;
  window.alert = function (m) { return oa.call(window, t(String(m))); };
  window.confirm = function (m) { return oc.call(window, t(String(m))); };

  function paintToggle() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang]').forEach(function (b) { var on = b.getAttribute('data-lang') === lang; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }
  function set(l, silent) {
    if (l !== 'en' && l !== 'vi') return;
    var was = lang; lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) { /* không lưu được: chỉ áp dụng trong phiên này */ }
    paintToggle();
    if (was !== l || silent) {
      if (l === 'en') { startObs(); walk(document); } else walk(document, true);
      if (!silent) window.dispatchEvent(new Event('langchange'));
    }
  }

  window.I18N = { t: t, set: set, get: function () { return lang; } };
  function init() {
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.addEventListener('click', function () { set(b.getAttribute('data-lang')); }); });
    paintToggle();
    if (lang === 'en') { startObs(); walk(document); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
