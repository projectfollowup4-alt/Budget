/**
 * Google Apps Script for Budget Utilization Followup (v3 - Multi-Select & Robust Auth)
 */

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;
  const phone = cleanPhone(e.parameter.phone);

  if (action === 'getProjects') {
    return getProjectsForUser(ss, phone);
  }

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

  // Clean phone matching
  // Search for the user's approval status
  for (let i = 1; i < approvalsData.length; i++) {
    const rowPhone = cleanPhone(approvalsData[i][1]);
    const rowStatus = String(approvalsData[i][5] || "").trim();
    
    if (rowPhone === phone) {
      // Create or update the user record
      const record = {
        name: approvalsData[i][0],
        status: rowStatus,
        approvedProjects: String(approvalsData[i][4] || "").split(',').map(s => s.trim())
      };
      
      // PRIORITY: If we find an 'Approved' entry, that is our final answer.
      if (rowStatus.toLowerCase() === 'approved') {
        userApproval = record;
        userApproval.status = 'Approved'; // Normalize casing
        break; 
      }
      
      // Otherwise, keep the latest entry found so far (usually 'Pending')
      userApproval = record;
    }
  }

  if (!userApproval) {
    return jsonResponse({ 
      status: 'not_found', 
      availableProjects: getAvailableProjectNames(ss) 
    });
  }

  if (userApproval.status !== 'Approved') {
    return jsonResponse({ status: 'pending', name: userApproval.name });
  }

  const sheets = ss.getSheets();
  const systemSheets = ['Approvals', 'Instructions', 'Settings'];
  const results = {};

  sheets.forEach(sheet => {
    const name = sheet.getName();
    if (systemSheets.includes(name)) return;
    
    const hasAccess = userApproval.approvedProjects.includes('All') || userApproval.approvedProjects.includes(name);
    
    if (hasAccess) {
      results[name] = { items: getSheetData(sheet) };
    }
  });

  return jsonResponse({ status: 'approved', projects: results });
}

function getAvailableProjectNames(ss) {
  const systemSheets = ['Approvals', 'Instructions', 'Settings'];
  return ss.getSheets()
    .map(s => s.getName())
    .filter(name => !systemSheets.includes(name));
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
      reportedBy: row[10] || "",
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
    Array.isArray(data.requestedProjects) ? data.requestedProjects.join(', ') : data.requestedProject,
    "", 
    "Pending",
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
  
  sheet.getRange(row, 8).setValue(utilization + "%");
  
  if (data.issueCategory === 'OCON') {
    sheet.getRange(row, 9).setValue(issue);
    sheet.getRange(row, 10).setValue("");
  } else {
    sheet.getRange(row, 10).setValue(issue);
    sheet.getRange(row, 9).setValue("");
  }

  sheet.getRange(row, 11).setValue(reporter + " (" + new Date().toLocaleDateString() + ")");

  return jsonResponse({ success: true });
}

function getOrCreateApprovalsSheet(ss) {
  let sheet = ss.getSheetByName('Approvals');
  if (!sheet) {
    sheet = ss.insertSheet('Approvals');
    sheet.appendRow(['Name', 'Phone', 'Position', 'Requested Projects', 'Approved Projects', 'Status', 'Timestamp']);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#f3f3f3');
  }
  return sheet;
}

function cleanPhone(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, ''); // Keep only digits
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return jsonResponse({ error: msg });
}
