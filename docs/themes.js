/* themes.js - bảng giao diện (màu + font). Thêm giao diện cho đơn hàng mới: thêm 1 phần tử vào THEMES.
   id: khóa lưu localStorage; label: nhãn trong menu; vars: biến CSS đặt lên :root (khóa bỏ "--");
   cv: màu cho canvas/ảnh/PDF trong app.js; font: font chữ; fontUrl: CSS Google Fonts, chỉ nạp khi chọn giao diện đó.
   Màu trạng thái (Tốt/Khá/Cần cải thiện, chân trái/phải) KHÔNG đổi theo giao diện vì mang ý nghĩa dữ liệu. */
(function () {
  'use strict';
  var SYS = '"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif';
  var KEY = 'ck_theme';
  var THEMES = [
    {
      id: 'xanh', label: 'Xanh lá',
      font: SYS,
      vars: {
        'moss': '#1F4D2B', 'moss2': '#2A6A3B', 'moss3': '#3B7D4A', 'moss-rgb': '31,77,43', 'moss2-rgb': '42,106,59',
        'leaf': '#A9D69B', 'leaf-soft': '#E3F1DC', 'leaf-pale': '#F3F9F0', 'ink': '#1B1F1C', 'mut': '#5C685F', 'line': '#DCE6D8',
        'bg': '#F3F9F0', 'on-dark-mut': '#CFE6C8', 'shadow': 'rgba(31,77,43,.14)', 'teal2': '#3E9A4F', 'teal3': '#2E7D3F',
        'fline': '#C5D4C0', 'fbg': '#FAFDF8', 'dash': '#8FB088', 'dis': '#B9CDB4', 'dk': '8,19,11', 'dk2': '20,40,25',
        'nav-bg': '#fff', 'nav-ink': '#1B1F1C', 'nav-hover': '#E3F1DC', 'nav-hover-ink': '#1F4D2B', 'nav-line': '#DCE6D8', 'nav-logo': '#1F4D2B', 'title': '#1F4D2B', 'title2': '#2A6A3B'
      },
      cv: { brand: '#1F4D2B', brand2: '#2A6A3B', soft: '#E3F1DC', pale: '#F3F9F0', accent: '#A9D69B', shadow: 'rgba(31,77,43,.12)', ink: '#1B1F1C', mut: '#5C685F' }
    }
  ];
  var byId = {}; THEMES.forEach(function (t) { byId[t.id] = t; });
  var listeners = [];
  var T = {
    list: THEMES, id: THEMES[0].id,
    cv: {},        // màu canvas của giao diện đang chọn (đối tượng sống, đổi tại chỗ)
    font: SYS,     // font canvas
    onChange: function (fn) { listeners.push(fn); }
  };

  function lsGet() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function lsSet(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* chế độ riêng tư/chặn lưu: bỏ qua */ } }
  function fire() { listeners.forEach(function (f) { try { f(T); } catch (e) { /* bỏ qua */ } }); }

  function loadFont(t) {
    if (!t.fontUrl) return;
    if (!document.getElementById('themefont-' + t.id)) {
      var l = document.createElement('link'); l.id = 'themefont-' + t.id; l.rel = 'stylesheet'; l.href = t.fontUrl;
      document.head.appendChild(l);
    }
    // canvas cần font đã nạp: nạp xong thì báo vẽ lại (không có mạng thì dùng font dự phòng)
    if (document.fonts && document.fonts.load) {
      Promise.all(['500', '600', '700', '800', '900'].map(function (w) { return document.fonts.load(w + ' 20px Montserrat', 'Aăâêôơư'); }))
        .then(function () { if (T.id === t.id) fire(); })
        .catch(function () { /* không có mạng: giữ font dự phòng */ });
    }
  }

  function apply(id, save) {
    var t = byId[id] || THEMES[0];
    T.id = t.id; T.font = t.font;
    var st = document.documentElement.style;
    Object.keys(t.vars).forEach(function (k) { st.setProperty('--' + k, t.vars[k]); });
    st.setProperty('--font', t.font);
    Object.keys(t.cv).forEach(function (k) { T.cv[k] = t.cv[k]; });
    document.documentElement.setAttribute('data-theme', t.id);
    if (save) lsSet(t.id);
    loadFont(t);
    syncMenu();
    fire();
  }
  T.set = function (id) { apply(id, true); };

  // ---- nút + menu chọn giao diện ----
  var menu = null, btn = null;
  function syncMenu() {
    if (!menu) return;
    Array.prototype.forEach.call(menu.querySelectorAll('button'), function (b) {
      var on = b.dataset.theme === T.id; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }
  function closeMenu() { if (menu) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } }
  function openMenu() {
    var r = btn.getBoundingClientRect();
    menu.style.top = (r.bottom + 6) + 'px'; menu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
    menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
  }
  function build() {
    var nav = document.getElementById('topnav'); if (!nav || document.getElementById('themebtn') || THEMES.length < 2) return;   // chỉ một giao diện thì ẩn nút
    var css = document.createElement('style');
    css.textContent =
      '#themebtn{height:36px;padding:0 16px;margin-left:auto;font:inherit;font-size:15px;font-weight:600;border:0;border-radius:999px;background:transparent;color:var(--nav-ink);cursor:pointer;display:inline-flex;align-items:center;gap:8px;flex-shrink:0;white-space:nowrap}' +
      '#themebtn:hover,#themebtn[aria-expanded=true]{background:var(--nav-hover);color:var(--nav-hover-ink)}' +
      '#themebtn i{width:14px;height:14px;border-radius:50%;background:var(--moss);border:2px solid var(--nav-ink);display:inline-block}' +
      '#thememenu{position:fixed;z-index:200;min-width:190px;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:6px}' +
      '#thememenu[hidden]{display:none}' +
      '#thememenu button{display:flex;align-items:center;gap:10px;width:100%;height:40px;padding:0 12px;border:0;border-radius:10px;background:transparent;color:var(--ink);font:inherit;font-size:15px;font-weight:600;text-align:left;cursor:pointer}' +
      '#thememenu button:hover{background:var(--leaf-soft);color:var(--moss)}' +
      '#thememenu button.on{background:var(--moss);color:#fff}' +
      '#thememenu button i{width:16px;height:16px;border-radius:50%;flex:none;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)}';
    document.head.appendChild(css);
    btn = document.createElement('button'); btn.id = 'themebtn'; btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<i></i><span>Giao diện</span>';
    menu = document.createElement('div'); menu.id = 'thememenu'; menu.hidden = true; menu.setAttribute('role', 'menu');
    THEMES.forEach(function (t) {
      var b = document.createElement('button'); b.type = 'button'; b.dataset.theme = t.id; b.setAttribute('role', 'menuitemradio');
      b.innerHTML = '<i style="background:' + t.vars.moss + '"></i><span>' + t.label + '</span>';
      b.addEventListener('click', function () { T.set(t.id); closeMenu(); });
      menu.appendChild(b);
    });
    btn.addEventListener('click', function (e) { e.stopPropagation(); if (menu.hidden) openMenu(); else closeMenu(); });
    document.addEventListener('click', function (e) { if (!menu.contains(e.target)) closeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    window.addEventListener('resize', closeMenu);
    // screening.html: chèn trước #syncst (cuối thanh trên); index.html: cuối thanh trên
    var anchor = document.getElementById('syncst');
    if (anchor && anchor.parentNode === nav) nav.insertBefore(btn, anchor); else nav.appendChild(btn);
    document.body.appendChild(menu);
    syncMenu();
  }

  window.Themes = T;
  var saved = lsGet();
  apply(byId[saved] ? saved : THEMES[0].id, false);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
