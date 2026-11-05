/* Đẩy kết quả từng người lên Google Sheet + Google Drive (qua Apps Script, xem google-sheet/).
 * API: window.Sync = { push(headers, row, files) -> Promise, pending() -> số, flush() -> Promise, url }
 *   headers: mảng tên cột; row: mảng giá trị; files: [{name, mime, blob}] (tự đổi base64).
 * Hàng đợi chỉ là BỘ ĐỆM TẠM: lưu trong IndexedDB (chịu được file nặng, sống qua tải lại trang),
 * gửi xong thì xóa ngay. Nếu IndexedDB không dùng được thì giữ trong bộ nhớ. Không lưu gì khác về máy.
 * ?mock=1: không gọi mạng, đẩy vào window.__mockSheet (kèm tên file), giả trễ 400ms.
 * Lưu ý: fetch no-cors không đọc được phản hồi, nên "không lỗi mạng" được coi là đã gửi. */
(function () {
  'use strict';
  var DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbxK0N65WtjztDx7akbxksT13iTNHgl_6UygkiPhnIllgONitwWsmaQZCcLLAe6-zLuy/exec';
  var DB = 'gait_sync_queue', ST = 'q';
  var Q = new URLSearchParams(location.search);
  var mem = [];          // bản trong bộ nhớ (luôn đúng); IndexedDB chỉ là bản sao để sống qua tải lại
  var db = null, seq = 0, flushing = null, timer = null, fails = 0;

  function mock() { return Q.get('mock') === '1'; }
  function url() { return Sync.url || Q.get('sheet') || DEFAULT_URL; }

  function openDb() {
    return new Promise(function (res) {
      try {
        var rq = indexedDB.open(DB, 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore(ST, { keyPath: 'id' }); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = rq.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
  }
  function tx(mode, fn) {
    return new Promise(function (res) {
      if (!db) return res();
      try { var t = db.transaction(ST, mode); fn(t.objectStore(ST)); t.oncomplete = t.onerror = t.onabort = function () { res(); }; } catch (e) { res(); }
    });
  }
  function toB64(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { var s = String(fr.result); res(s.slice(s.indexOf(',') + 1)); };
      fr.onerror = function () { rej(fr.error); };
      fr.readAsDataURL(blob);
    });
  }

  var ready = openDb().then(function (d) {
    db = d;
    if (!db) return;
    return new Promise(function (res) {
      try {
        var rq = db.transaction(ST).objectStore(ST).getAll();
        rq.onsuccess = function () {
          (rq.result || []).forEach(function (it) { if (!mem.some(function (m) { return m.id === it.id; })) mem.push(it); });
          mem.sort(function (a, b) { return a.id - b.id; });
          res();
        };
        rq.onerror = function () { res(); };
      } catch (e) { res(); }
    }).then(function () { if (mem.length) schedule(0); });
  });

  function schedule(ms) { clearTimeout(timer); timer = setTimeout(function () { Sync.flush(); }, ms); }

  async function send(it) {
    if (mock()) {
      await new Promise(function (r) { setTimeout(r, 400); });
      window.__mockSheet = (window.__mockSheet || []).concat([it.row]);
      window.__mockFiles = (window.__mockFiles || []).concat([(it.files || []).map(function (f) { return f.name; })]);
      return;
    }
    var files = [];
    for (var i = 0; i < (it.files || []).length; i++) {
      var f = it.files[i];
      files.push({ name: f.name, mime: f.mime, b64: await toB64(f.blob) });
    }
    await fetch(url(), {
      method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ headers: it.headers, rows: [it.row], files: [files] })
    });
  }

  var Sync = {
    url: '',
    pending: function () { return mem.length; },
    push: async function (headers, row, files) {
      await ready;
      var it = {
        id: Date.now() * 1000 + (seq++ % 1000), headers: headers.slice(),
        row: row.map(function (v) { return v == null ? '' : v; }),
        files: (files || []).filter(function (f) { return f && f.blob; }).map(function (f) { return { name: f.name, mime: f.mime, blob: f.blob }; })
      };
      mem.push(it);
      await tx('readwrite', function (s) { s.put(it); });   // lỗi quota/IDB: bỏ qua, vẫn còn trong bộ nhớ
      return Sync.flush();
    },
    // Gửi lần lượt từng mục; lỗi thì dừng, hẹn gửi lại (tăng dần 5s..60s) hoặc khi có mạng.
    // Trả về { sent, pending }.
    flush: function () {
      if (flushing) return flushing;
      flushing = (async function () {
        await ready;
        var sent = 0;
        while (mem.length) {
          var it = mem[0];
          try { await send(it); } catch (e) {
            fails++; schedule(Math.min(60000, 5000 * fails)); break;
          }
          fails = 0; mem.shift(); sent++;
          await tx('readwrite', function (s) { s.delete(it.id); });
        }
        return { sent: sent, pending: mem.length };
      })().finally(function () { flushing = null; });
      return flushing;
    }
  };
  window.addEventListener('online', function () { if (mem.length) schedule(0); });
  window.Sync = Sync;
})();
