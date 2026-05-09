/**
 * Budget Utilization Followup App
 * Logic for OVID Construction Budget Tracking
 */

const CONFIG = {
    // This URL will be provided after deploying the Google Apps Script
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbx6OA8RkB5Pasz-OFsA-O-ZbaxqDIB6Kb9scYidhOTvi6GtP2780fctx0fS_0swfG_81Q/exec', 
    PROJECTS: ['ICS-Akaki', 'Fana', 'ICS-Garment', 'ICS-Kolfe', 'ICS-Lemi Kura', 'MOH', 'Republican', '420']
};

// Application State
const state = {
    currentView: 'projects', // 'projects' or 'detail'
    selectedProject: null,
    budgetData: {}, // Cached data per project
    isLoading: false
};

// UI Elements
const mainContent = document.getElementById('main-content');
const projectNameEl = document.getElementById('current-project-name');
const backBtn = document.getElementById('back-btn');
const modalContainer = document.getElementById('modal-container');
const modalBody = document.getElementById('modal-body');

// Initialize Lucide Icons
function initIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Format Currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-ET', {
        style: 'currency',
        currency: 'ETB',
        minimumFractionDigits: 2
    }).format(amount);
}

// --- View Rendering ---

function renderProjectList() {
    state.currentView = 'projects';
    state.selectedProject = null;
    projectNameEl.textContent = 'Project Dashboard';
    backBtn.classList.add('hidden');
    
    let html = `
        <div class="view-header">
            <h1>Select a Project</h1>
            <p>Select a project to view and update budget utilization</p>
        </div>
        <div class="project-grid">
    `;

    CONFIG.PROJECTS.forEach(project => {
        html += `
            <div class="project-card" onclick="loadProject('${project}')">
                <i data-lucide="building-2" style="width: 48px; height: 48px; color: var(--primary-light); margin-bottom: 1rem;"></i>
                <h3>${project}</h3>
                <p>View Budget Details</p>
            </div>
        `;
    });

    html += `</div>`;
    mainContent.innerHTML = html;
    initIcons();
}

async function loadProject(projectName) {
    state.selectedProject = projectName;
    state.currentView = 'detail';
    projectNameEl.textContent = projectName;
    backBtn.classList.remove('hidden');
    
    // Show Loader
    mainContent.innerHTML = `
        <div class="loader">
            <div class="spinner"></div>
            <p>Fetching data for ${projectName}...</p>
        </div>
    `;

    try {
        // In a real app, fetch from SCRIPT_URL
        // For now, I'll simulate data fetching
        const data = await fetchProjectData(projectName);
        state.budgetData[projectName] = data;
        renderProjectDetail(projectName, data);
    } catch (error) {
        mainContent.innerHTML = `<div class="error-msg">Error loading project: ${error.message}</div>`;
    }
}

