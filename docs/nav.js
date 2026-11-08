/* nav.js - mở/đóng menu thu gọn trên điện thoại; Esc hoặc bấm ra ngoài thì đóng. */
(function () {
  var nav = document.getElementById('topnav'), btn = document.getElementById('navtoggle');
  if (!nav || !btn) return;
  function set(o) { nav.classList.toggle('open', o); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); }
  btn.addEventListener('click', function (e) { e.stopPropagation(); set(!nav.classList.contains('open')); });
  document.addEventListener('click', function (e) { if (!nav.contains(e.target)) set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
})();
