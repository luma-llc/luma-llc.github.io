// google-sheets-webhook.gs
//
// Setup:
// 1. Create a Google Sheet with these column headers in Row 1:
//    Timestamp | Q1 | A1 | Q2 | A2 | Q3 | A3 | Reflection | Contact Method | Contact Info
//
// 2. Open Extensions → Apps Script
// 3. Paste this code
// 4. Deploy → New Deployment → Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy the deployment URL
// 6. Set it as GOOGLE_SHEET_WEBHOOK in your Cloudflare Worker:
//    npx wrangler secret put GOOGLE_SHEET_WEBHOOK

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    data.timestamp,
    data.q1,
    data.a1,
    data.q2,
    data.a2,
    data.q3,
    data.a3,
    data.reflection,
    data.contact_method,
    data.contact_info
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}
