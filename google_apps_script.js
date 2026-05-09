/**
 * Google Apps Script for Budget Utilization Followup
 * Paste this into Extensions > Apps Script in your Google Sheet.
 * Then click 'Deploy' > 'New Deployment' > 'Web App'.
 * Set 'Execute as' to 'Me' and 'Who has access' to 'Anyone'.
 */

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const projectNames = ['ICS-Akaki', 'Fana', 'ICS-Garment', 'ICS-Kolfe', 'ICS-Lemi Kura', 'MOH', 'Republican', '420'];
  const results = {};

  projectNames.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      const items = [];
      const categories = ['MATERIAL BUDGET', 'SUB CONTRACTOR', 'SUPPLY & FIX', 'MISCELLANEOUS', 'GRAND TOTAL'];
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const desc = String(row[1] || "").trim(); // Column B
        if (!desc || desc === "Description") continue;

        const isCategory = categories.some(cat => desc.toUpperCase().includes(cat));
        const isGrandTotal = desc.toUpperCase().includes('GRAND TOTAL') || desc.toUpperCase() === 'TOTAL';

        items.push({
          row: i + 1,
          description: desc,
          amount: parseFloat(row[5]) || 0, // Column F
          utilization: parseFloat(row[7]) || 0, // Column H
          issue: row[8] || row[9] || "", // Combine I and J
          isCategory: isCategory && !isGrandTotal,
          isTotal: isGrandTotal
        });
      }
      results[name] = { items: items };
    }
  });

  return ContentService.createTextOutput(JSON.stringify(results))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = JSON.parse(e.postData.contents);
  
  const sheet = ss.getSheetByName(data.projectName);
  if (!sheet) return errorResponse("Sheet not found");

  const row = data.row;
  const utilization = data.utilization;
  const issue = data.issue;
  
  // Column H is 8, I is 9, J is 10
  sheet.getRange(row, 8).setValue(utilization);
  
  if (data.issueCategory === 'OCON') {
    sheet.getRange(row, 9).setValue(issue);
    sheet.getRange(row, 10).setValue(""); // Clear other
  } else {
    sheet.getRange(row, 10).setValue(issue);
    sheet.getRange(row, 9).setValue(""); // Clear other
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return ContentService.createTextOutput(JSON.stringify({ error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