function renderProjectDetail(name, data) {
    const totalBudget = data.items.reduce((sum, item) => item.isTotal ? sum + (item.amount || 0) : sum, 0) || 
                       data.items.filter(i => i.isCategory).reduce((sum, i) => sum + i.amount, 0);
    
    const utilizedBudget = data.items.reduce((sum, item) => {
        if (item.isCategory || item.isTotal) return sum;
        return sum + ((item.amount * (item.utilization || 0)) / 100);
    }, 0);
    
    const remainingBudget = totalBudget - utilizedBudget;

    // Reorganize items: Group them by the category that follows them
    const sections = [];
    let currentItems = [];
    
    data.items.forEach(item => {
        if (item.isCategory) {
            sections.push({ category: item, items: currentItems });
            currentItems = [];
        } else if (item.isTotal) {
            if (currentItems.length > 0) {
                sections.push({ category: { description: 'Other', isCategory: true, amount: 0 }, items: currentItems });
            }
            sections.push({ category: item, items: [], isGrandTotal: true });
            currentItems = [];
        } else {
            currentItems.push(item);
        }
    });

    let html = `
        <div class="budget-header">
            <div class="header-text">
                <h1>Budget Followup</h1>
                <p>Manage utilization and issues for ${name}</p>
            </div>
            <div class="stat-group">
                <div class="stat-card">
                    <label>Total Budget</label>
                    <span>${formatCurrency(totalBudget)}</span>
                </div>
                <div class="stat-card">
                    <label>Utilized</label>
                    <span style="color: var(--warning)">${formatCurrency(utilizedBudget)}</span>
                </div>
                <div class="stat-card">
                    <label>Remaining</label>
                    <span style="color: var(--success)">${formatCurrency(remainingBudget)}</span>
                </div>
            </div>
        </div>

        <div class="table-container glass">
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Amount (ETB)</th>
                        <th>Utilization %</th>
                        <th>Utilized Amt</th>
                        <th>Status / Issue</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
    `;

    sections.forEach(section => {
        // Render Category Header
        html += `
            <tr class="${section.isGrandTotal ? 'total-row' : 'category-row'}">
                <td colspan="2">${section.category.description}</td>
                <td colspan="2">${formatCurrency(section.category.amount)}</td>
                <td colspan="2">Section Total</td>
            </tr>
        `;

        // Render Items under this category
        section.items.forEach(item => {
            const index = data.items.indexOf(item);
            const utilizedAmt = (item.amount * (item.utilization || 0)) / 100;
            const status = item.utilization > 0 ? `<span class="badge success">${item.utilization}% Utilized</span>` : `<span class="badge warning">Not Utilized</span>`;
            
            html += `
                <tr>
                    <td>${item.description}</td>
                    <td>${formatCurrency(item.amount)}</td>
                    <td>${(item.utilization || 0) + '%'}</td>
                    <td>${formatCurrency(utilizedAmt)}</td>
                    <td>${(item.issue || 'No issues reported')}</td>
                    <td>
                        <button onclick="openEditModal(${index})">
                            <i data-lucide="edit-3"></i> Update
                        </button>
                    </td>
                </tr>
            `;
        });
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    mainContent.innerHTML = html;
    initIcons();
}

// --- Modals & Interactions ---

function openEditModal(index) {
    const item = state.budgetData[state.selectedProject].items[index];
    
    modalBody.innerHTML = `
        <h2>Update Utilization</h2>
        <p style="color: var(--text-dim); margin-bottom: 1.5rem;">${item.description}</p>
        
        <div class="form-group">
            <label>Utilization Percentage (%)</label>
            <input type="number" id="input-utilization" value="${item.utilization || 0}" min="0" max="100" oninput="calculatePreview(${item.amount})">
        </div>

        <div id="issue-container" class="${(item.utilization || 0) > 0 ? 'hidden' : ''}">
            <div class="form-group">
                <label>Issue Category</label>
                <select id="issue-category" onchange="updateIssueOptions()">
                    <option value="">Select Category</option>
                    <option value="OCON">Issue from OCON</option>
                    <option value="Provider">Issue from Provider/Department</option>
                </select>
            </div>
            
            <div class="form-group" id="issue-select-group">
                <label>Specific Issue</label>
                <select id="input-issue">
                    <option value="">Select an issue category first</option>
                </select>
            </div>

            <div class="form-group hidden" id="other-issue-group">
                <label>Please specify "Other" issue</label>
                <textarea id="other-issue-text" rows="3" placeholder="Describe the issue..."></textarea>
            </div>
        </div>

        <div class="calc-preview">
            <div>
                <label>Utilized Amount</label>
                <span id="preview-utilized">${formatCurrency((item.amount * (item.utilization || 0)) / 100)}</span>
            </div>
            <div style="text-align: right">
                <label>Remaining</label>
                <span id="preview-remaining">${formatCurrency(item.amount - (item.amount * (item.utilization || 0)) / 100)}</span>
            </div>
        </div>

        <button onclick="saveItemUpdate(${index})" style="width: 100%; margin-top: 1.5rem; justify-content: center;">
            <i data-lucide="save"></i> Save Changes
        </button>
    `;

    modalContainer.classList.remove('hidden');
    initIcons();
}

function calculatePreview(totalAmount) {
    const percent = parseFloat(document.getElementById('input-utilization').value) || 0;
    const issueContainer = document.getElementById('issue-container');
    
    if (percent > 0) {
        issueContainer.classList.add('hidden');
    } else {
        issueContainer.classList.remove('hidden');
    }

    const utilized = (totalAmount * percent) / 100;
    const remaining = totalAmount - utilized;

    document.getElementById('preview-utilized').textContent = formatCurrency(utilized);
    document.getElementById('preview-remaining').textContent = formatCurrency(remaining);
}

function updateIssueOptions() {
    const category = document.getElementById('issue-category').value;
    const select = document.getElementById('input-issue');
    const otherGroup = document.getElementById('other-issue-group');
    
    let options = [];
    if (category === 'OCON') {
        options = [
            "Payment submitted to finance but not issued",
            "Material not delivered",
            "Contractor not assigned",
            "Other material delivery before this one",
            "Price adjustment needed",
            "Other"
        ];
    } else if (category === 'Provider') {
        options = [
            "Document not fulfilled for the payment",
            "The check is already issued",
            "We are on proforma collection",
            "Can't find material with the budget given",
            "Need to wait few days (3 to 4 days)",
            "Other"
        ];
    }

    select.innerHTML = options.map(opt => `<option value="${opt}">${opt}</option>`).join('') || '<option value="">Select Category First</option>';
    
    select.onchange = () => {
        if (select.value === 'Other') {
            otherGroup.classList.remove('hidden');
        } else {
            otherGroup.classList.add('hidden');
        }
    };
}

async function saveItemUpdate(index) {
    const percent = parseFloat(document.getElementById('input-utilization').value) || 0;
    const issueCategory = document.getElementById('issue-category').value;
    let issue = '';
    
    if (percent === 0) {
        const issueSelect = document.getElementById('input-issue');
        issue = issueSelect.value;
        if (issue === 'Other') {
            issue = document.getElementById('other-issue-text').value;
        }
    }

    const project = state.selectedProject;
    const item = state.budgetData[project].items[index];

    // Show saving status
    const saveBtn = document.querySelector('.modal-content button');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="spinner" style="width:20px; height:20px; border-width:2px; margin:0 auto;"></div>';

    try {
        const response = await fetch(CONFIG.SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Google Apps Script requires no-cors or redirects handling
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectName: project,
                row: item.row,
                utilization: percent,
                issueCategory: issueCategory,
                issue: issue
            })
        });

        // Update local state
        item.utilization = percent;
        item.issue = issue ? `[${issueCategory}] ${issue}` : "";

        modalContainer.classList.add('hidden');
        renderProjectDetail(project, state.budgetData[project]);
        
        // Show success (optional: replace with a toast)
        console.log("Update sent successfully");
    } catch (error) {
        alert("Error saving data: " + error.message);
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

// --- Real API ---

async function fetchProjectData(projectName) {
    if (state.allData && state.allData[projectName]) {
        return state.allData[projectName];
    }

    try {
        const response = await fetch(CONFIG.SCRIPT_URL);
        const data = await response.json();
        state.allData = data; // Cache all projects
        return data[projectName];
    } catch (error) {
        console.error("Fetch error:", error);
        throw error;
    }
}

// --- Event Listeners ---

backBtn.onclick = renderProjectList;

document.querySelector('.close-modal').onclick = () => {
    modalContainer.classList.add('hidden');
};

window.onclick = (event) => {
    if (event.target == modalContainer) {
        modalContainer.classList.add('hidden');
    }
};

// Initial Start
renderProjectList();
