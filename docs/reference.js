/* Khoảng tham chiếu thực hành ở ~10 km/h. Bác sĩ chỉnh lo/hi và nhận xét tại đây.
 * lo/hi (+ "side") = khoảng TỐT. "side": "low" = chỉ có ngưỡng dưới (≥ lo), "high" = chỉ có ngưỡng trên (≤ hi), mặc định "both".
 * "warn": [dưới, trên] = mép ngoài vùng CHÚ Ý (null = không giới hạn phía đó); ngoài "warn" là BẤT THƯỜNG.
 *   Chỉ số có "warn" được score.js chấm theo thang lâm sàng mới (bác sĩ duyệt 15/11/2026, mốc cố định 8A). Trọng số/nhóm ở score.js (GROUPS).
 * "opt" (tuỳ chọn): [dưới, trên] vùng điểm 100; không ghi thì score.js tự lấy (lùi vào trong mép Tốt 1/4 bề rộng vùng Chú ý).
 * "tam": true = ngưỡng chưa có nguồn, giữ tạm (13A); giao diện ghi chữ "tạm". Các chỉ số GÓC SAU LƯNG ở cuối: tạm, chưa vào điểm. */
window.GAIT_REF = {
  "metrics": {
    "cadence": {
      "label": "Cadence",
      "unit": "bước/phút",
      "lo": 165,
      "hi": 180,
      "side": "low",
      "warn": [155, null],
      "src": "Heiderscheit 2011, Med Sci Sports Exerc, doi:10.1249/MSS.0b013e3181ebedf4",
      "low": "Cadence thấp: bước dài, thường kèm tiếp đất xa trước thân. Tăng 5-10% có thể giảm tải khớp gối/hông.",
      "high": "Cadence cao hơn khoảng thông thường: thường không đáng lo, xem cùng độ dài bước."
    },
    "vert_osc": {
      "label": "Nhấp nhô (hông)",
      "unit": "cm",
      "lo": 6.0,
      "hi": 10.0,
      "side": "high",
      "warn": [null, 12],
      "src": "Folland 2017, Med Sci Sports Exerc 49(7):1412-1423",
      "low": "Nhấp nhô thấp: dáng chạy 'phẳng', thường tốt.",
      "high": "Nhấp nhô cao: tốn năng lượng nâng cơ thể, tăng lực va chạm mỗi bước."
    },
    "trunk": {
      "label": "Nghiêng thân trước",
      "unit": "°",
      "lo": 4,
      "hi": 10,
      "warn": [0, 15],
      "src": "Folland 2017",
      "low": "Thân quá thẳng/ngả sau: dễ tiếp đất xa trước thân.",
      "high": "Thân gập trước nhiều: tăng tải hông/lưng, xem lại gập từ hông hay gập lưng."
    },
    "knee_ic": {
      "label": "Gập gối lúc chạm đất",
      "unit": "°",
      "lo": 10,
      "hi": 25,
      "warn": [5, 30],
      "src": "Moore 2016 (review)",
      "low": "Gối quá duỗi lúc chạm đất: tăng lực va chạm.",
      "high": "Gối gập nhiều lúc chạm đất: cần cơ tứ đầu hoạt động nhiều hơn."
    },
    "shank_ic": {
      "label": "Góc cẳng chân lúc chạm",
      "unit": "°",
      "lo": -5,
      "hi": 10,
      "warn": [-10, 15],
      "src": "Moore 2016; Lieberman 2010",
      "low": "Cẳng chân ngả ra sau nhiều lúc chạm đất: ít gặp, có thể do bắt sai mốc chạm đất; nên xem lại video.",
      "high": "Cẳng chân đưa mạnh ra trước: dấu hiệu overstride, tăng lực phanh."
    },
    "overstride": {
      "label": "Bàn chân trước hông lúc chạm",
      "unit": "cm",
      "lo": -5,
      "hi": 10,
      "side": "high",
      "warn": [null, 20],
      "src": "Heiderscheit 2011, Med Sci Sports Exerc, doi:10.1249/MSS.0b013e3181ebedf4; Souza 2016, PM&R Clin N Am, doi:10.1016/j.pmr.2015.08.006",
      "low": "Chạm đất sau/ngay dưới hông.",
      "high": "Chạm đất xa phía trước hông: overstride, tăng lực phanh. Tăng nhịp bước 5–10% (bước ngắn lại) thường giúp bàn chân đặt gần dưới hông hơn."
    },
    "knee_mid": {
      "label": "Gập gối tối đa (đứng)",
      "unit": "°",
      "lo": 30,
      "hi": 50,
      "warn": [25, 55],
      "src": "Novacheck 1998",
      "low": "Gối ít gập khi chịu tải: giảm hấp thụ lực.",
      "high": "Gối gập sâu khi chịu tải: cần nhiều sức mạnh cơ đùi."
    },
    "hip_ext": {
      "label": "Duỗi hông lúc rời đất",
      "unit": "°",
      "lo": 5,
      "hi": 20,
      "warn": [0, 25],
      "src": "Novacheck 1998",
      "low": "Duỗi hông hạn chế: xem độ linh hoạt cơ gập hông / sức mạnh mông.",
      "high": "Duỗi hông nhiều: có thể kèm ưỡn lưng bù trừ."
    },
    "knee_swing": {
      "label": "Gập gối tối đa (đưa chân)",
      "unit": "°",
      "lo": 90,
      "hi": 120,
      "side": "low",
      "warn": [75, null],
      "src": "Novacheck 1998",
      "low": "Gót lên thấp: bước chân 'lê', thường pace chậm.",
      "high": "Gót hất cao: nhiều năng lượng cho giai đoạn đưa chân."
    },
    "contact_ms": {"label": "Thời gian chạm đất", "unit": "ms", "lo": 200, "hi": 290, "side": "high", "warn": [null, 330], "tam": true, "src": "ước lượng, chưa kiểm chứng", "low": "Chạm đất ngắn: thường gặp ở người chạy nhanh, nhẹ chân.", "high": "Chạm đất lâu: bàn chân 'dính' mặt đường, thường kèm bước dài/phanh."},
    "flight_ms": {"label": "Thời gian bay", "unit": "ms", "lo": null, "hi": null, "src": "tham khảo"},
    "duty": {"label": "Tỉ lệ chạm đất / bước", "unit": "%", "lo": null, "hi": null, "src": "tham khảo"},
    "step_cv": {"label": "Độ đều nhịp bước (dao động)", "unit": "%", "lo": 0, "hi": 3, "side": "high", "warn": [null, 5], "tam": true, "src": "ước lượng, chưa kiểm chứng", "high": "Nhịp bước chưa đều: có thể do mệt, chưa quen máy chạy hoặc mất cân bằng."},
    "step_asym": {"label": "Lệch nhịp trái–phải", "unit": "%", "lo": 0, "hi": 4, "side": "high", "warn": [null, 8], "tam": true, "src": "ước lượng, chưa kiểm chứng", "high": "Hai chân bước không đều nhau: nên khám lâm sàng nếu kèm đau một bên."},
    "contact_asym": {"label": "Lệch thời gian chạm đất trái–phải", "unit": "%", "lo": 0, "hi": 8, "side": "high", "warn": [null, 15], "tam": true, "src": "ước lượng, chưa kiểm chứng", "high": "Hai chân chạm đất lâu mỏng khác nhau: có thể một bên yếu hoặc đang né đau."},
    "hip_flex": {"label": "Nâng đùi tối đa", "unit": "°", "lo": 25, "hi": 50, "warn": [18, 58], "tam": true, "src": "ước lượng, chưa kiểm chứng", "low": "Nâng gối thấp: bước 'lê', cơ gập hông có thể yếu.", "high": "Nâng gối cao: tốn năng lượng, thường ở tốc độ nhanh."},
    "heel_kick": {"label": "Gót hất ra sau (cao so với mặt đất)", "unit": "cm", "lo": null, "hi": null, "src": "tham khảo"},
    "arm_swing": {"label": "Biên độ vung tay", "unit": "°", "lo": null, "hi": null, "src": "tham khảo"},
    "elbow": {"label": "Góc gập khuỷu", "unit": "°", "lo": 60, "hi": 110, "warn": [45, 125], "tam": true, "src": "ước lượng, chưa kiểm chứng", "low": "Khuỷu gập sâu: tay vung ngắn, vai dễ gồng.", "high": "Khuỷu duỗi nhiều: tay vung dài, tốn năng lượng."},
    "head_fwd": {"label": "Đầu nghiêng trước", "unit": "°", "lo": 0, "hi": 20, "side": "high", "warn": [null, 30], "tam": true, "src": "ước lượng, chưa kiểm chứng", "high": "Đầu đưa ra trước vai nhiều: tăng tải cổ, thân dễ gập theo."},
    // Chênh hai chân = độ chênh trái–phải lớn nhất trong các chỉ số riêng chân, tính theo bội số ngưỡng Gait.ASYM (score.js tính, không do gait.js đo).
    "leg_asym": {"label": "Chênh hai chân", "unit": "× ngưỡng", "lo": 0, "hi": 1, "side": "high", "warn": [null, 2], "tam": true, "src": "ước lượng, chưa kiểm chứng", "high": "Hai chân khác nhau rõ ở ít nhất một chỉ số: nên khám lâm sàng nếu kèm đau một bên."},
    // ===== GÓC SAU LƯNG (gait.js computeBack). NGƯỠNG TẠM do máy đặt, CHỜ BÁC SĨ DUYỆT; "tam": true để giao diện ghi chú. =====
    "pelvic_drop": {"label": "Sụt hông bên không trụ", "unit": "°", "lo": -3, "hi": 6, "tam": true, "src": "TẠM, chờ bác sĩ duyệt (tham khảo Bramah 2018)", "low": "Hông bên không trụ nâng lên khi chống chân: ít gặp, xem lại cách đặt máy quay.", "high": "Hông bên không trụ tụt nhiều khi chống chân: cơ mông nhỡ (cơ dạng hông) bên trụ có thể yếu."},
    "knee_valgus": {"label": "Gối đổ vào trong (nhìn từ sau)", "unit": "°", "lo": -5, "hi": 10, "tam": true, "src": "TẠM, chờ bác sĩ duyệt (góc hông–gối–cổ chân 2D)", "low": "Gối choãi ra ngoài khi chống chân.", "high": "Gối đổ vào trong khi chống chân: tăng tải mặt trước/trong gối, xem sức mạnh mông và kiểm soát gối."},
    "foot_mid": {"label": "Bàn chân so với đường giữa", "unit": "cm", "lo": 0, "hi": 10, "tam": true, "src": "TẠM, chờ bác sĩ duyệt", "low": "Bàn chân đặt chéo qua đường giữa (chạy như trên dây): tăng tải dải chậu chày, mặt trong cẳng chân.", "high": "Bàn chân đặt xa đường giữa: bước dạng rộng."},
    "step_width": {"label": "Độ rộng bước", "unit": "cm", "lo": 0, "hi": 15, "tam": true, "src": "TẠM, chờ bác sĩ duyệt", "low": "Hai bàn chân đặt chéo nhau.", "high": "Bước dạng rộng: thân dễ lắc ngang."},
    "lat_trunk": {"label": "Thân lắc ngang", "unit": "°", "lo": 0, "hi": 10, "tam": true, "src": "TẠM, chờ bác sĩ duyệt", "high": "Thân lắc sang hai bên nhiều: có thể bù cho hông yếu, tốn năng lượng."}
  }
};
