// Google Apps Script: nhận kết quả từ app Sàng lọc dáng chạy.
// - Lưu file (PDF, ảnh PNG) vào thư mục Drive FOLDER_NAME
// - Ghi vào tab đầu tiên của Google Sheet SHEET_ID, kèm link file
// Payload (POST, text/plain JSON): { headers: [...], rows: [[...]], files: [[{name, mime, b64}, ...]] }
//   files[i] là danh sách file của rows[i] (có thể thiếu).
// Ghi theo TÊN cột: cột mới trong headers được thêm vào cuối dòng tiêu đề, không lệch dữ liệu cũ.
// Cột đầu (Mã) là khóa: gửi lại cùng Mã thì ghi đè dòng cũ và thay file cũ cùng tên.
var SHEET_ID = '1HbknKhSQ1VpO6J11HzoLZMF1TYDDXtCsnUzV2dYw-0U';
var FOLDER_NAME = 'Chạy khỏe – Kết quả';
var LINK_COLS = ['PDF', 'Ảnh kết quả'];
var PDF_AFTER = 'SĐT/Zalo';

function folder_() {
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

// Trả về dòng tiêu đề sau khi bổ sung các cột còn thiếu.
function header_(sh, want) {
  var have = sh.getLastRow() > 0 && sh.getLastColumn() > 0
    ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
  var add = want.filter(function (h) { return have.indexOf(h) < 0; });
  if (add.length) {
    sh.getRange(1, have.length + 1, 1, add.length).setValues([add]).setFontWeight('bold');
    have = have.concat(add);
  }
  // Cột PDF đứng ngay sau thông tin khách (sau SĐT/Zalo) để bấm mở luôn; sheet cũ có PDF ở cuối thì dời lên.
  var after = have.indexOf(PDF_AFTER), at = have.indexOf('PDF');
  if (after >= 0 && at >= 0 && at !== after + 1) {
    sh.moveColumns(sh.getRange(1, at + 1), after + 2);
    have.splice(at, 1);
    have.splice(after + (at > after ? 1 : 0), 0, 'PDF');
    sh.setColumnWidth(have.indexOf('PDF') + 1, 130);
  }
  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);
  return have;
}

// Ô PDF: chữ "Mở PDF" to, đậm, bấm là mở file (link gắn vào chữ, không dùng công thức để khỏi lệ thuộc dấu phân cách theo vùng).
function pdfCell_(cell, url) {
  if (!url) return;
  cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText('📄 Mở PDF').setLinkUrl(url).build())
    .setFontSize(13).setFontWeight('bold');
}

function findRow_(sh, id) {
  if (id === '' || id == null || sh.getLastRow() < 2) return 0;
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var k = 0; k < ids.length; k++) if (String(ids[k][0]) === String(id)) return k + 2;
  return 0;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var d = JSON.parse(e.postData.contents);
    var sh = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
    var names = (d.headers || []).concat(LINK_COLS);
    var head = header_(sh, names);
    var fd = null;
    (d.rows || []).forEach(function (r, i) {
      var links = { 'PDF': '', 'Ảnh kết quả': '' };
      ((d.files || [])[i] || []).forEach(function (f) {
        fd = fd || folder_();
        var old = fd.getFilesByName(f.name);
        while (old.hasNext()) old.next().setTrashed(true);
        var file = fd.createFile(Utilities.newBlob(Utilities.base64Decode(f.b64), f.mime, f.name));
        links[/pdf/i.test(f.mime) ? 'PDF' : 'Ảnh kết quả'] = file.getUrl();
      });
      var at = findRow_(sh, r[0]);
      var vals = at ? sh.getRange(at, 1, 1, head.length).getValues()[0] : head.map(function () { return ''; });
      var pc = head.indexOf('PDF'), pdfUrl = links['PDF'];
      // dòng cũ: giữ link PDF cũ (ô chữ "Mở PDF" gắn link, hoặc link trần của bản cũ)
      if (at && !pdfUrl && pc >= 0) {
        var rt = sh.getRange(at, pc + 1).getRichTextValue();
        pdfUrl = (rt && rt.getLinkUrl()) || (/^https?:/.test(String(vals[pc])) ? String(vals[pc]) : '');
      }
      (d.headers || []).forEach(function (h, k) { vals[head.indexOf(h)] = r[k] == null ? '' : r[k]; });
      LINK_COLS.forEach(function (h) { if (links[h]) vals[head.indexOf(h)] = links[h]; });
      if (!at) at = sh.getLastRow() + 1;
      sh.getRange(at, 1, 1, vals.length).setValues([vals]);
      if (pc >= 0) pdfCell_(sh.getRange(at, pc + 1), pdfUrl);
    });
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return ContentService.createTextOutput('Gait sheet ok'); }

// Chạy tay một lần trong trình soạn Apps Script để cấp quyền Sheet + Drive.
function authorize() { SpreadsheetApp.openById(SHEET_ID).getName(); folder_().getName(); }
