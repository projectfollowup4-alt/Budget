/**
 * Google Apps Script for Budget Utilization Followup (v2 - Access Control)
 * Paste this into Extensions > Apps Script in your Google Sheet.
 */

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;
  const phone = e.parameter.phone;

  if (action === 'getProjects') {
    return getProjectsForUser(ss, phone);
  }

  // Default: Return all (for legacy or admin view)
  return getAllProjects(ss);
}

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = JSON.parse(e.postData.contents);
  const action = data.action;

  if (action === 'requestAccess') {
    return handleRequestAccess(ss, data);
  }

  if (action === 'updateUtilization') {
    return handleUpdateUtilization(ss, data);
  }

  return errorResponse("Invalid action");
}

function getAllProjects(ss) {
  const sheets = ss.getSheets();
  const systemSheets = ['Approvals', 'Instructions', 'Settings'];
  const results = {};

  sheets.forEach(sheet => {
    const name = sheet.getName();
    if (systemSheets.includes(name)) return;
    results[name] = { items: getSheetData(sheet) };
  });

  return jsonResponse(results);
}

function getProjectsForUser(ss, phone) {
  const approvalSheet = getOrCreateApprovalsSheet(ss);
  const approvalsData = approvalSheet.getDataRange().getValues();
  let userApproval = null;

  for (let i = 1; i < approvalsData.length; i++) {
    if (String(approvalsData[i][1]) === String(phone)) { // Column B: Phone
      userApproval = {
        name: approvalsData[i][0],
        status: approvalsData[i][5], // Column F: Status
        approvedProjects: String(approvalsData[i][4] || "").split(',').map(s => s.trim()) // Column E
      };
      break;
    }
  }

  if (!userApproval) {
    return jsonResponse({ status: 'not_found' });
  }

  if (userApproval.status !== 'Approved') {
    return jsonResponse({ status: 'pending', name: userApproval.name });
  }

  // Filter projects
  const sheets = ss.getSheets();
  const systemSheets = ['Approvals', 'Instructions', 'Settings'];
  const results = {};

  sheets.forEach(sheet => {
    const name = sheet.getName();
    if (systemSheets.includes(name)) return;
    
    // Check if user has access to this project or 'All'
    const hasAccess = userApproval.approvedProjects.includes('All') || userApproval.approvedProjects.includes(name);
    
    if (hasAccess) {
      results[name] = { items: getSheetData(sheet) };
    }
  });

  return jsonResponse({ status: 'approved', projects: results });
}

function getSheetData(sheet) {
  const data = sheet.getDataRange().getValues();
  const items = [];
  const categories = ['MATERIAL BUDGET', 'SUB CONTRACTOR', 'SUPPLY & FIX', 'MISCELLANEOUS', 'GRAND TOTAL'];
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const desc = String(row[1] || "").trim();
    if (!desc || desc === "Description") continue;

    const isCategory = categories.some(cat => desc.toUpperCase() === cat);
    const isGrandTotal = desc.toUpperCase() === 'GRAND TOTAL' || desc.toUpperCase() === 'TOTAL';

    items.push({
      row: i + 1,
      description: desc,
      amount: parseFloat(row[5]) || 0,
      utilization: parseFloat(String(row[7]).replace('%', '')) || 0,
      issue: row[8] || row[9] || "",
      reportedBy: row[10] || "", // Column K
      isCategory: isCategory && !isGrandTotal,
      isTotal: isGrandTotal
    });
  }
  return items;
}

function handleRequestAccess(ss, data) {
  const sheet = getOrCreateApprovalsSheet(ss);
  sheet.appendRow([
    data.name,
    data.phone,
    data.position,
    data.requestedProject,
    "", // Approved Projects (to be filled by admin)
    "Pending", // Status
    new Date()
  ]);
  return jsonResponse({ success: true });
}

function handleUpdateUtilization(ss, data) {
  const sheet = ss.getSheetByName(data.projectName);
  if (!sheet) return errorResponse("Sheet not found");

  const row = data.row;
  const utilization = data.utilization;
  const issue = data.issue;
  const reporter = data.reporter || "Unknown";
  
  // Column H (8): Utilization with %
  sheet.getRange(row, 8).setValue(utilization + "%");
  
  // Columns I (9) and J (10): Issues
  if (data.issueCategory === 'OCON') {
    sheet.getRange(row, 9).setValue(issue);
    sheet.getRange(row, 10).setValue("");
  } else {
    sheet.getRange(row, 10).setValue(issue);
    sheet.getRange(row, 9).setValue("");
  }

  // Column K (11): Reported By
  sheet.getRange(row, 11).setValue(reporter + " (" + new Date().toLocaleDateString() + ")");

  return jsonResponse({ success: true });
}

function getOrCreateApprovalsSheet(ss) {
  let sheet = ss.getSheetByName('Approvals');
  if (!sheet) {
    sheet = ss.insertSheet('Approvals');
    sheet.appendRow(['Name', 'Phone', 'Position', 'Requested Project', 'Approved Projects', 'Status', 'Timestamp']);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#f3f3f3');
  }
  return sheet;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return jsonResponse({ error: msg });
}
