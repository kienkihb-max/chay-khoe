/* app/list.js - danh sách, điều hướng hash go()/route(), dữ liệu mẫu, khởi động. Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, Q, CFG, S, show, idStr, refreshL1, applySettings, startCamera, initPose, analyse, exercises,
    conclusion, improveTip, drawResult, detailHTML, finish, saveResult, openResult, makePdf } = App;
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { go });
  // ---------- Màn danh sách người đã đo ----------
  function renderList() {
    const q = $('listq').value.trim().toLowerCase(), esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const rows = S.rows.slice().reverse().filter((r) => !q || (String(r.name) + ' ' + r.phone).toLowerCase().includes(q));
    const th = 'style="text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);background:var(--leaf-pale);color:var(--moss);position:sticky;top:0"', td = 'style="padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top"';
    $('listbody').innerHTML = rows.length ? '<table style="width:100%;border-collapse:collapse;font-size:14px"><tr><th ' + th + '>Mã</th><th ' + th + '>Thời gian</th><th ' + th + '>Họ tên</th><th ' + th + '>SĐT/Zalo</th><th ' + th + '>Điểm</th><th ' + th + '>Kết luận</th></tr>' +
      rows.map((r) => '<tr data-id="' + esc(r.id) + '" style="cursor:pointer"><td ' + td + '>' + esc(r.id) + '</td><td ' + td + '>' + esc(r.time) + '</td><td ' + td + '><b data-i18n-skip>' + esc(r.name) + '</b></td><td ' + td + '>' + esc(r.phone) + '</td><td ' + td + '><b>' + esc(r.score_total) + '</b></td><td ' + td + '>' + esc(r.conclusion) + '</td></tr>').join('') + '</table>'
      : '<div style="padding:40px;text-align:center;color:var(--mut)">' + (S.rows.length ? 'Không có kết quả khớp.' : 'Chưa có ai được đo.') + '</div>';
  }
  const listMsg = (t) => { const e = $('listmsg'); e.textContent = t; e.style.display = t ? 'block' : 'none'; };
  $('tolist').addEventListener('click', () => go('#/list'));
  document.querySelectorAll('#topnav button[data-nav]').forEach((b) => b.addEventListener('click', () => {
    // Từ màn Kết quả bấm "Screening": xoá form người trước (việc trước đây của nút "Đo người tiếp theo")
    if (b.dataset.nav === '#/' && $('L3').classList.contains('show')) { ['name', 'phone', 'height', 'pain', 'note'].forEach((i) => ($(i).value = '')); $('msg1').textContent = ''; S.sess = null; }
    go(b.dataset.nav);
  }));
  $('listbody').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) go('#/result/' + encodeURIComponent(tr.dataset.id)); });

  // ---------- Đường dẫn (hash): #/ trang chính · #/list danh sách · #/result/<mã> kết quả một người ----------
  // Màn đang đo (L2) không có đường dẫn: tải lại giữa lúc đo thì về trang chính.
  function route() {
    if (S.running) return;   // đang đo: bỏ qua Back/Forward, đo xong sẽ tự sang #/result/<mã>
    const h = location.hash, m = /^#\/result\/([^/]+)$/.exec(h);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (S.result && S.result.sub.id === id && $('L3').classList.contains('show')) return;   // vừa đo xong, đã vẽ sẵn
      openResult(id); return;
    }
    if (h === '#/list') { history.replaceState(null, '', '#/'); show('L1'); refreshL1(); return; }   // 8/11: ẩn màn Danh sách (code giữ nguyên), vào bằng link thì về Screening
    show('L1'); refreshL1();
  }
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  window.addEventListener('hashchange', route);
  // đổi giao diện: vẽ lại ảnh kết quả đang giữ (các trang PDF vẽ lúc xuất nên tự theo giao diện)
  Themes.onChange(() => { if (S.result) { try { drawResult(S.result); } catch (e) { console.warn('vẽ lại kết quả', e); } } });
  // Đổi ngôn ngữ khi đang xem kết quả: vẽ lại ảnh kết quả theo ngôn ngữ mới
  window.addEventListener('langchange', () => { if (S.result && $('L3').classList.contains('show') && !S.computing) drawResult(S.result); });
  $('listq').addEventListener('input', renderList);

  // ---------- Dữ liệu mẫu (chỉ khi ?mock=1): chạy đúng đường tính như lúc đo thật trên chuỗi người que sinh sẵn ----------
  if (Q.get('mock') === '1' && window.MockData) {
    // Không còn nút trên giao diện; test gọi từ console: await window.__seed()
    window.__seed = async () => {
      if (S.running) return;
      const keep = { mode: S.mode, sp: App.SPEED };
      try {
        S.running = true; S.mode = 'file'; S.slow = 1; App.SPEED = App.SPEED0;   // 'file': bỏ kiểm tra tốc độ khung hình của camera
        for (let i = 0; i < MockData.PEOPLE.length; i++) {
          const p = MockData.PEOPLE[i];
          S.sub = { id: idStr(), name: p.name, phone: p.phone, height: p.height, pain: p.pain };
          S.frames = await MockData.frames(p, CFG.clip, CFG.fps); S.late = []; S.result = null; S.error = null; S.photosReady = false; S.take = 'side';
          analyse();
          let g = 0; while (!S.result && !S.error && g++ < 600) await new Promise((r) => setTimeout(r, 100));
          if (S.error) { alert('Không tạo được ' + p.name + ': ' + S.error); break; }
          await finish(true);
        }
      } finally { S.running = false; S.mode = keep.mode; App.SPEED = keep.sp; S.result = null; }
      go('#/list');
    };
  }

  // thử nghiệm: window.__gait cho kiểm tra tự động
  window.__gait = { S, CFG, drawResult, saveResult, makePdf, detailHTML, exercises, conclusion, improveTip };

  route();
  applySettings(false);
  startCamera();
  initPose();
})(window.App);
