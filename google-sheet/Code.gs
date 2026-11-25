// Google Apps Script: nhận kết quả từ app Sàng lọc dáng chạy (bản 25/11/2026).
// Ghi vào tab "Kết quả" (tự tạo nếu chưa có) với đúng 6 cột, theo thứ tự:
//   Họ tên | SĐT/Zalo | Thời gian scan | Kết quả rút gọn | PDF | Mã
// - PDF: file PDF kết quả chi tiết lưu vào thư mục Drive FOLDER_NAME, ô hiện chữ "📄 Mở PDF" bấm là mở.
//   Tên file do app đặt: tên khách + ngày đo (vd "Hồ Phương 25-11-2026.pdf").
// - Mã: khoá của khách. Gửi lại cùng Mã thì ghi đè dòng cũ và thay file PDF cũ của chính dòng đó (không xoá file khác trùng tên).
// Payload (POST, text/plain JSON): { headers: [...], rows: [[...]], files: [[{name, mime, b64}, ...]] }
// Các tab cũ (dữ liệu nhiều cột trước đây) giữ nguyên, không bị sửa.
var SHEET_ID = '1HbknKhSQ1VpO6J11HzoLZMF1TYDDXtCsnUzV2dYw-0U';
var FOLDER_NAME = 'Chạy khỏe – Kết quả';
var TAB = 'Kết quả';
var COLS = ['Họ tên', 'SĐT/Zalo', 'Thời gian scan', 'Kết quả rút gọn', 'PDF', 'Mã'];
var WIDTHS = [180, 130, 140, 520, 110, 90];

function folder_() {
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

// Tab "Kết quả" với dòng tiêu đề cố định (tạo mới hoặc dựng lại tiêu đề nếu đang trống).
function sheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(TAB);
  if (!sh) { sh = ss.insertSheet(TAB, 0); }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold').setBackground('#1f4d2b').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    WIDTHS.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
    sh.getRange(2, 4, sh.getMaxRows() - 1, 1).setWrap(true);   // cột Kết quả rút gọn: xuống dòng
    sh.getRange(2, 2, sh.getMaxRows() - 1, 1).setNumberFormat('@'); // SĐT giữ số 0 đầu
  }
  return sh;
}

// Ô PDF: chữ "📄 Mở PDF" đậm, bấm là mở file.
function pdfCell_(cell, url) {
  if (!url) return;
  cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText('📄 Mở PDF').setLinkUrl(url).build())
    .setFontSize(12).setFontWeight('bold');
}

function findRow_(sh, id) {
  var col = COLS.indexOf('Mã') + 1;
  if (id === '' || id == null || sh.getLastRow() < 2) return 0;
  var ids = sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues();
  for (var k = 0; k < ids.length; k++) if (String(ids[k][0]) === String(id)) return k + 2;
  return 0;
}

function fileIdFromUrl_(url) { var m = /\/d\/([^/?#]+)/.exec(url || ''); return m ? m[1] : ''; }

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var d = JSON.parse(e.postData.contents);
    var sh = sheet_();
    var hdr = d.headers || [];
    var pc = COLS.indexOf('PDF');
    (d.rows || []).forEach(function (r, i) {
      var get = function (h) { var k = hdr.indexOf(h); return k < 0 || r[k] == null ? '' : r[k]; };
      var id = get('Mã');
      var at = findRow_(sh, id);
      var oldUrl = '';
      if (at) { var rt = sh.getRange(at, pc + 1).getRichTextValue(); oldUrl = (rt && rt.getLinkUrl()) || ''; }
      var pdfUrl = oldUrl;
      ((d.files || [])[i] || []).forEach(function (f) {
        if (!/pdf/i.test(f.mime)) return;
        var file = folder_().createFile(Utilities.newBlob(Utilities.base64Decode(f.b64), f.mime, f.name));
        // thay PDF cũ của chính dòng này (gửi lại cùng khách), không đụng file khác trùng tên
        var oid = fileIdFromUrl_(oldUrl);
        if (oid) { try { DriveApp.getFileById(oid).setTrashed(true); } catch (err) { /* file cũ đã xoá */ } }
        pdfUrl = file.getUrl();
      });
      var vals = COLS.map(function (h) { return h === 'PDF' ? '' : get(h); });
      if (!at) at = sh.getLastRow() + 1;
      sh.getRange(at, 1, 1, COLS.length).setValues([vals]);
      sh.getRange(at, 2).setNumberFormat('@').setValue(String(get('SĐT/Zalo')));
      pdfCell_(sh.getRange(at, pc + 1), pdfUrl);
    });
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return ContentService.createTextOutput('Gait sheet ok'); }

// Chạy tay một lần trong trình soạn Apps Script để cấp quyền Sheet + Drive và tạo tab "Kết quả".
function authorize() { sheet_().getName(); folder_().getName(); }
