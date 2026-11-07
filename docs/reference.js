/* Khoảng tham chiếu thực hành ở ~10 km/h. Bác sĩ chỉnh lo/hi và nhận xét tại đây.
 * Các chỉ số GÓC SAU LƯNG ở cuối (có "tam": true) là ngưỡng tạm, CHỜ BÁC SĨ DUYỆT. */
window.GAIT_REF = {
  "metrics": {
    "cadence": {
      "label": "Cadence",
      "unit": "bước/phút",
      "lo": 165,
      "hi": 180,
      "src": "Heiderscheit 2011; Garmin/Polar running dynamics",
      "low": "Cadence thấp: bước dài, thường kèm tiếp đất xa trước thân. Tăng 5-10% có thể giảm tải khớp gối/hông.",
      "high": "Cadence cao hơn khoảng thông thường: thường không đáng lo, xem cùng độ dài bước."
    },
    "vert_osc": {
      "label": "Nhấp nhô (hông)",
      "unit": "cm",
      "lo": 6.0,
      "hi": 10.0,
      "src": "Garmin running dynamics; Cavanagh 1985",
      "low": "Nhấp nhô thấp: dáng chạy 'phẳng', thường tốt.",
      "high": "Nhấp nhô cao: tốn năng lượng nâng cơ thể, tăng lực va chạm mỗi bước."
    },
    "trunk": {
      "label": "Nghiêng thân trước",
      "unit": "°",
      "lo": 4,
      "hi": 10,
      "src": "Folland 2017",
      "low": "Thân quá thẳng/ngả sau: dễ tiếp đất xa trước thân.",
      "high": "Thân gập trước nhiều: tăng tải hông/lưng, xem lại gập từ hông hay gập lưng."
    },
    "knee_ic": {
      "label": "Gập gối lúc chạm đất",
      "unit": "°",
      "lo": 10,
      "hi": 25,
      "src": "Moore 2016 (review)",
      "low": "Gối quá duỗi lúc chạm đất: tăng lực va chạm.",
      "high": "Gối gập nhiều lúc chạm đất: cần cơ tứ đầu hoạt động nhiều hơn."
    },
    "shank_ic": {
      "label": "Góc cẳng chân lúc chạm",
      "unit": "°",
      "lo": 0,
      "hi": 12,
      "src": "Moore 2016; Lieberman 2010",
      "low": "Cẳng chân thẳng đứng/ra sau: tiếp đất dưới trọng tâm (tốt).",
      "high": "Cẳng chân đưa mạnh ra trước: dấu hiệu overstride, tăng lực phanh."
    },
    "overstride": {
      "label": "Bàn chân trước hông lúc chạm",
      "unit": "cm",
      "lo": -5,
      "hi": 10,
      "src": "Ước lượng thực hành",
      "low": "Chạm đất sau/ngay dưới hông.",
      "high": "Chạm đất xa phía trước hông: overstride, giảm cadence thường giúp cải thiện."
    },
    "knee_mid": {
      "label": "Gập gối tối đa (đứng)",
      "unit": "°",
      "lo": 30,
      "hi": 50,
      "src": "Novacheck 1998",
      "low": "Gối ít gập khi chịu tải: giảm hấp thụ lực.",
      "high": "Gối gập sâu khi chịu tải: cần nhiều sức mạnh cơ đùi."
    },
    "hip_ext": {
      "label": "Duỗi hông lúc rời đất",
      "unit": "°",
      "lo": 5,
      "hi": 20,
      "src": "Novacheck 1998",
      "low": "Duỗi hông hạn chế: xem độ linh hoạt cơ gập hông / sức mạnh mông.",
      "high": "Duỗi hông nhiều: có thể kèm ưỡn lưng bù trừ."
    },
    "knee_swing": {
      "label": "Gập gối tối đa (đưa chân)",
      "unit": "°",
      "lo": 90,
      "hi": 120,
      "src": "Novacheck 1998",
      "low": "Gót lên thấp: bước chân 'lê', thường pace chậm.",
      "high": "Gót hất cao: nhiều năng lượng cho giai đoạn đưa chân."
    },
    "contact_ms": {"label": "Thời gian chạm đất", "unit": "ms", "lo": 200, "hi": 300, "src": "ước lượng, chưa kiểm chứng", "low": "Chạm đất ngắn: thường gặp ở người chạy nhanh, nhẹ chân.", "high": "Chạm đất lâu: bàn chân 'dính' mặt đường, thường kèm bước dài/phanh."},
    "flight_ms": {"label": "Thời gian bay", "unit": "ms", "lo": null, "hi": null, "src": "tham khảo"},
    "duty": {"label": "Tỉ lệ chạm đất / bước", "unit": "%", "lo": null, "hi": null, "src": "tham khảo"},
    "step_cv": {"label": "Độ đều nhịp bước (dao động)", "unit": "%", "lo": 0, "hi": 3, "src": "ước lượng, chưa kiểm chứng", "high": "Nhịp bước chưa đều: có thể do mệt, chưa quen máy chạy hoặc mất cân bằng."},
    "step_asym": {"label": "Lệch nhịp trái–phải", "unit": "%", "lo": 0, "hi": 4, "src": "ước lượng, chưa kiểm chứng", "high": "Hai chân bước không đều nhau: nên khám lâm sàng nếu kèm đau một bên."},
    "contact_asym": {"label": "Lệch thời gian chạm đất trái–phải", "unit": "%", "lo": 0, "hi": 8, "src": "ước lượng, chưa kiểm chứng", "high": "Hai chân chạm đất lâu mỏng khác nhau: có thể một bên yếu hoặc đang né đau."},
    "hip_flex": {"label": "Nâng đùi tối đa", "unit": "°", "lo": 25, "hi": 50, "src": "ước lượng, chưa kiểm chứng", "low": "Nâng gối thấp: bước 'lê', cơ gập hông có thể yếu.", "high": "Nâng gối cao: tốn năng lượng, thường ở tốc độ nhanh."},
    "heel_kick": {"label": "Gót hất ra sau (cao so với mặt đất)", "unit": "cm", "lo": null, "hi": null, "src": "tham khảo"},
    "arm_swing": {"label": "Biên độ vung tay", "unit": "°", "lo": null, "hi": null, "src": "tham khảo"},
    "elbow": {"label": "Góc gập khuỷu", "unit": "°", "lo": null, "hi": null, "src": "tham khảo"},
    "head_fwd": {"label": "Đầu nghiêng trước", "unit": "°", "lo": null, "hi": null, "src": "tham khảo"},
    // ===== GÓC SAU LƯNG (gait.js computeBack). NGƯỠNG TẠM do máy đặt, CHỜ BÁC SĨ DUYỆT; "tam": true để giao diện ghi chú. =====
    "pelvic_drop": {"label": "Sụt hông bên không trụ", "unit": "°", "lo": -3, "hi": 6, "tam": true, "src": "TẠM, chờ bác sĩ duyệt (tham khảo Bramah 2018)", "low": "Hông bên không trụ nâng lên khi chống chân: ít gặp, xem lại cách đặt máy quay.", "high": "Hông bên không trụ tụt nhiều khi chống chân: cơ mông nhỡ (cơ dạng hông) bên trụ có thể yếu."},
    "knee_valgus": {"label": "Gối đổ vào trong (nhìn từ sau)", "unit": "°", "lo": -5, "hi": 10, "tam": true, "src": "TẠM, chờ bác sĩ duyệt (góc hông–gối–cổ chân 2D)", "low": "Gối choãi ra ngoài khi chống chân.", "high": "Gối đổ vào trong khi chống chân: tăng tải mặt trước/trong gối, xem sức mạnh mông và kiểm soát gối."},
    "foot_mid": {"label": "Bàn chân so với đường giữa", "unit": "cm", "lo": 0, "hi": 10, "tam": true, "src": "TẠM, chờ bác sĩ duyệt", "low": "Bàn chân đặt chéo qua đường giữa (chạy như trên dây): tăng tải dải chậu chày, mặt trong cẳng chân.", "high": "Bàn chân đặt xa đường giữa: bước dạng rộng."},
    "step_width": {"label": "Độ rộng bước", "unit": "cm", "lo": 0, "hi": 15, "tam": true, "src": "TẠM, chờ bác sĩ duyệt", "low": "Hai bàn chân đặt chéo nhau.", "high": "Bước dạng rộng: thân dễ lắc ngang."},
    "lat_trunk": {"label": "Thân lắc ngang", "unit": "°", "lo": 0, "hi": 10, "tam": true, "src": "TẠM, chờ bác sĩ duyệt", "high": "Thân lắc sang hai bên nhiều: có thể bù cho hông yếu, tốn năng lượng."}
  }
};
