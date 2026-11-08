// Build blog tĩnh: content/blog/*.md -> docs/blog/<slug>/index.html, docs/blog/index.html, docs/sitemap.xml, docs/robots.txt.
// Chạy: node scripts/build-blog.mjs   (không phụ thuộc gói ngoài; file bắt đầu bằng "_" bị bỏ qua).
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://chay-khoe-docs.vercel.app';   // đổi tên miền: sửa đúng dòng này rồi build lại
const AUTHOR_URL = 'https://bacsikien.com';
const SITE_NAME = 'Hanoi Running Lab';
const CLUSTERS = { 'dang-chay': 'Dáng chạy', 'chan-thuong': 'Chấn thương' };   // thứ tự hiển thị

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'content', 'blog');
const OUT = join(ROOT, 'docs', 'blog');
const STATIC_PAGES = ['', 'screening/huong-dan.html', 'screening/chi-so.html', 'screening.html', 'blog/', 'thu-vien-anh/'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtDate = (d) => d.split('-').reverse().join('/');
const slugId = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'muc';

// ---------- frontmatter ----------
function parseFile(name, text) {
  const m = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(name + ': thiếu frontmatter ---');
  const fm = {};
  m[1].split('\n').forEach((l) => { const i = l.indexOf(':'); if (i > 0) fm[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^(["'])(.*)\1$/, '$2'); });
  for (const k of ['title', 'description', 'slug', 'cluster', 'date', 'updated', 'author']) if (!fm[k]) throw new Error(name + ': thiếu ' + k);
  if (!/^[a-z0-9-]+$/.test(fm.slug)) throw new Error(name + ': slug chỉ gồm a-z 0-9 -');
  if (!CLUSTERS[fm.cluster]) throw new Error(name + ': cluster phải là ' + Object.keys(CLUSTERS).join(' | '));
  for (const k of ['date', 'updated']) if (!/^\d{4}-\d{2}-\d{2}$/.test(fm[k])) throw new Error(name + ': ' + k + ' phải dạng YYYY-MM-DD');
  if (fm.description.length > 160) console.warn('CẢNH BÁO ' + name + ': description ' + fm.description.length + ' ký tự (>160)');
  fm.reviewed = fm.reviewed === 'true';
  return { fm, body: m[2] };
}

// ---------- markdown tối giản: ##/###, đoạn, - , 1. , > , **đậm**, *nghiêng*, [link](url), trích dẫn [1] ----------
function inline(raw) {
  const stash = [];
  let s = esc(raw);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    u = u.replace(/&amp;/g, '&');
    let h;
    if (/^https?:\/\//i.test(u)) h = '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + t + '</a>';
    else if (/^(\/|\.\.?\/|#|mailto:)/i.test(u)) h = '<a href="' + esc(u) + '">' + t + '</a>';
    else h = t;   // giao thức lạ (javascript:...) -> bỏ link
    stash.push(h); return '\u0000' + (stash.length - 1) + '\u0000';
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  // trích dẫn [1], [1, 2], [1–3] -> link nhảy xuống mục tài liệu
  s = s.replace(/\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g, (_, list) =>
    '[' + list.replace(/\d+/g, (n) => '<a class="cite" href="#ref-' + n + '">' + n + '</a>') + ']');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[+i]);
}

function render(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [], toc = [], used = new Set();
  let refs = null, i = 0, para = [];
  const flush = () => { if (para.length) { html.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const idFor = (t) => { let b = slugId(t), id = b, n = 2; while (used.has(id)) id = b + '-' + n++; used.add(id); return id; };
  while (i < lines.length) {
    const l = lines[i];
    let m;
    if (!l.trim()) { flush(); i++; continue; }
    if ((m = l.match(/^(#{2,3})\s+(.*)$/))) {
      flush();
      const lv = m[1].length, t = m[2].trim(), id = idFor(t);
      if (lv === 2 && /^tài liệu tham khảo$/i.test(t)) {   // gom danh sách đánh số ngay sau thành danh mục tài liệu
        toc.push({ lv, t, id });
        i++; const items = [];
        while (i < lines.length && (!lines[i].trim() || /^\d+[.)]\s+/.test(lines[i]))) { const r = lines[i].match(/^\d+[.)]\s+(.*)$/); if (r) items.push(r[1]); i++; }
        refs = { id, t, items };
        continue;
      }
      toc.push({ lv, t, id });
      html.push('<h' + lv + ' id="' + id + '">' + inline(t) + '</h' + lv + '>');
      i++; continue;
    }
    if (/^>\s?/.test(l)) {
      flush(); const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
      html.push('<blockquote><p>' + inline(q.join(' ')) + '</p></blockquote>'); continue;
    }
    if (/^[-*]\s+/.test(l) || /^\d+[.)]\s+/.test(l)) {
      flush();
      const ord = /^\d/.test(l), re = ord ? /^\d+[.)]\s+/ : /^[-*]\s+/, items = [];
      while (i < lines.length && re.test(lines[i])) {
        let t = lines[i].replace(re, ''); i++;
        while (i < lines.length && /^\s+\S/.test(lines[i]) && !re.test(lines[i])) { t += ' ' + lines[i].trim(); i++; }
        items.push(t);
      }
      html.push('<' + (ord ? 'ol' : 'ul') + '>' + items.map((t) => '<li>' + inline(t) + '</li>').join('') + '</' + (ord ? 'ol' : 'ul') + '>'); continue;
    }
    para.push(l.trim()); i++;
  }
  flush();
  return { body: html.join('\n'), toc, refs };
}

// ---------- khung trang ----------
function nav(r, active) {
  // Thanh trên dùng chung với docs/index.html, docs/screening/*, docs/thu-vien-anh/* (CSS: docs/nav.css, JS: docs/nav.js). Sửa ở đây thì sửa cả các nơi kia.
  const on = (k) => (active === k ? ' on" aria-current="page' : '');
  return '<nav id="topnav"><a class="logo" href="' + r + 'index.html"><img src="' + r + 'logo.png" alt="' + SITE_NAME + '"><b>' + SITE_NAME + '</b></a>' +
    '<div class="navlinks" id="navlinks"><a class="nv" href="' + r + 'index.html">Trang chủ</a>' +
    '<div class="nvdrop"><a class="nv go" href="' + r + 'screening/huong-dan.html">Screening</a><div class="nvmenu"><a href="' + r + 'screening/huong-dan.html">Hướng dẫn</a><a href="' + r + 'screening/chi-so.html">Các chỉ số</a><a href="' + r + 'screening.html#/">Đo ngay</a></div></div>' +
    '<a class="nv' + on('blog') + '" href="' + r + 'blog/">Kiến thức</a>' +
    '<a class="nv' + on('gal') + '" href="' + r + 'thu-vien-anh/">Thư viện ảnh</a></div>' +
    '<span id="langsw" role="group" aria-label="Language"><button type="button" data-lang="vi">VI</button><button type="button" data-lang="en">EN</button></span>' +
    '<button type="button" id="navtoggle" aria-label="Menu" aria-controls="navlinks" aria-expanded="false">☰</button></nav>';
}
function page({ r, title, desc, canonical, og, ldjson, active, main, skipTitle }) {
  return '<!doctype html>\n<html lang="vi">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title' + (skipTitle ? ' data-i18n-skip' : '') + '>' + esc(title) + '</title>\n<meta name="description" content="' + esc(desc) + '">\n<link rel="canonical" href="' + esc(canonical) + '">\n' +
    '<meta property="og:site_name" content="' + SITE_NAME + '">\n<meta property="og:locale" content="vi_VN">\n<meta property="og:type" content="' + og + '">\n' +
    '<meta property="og:title" content="' + esc(title) + '">\n<meta property="og:description" content="' + esc(desc) + '">\n<meta property="og:url" content="' + esc(canonical) + '">\n' +
    '<meta property="og:image" content="' + SITE_URL + '/logo.png">\n<meta name="twitter:card" content="summary">\n' +
    (ldjson ? '<script type="application/ld+json">' + JSON.stringify(ldjson, null, 1).replace(/</g, '\\u003c') + '</script>\n' : '') +
    '<link rel="icon" href="' + r + 'logo-128.png">\n<link rel="stylesheet" href="' + r + 'site.css">\n<link rel="stylesheet" href="' + r + 'nav.css">\n<script src="' + r + 'themes.js"></script>\n</head>\n<body>\n' +
    nav(r, active) + '\n' + main + '\n<script src="' + r + 'i18n.js"></script>\n<script src="' + r + 'nav.js"></script>\n</body>\n</html>\n';
}

function entry(p, r) {
  return '<li><a class="t" data-i18n-skip href="' + r + p.fm.slug + '/">' + esc(p.fm.title) + '</a><p data-i18n-skip>' + esc(p.fm.description) + '</p><div class="meta"><span>Cập nhật ' + fmtDate(p.fm.updated) + '</span>' +
    (p.fm.reviewed ? '' : '<span class="badge">Chờ bác sĩ duyệt</span>') + '</div></li>';
}

function articlePage(p, posts) {
  const { fm } = p, url = SITE_URL + '/blog/' + fm.slug + '/';
  const { body, toc, refs } = p.r;
  const related = posts.filter((x) => x.fm.cluster === fm.cluster && x.fm.slug !== fm.slug);
  const tocItems = toc.map((t) => '<li' + (t.lv === 3 ? ' class="s"' : '') + '><a data-i18n-skip href="#' + t.id + '">' + esc(t.t) + '</a></li>').join('');
  const main = '<main class="wrap"><div class="artwrap">\n' +
    (toc.length ? '<nav class="toc" aria-label="Mục lục"><b>Mục lục</b><ol>' + tocItems + '</ol></nav>\n' : '<div></div>\n') +
    '<article class="art" data-i18n-skip>\n<p class="crumb"><a href="../">Kiến thức</a> / ' + esc(CLUSTERS[fm.cluster]) + '</p>\n<h1>' + esc(fm.title) + '</h1>\n' +
    '<div class="artmeta"><span><span data-i18n-skip="0">Tác giả:</span> <a href="' + AUTHOR_URL + '" target="_blank" rel="noopener">' + esc(fm.author) + '</a></span>' +
    '<span>Cập nhật ' + fmtDate(fm.updated) + '</span>' + (fm.reviewed ? '' : '<span class="badge">Chờ bác sĩ duyệt</span>') + '</div>\n' +
    (fm.summary || fm.evidence ? '<aside class="abstract">' + (fm.summary ? '<b class="k">Tóm tắt</b><p>' + inline(fm.summary) + '</p>' : '') +
      (fm.evidence ? '<div class="ev"><b>Mức độ bằng chứng:</b> ' + esc(fm.evidence) + '</div>' : '') + '</aside>\n' : '') +
    '<div class="artbody">\n' + body + '\n</div>\n' +
    (refs ? '<section class="artrefs"><h2 id="' + refs.id + '">' + esc(refs.t) + '</h2><ol class="refs">' + refs.items.map((t, k) => '<li id="ref-' + (k + 1) + '">' + inline(t) + '</li>').join('') + '</ol></section>\n' : '') +
    '<p class="disclaimer">Nội dung mang tính thông tin, không thay thế khám và chẩn đoán của bác sĩ.</p>\n' +
    '<div class="tool"><span>Công cụ: đo dáng chạy bằng Screening</span><a class="btn" href="../../screening.html#/">Screening</a></div>\n' +
    (related.length ? '<section class="related"><h2>Cùng chủ đề</h2><ul class="entries">' + related.map((x) => entry(x, '../')).join('') + '</ul></section>\n' : '') +
    '</article></div>\n<footer class="sitefoot">' + SITE_NAME + ' · Kết quả và nội dung mang tính sàng lọc, tham khảo.</footer></main>';
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: fm.title, description: fm.description, inLanguage: 'vi',
    datePublished: fm.date, dateModified: fm.updated, mainEntityOfPage: url, image: SITE_URL + '/logo.png',
    author: { '@type': 'Person', name: fm.author, url: AUTHOR_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: SITE_URL + '/logo.png' } }
  };
  return page({ r: '../../', title: fm.title + ' | ' + SITE_NAME, desc: fm.description, canonical: url, og: 'article', ldjson: ld, active: 'blog', main, skipTitle: true });
}

function indexPage(posts) {
  const groups = Object.keys(CLUSTERS).map((c) => {
    const list = posts.filter((p) => p.fm.cluster === c);
    return list.length ? '<section class="cluster"><h2>' + esc(CLUSTERS[c]) + '</h2><ul class="entries">' + list.map((p) => entry(p, '')).join('') + '</ul></section>' : '';
  }).join('\n');
  const main = '<main class="wrap"><header class="listhead"><h1>Kiến thức</h1><p>Bài viết về dáng chạy và chấn thương khi chạy, có trích dẫn tài liệu. Bài chưa được bác sĩ duyệt được đánh dấu rõ.</p></header>\n' +
    (groups || '<p class="empty">Chưa có bài viết.</p>') + '\n<footer class="sitefoot">' + SITE_NAME + ' · Nội dung mang tính thông tin, không thay thế khám và chẩn đoán của bác sĩ.</footer></main>';
  return page({ r: '../', title: 'Kiến thức về dáng chạy và chấn thương | ' + SITE_NAME, desc: 'Bài viết về dáng chạy và chấn thương khi chạy bộ, có trích dẫn tài liệu tham khảo.', canonical: SITE_URL + '/blog/', og: 'website', active: 'blog', main });
}

// ---------- chạy ----------
const files = existsSync(SRC) ? readdirSync(SRC).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort() : [];
const posts = files.map((f) => { const p = parseFile(f, readFileSync(join(SRC, f), 'utf8')); p.r = render(p.body); return p; });
const seen = new Set();
posts.forEach((p) => { if (seen.has(p.fm.slug)) throw new Error('Trùng slug: ' + p.fm.slug); seen.add(p.fm.slug); });
posts.sort((a, b) => b.fm.updated.localeCompare(a.fm.updated) || a.fm.slug.localeCompare(b.fm.slug));

// xóa bài cũ đã bị bỏ (chỉ thư mục con docs/blog/*), giữ nguyên nơi khác
if (existsSync(OUT)) readdirSync(OUT, { withFileTypes: true }).forEach((d) => { if (d.isDirectory()) rmSync(join(OUT, d.name), { recursive: true, force: true }); });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), indexPage(posts));
posts.forEach((p) => { mkdirSync(join(OUT, p.fm.slug), { recursive: true }); writeFileSync(join(OUT, p.fm.slug, 'index.html'), articlePage(p, posts)); });

const urls = STATIC_PAGES.map((u) => ({ loc: SITE_URL + '/' + u })).concat(posts.map((p) => ({ loc: SITE_URL + '/blog/' + p.fm.slug + '/', mod: p.fm.updated })));
writeFileSync(join(ROOT, 'docs', 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => '  <url><loc>' + esc(u.loc) + '</loc>' + (u.mod ? '<lastmod>' + u.mod + '</lastmod>' : '') + '</url>').join('\n') + '\n</urlset>\n');
writeFileSync(join(ROOT, 'docs', 'robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: ' + SITE_URL + '/sitemap.xml\n');
console.log('Đã build ' + posts.length + ' bài, ' + urls.length + ' URL trong sitemap.');
