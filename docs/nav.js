/* nav.js - mở/đóng menu thu gọn trên điện thoại; Esc hoặc bấm ra ngoài thì đóng. */
(function () {
  var nav = document.getElementById('topnav'), btn = document.getElementById('navtoggle');
  if (!nav || !btn) return;
  function set(o) { nav.classList.toggle('open', o); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); }
  btn.addEventListener('click', function (e) { e.stopPropagation(); set(!nav.classList.contains('open')); });
  document.addEventListener('click', function (e) { if (!nav.contains(e.target)) set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
})();
/* Nút "Screening" nổi góc dưới phải, đi theo khi cuộn dọc; luôn hiện từ đầu. */
(function () {
  var s = document.currentScript || document.querySelector('script[src$="nav.js"]');
  var root = s ? s.getAttribute('src').replace(/nav\.js.*$/, '') : '';
  var a = document.createElement('a');
  a.id = 'fabscr'; a.href = root + 'screening.html'; a.textContent = 'Screening';
  a.setAttribute('aria-label', 'Thực hiện Screening dáng chạy');
  document.body.appendChild(a);
  function upd() { a.classList.toggle('show', true); }
  window.addEventListener('scroll', upd, { passive: true }); upd();
})();
