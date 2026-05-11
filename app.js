/**
 * Budget Utilization Followup App
 * Logic for OVID Construction Budget Tracking
 */

const CONFIG = {
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwE84B9hEtQXrpN6cHlYOB2fIJJto_eVQYOdImuQ7PWlnMG-J65Ui2BhEzheha5_m_3zw/exec'
};

// Application State
const state = {
    currentView: 'auth', 
    user: JSON.parse(localStorage.getItem('ovid_budget_user')) || null,
    authStatus: 'none', 
    selectedProject: null,
    budgetData: {}, 
    availableProjects: [], // From server
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

function cleanPhone(phone) {
    return String(phone).replace(/\D/g, '');
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

async function initApp() {
    if (!state.user) {
        renderAuthForm();
    } else {
        await checkAuthAndLoadProjects();
    }
}

function renderAuthForm() {
    state.currentView = 'auth';
    projectNameEl.textContent = 'Identity Verification';
    
    mainContent.innerHTML = `
        <div class="auth-card glass">
            <h2>Welcome to Budget Followup</h2>
            <p>Please enter your details to verify your identity.</p>
            
            <div class="form-group">
                <label>Full Name</label>
                <input type="text" id="auth-name" placeholder="Enter your full name">
            </div>
            <div class="form-group">
                <label>Phone Number</label>
                <input type="tel" id="auth-phone" placeholder="e.g. 0911223344">
            </div>
            <div class="form-group">
                <label>Position / Work Role</label>
                <input type="text" id="auth-position" placeholder="e.g. Project Manager, Coordinator">
            </div>
            
            <button onclick="handleIdentitySubmit()" style="width: 100%; justify-content: center; margin-top: 1rem;">
                <i data-lucide="user-check"></i> Continue
            </button>
        </div>
    `;
    initIcons();
}

function handleIdentitySubmit() {
    const name = document.getElementById('auth-name').value.trim();
    const phoneInput = document.getElementById('auth-phone').value.trim();
    const position = document.getElementById('auth-position').value.trim();
    
    if (!name || !phoneInput || !position) {
        alert("Please fill in all fields");
        return;
    }
    
    const phone = cleanPhone(phoneInput);
    state.user = { name, phone, position };
    localStorage.setItem('ovid_budget_user', JSON.stringify(state.user));
    checkAuthAndLoadProjects();
}

async function checkAuthAndLoadProjects() {
    mainContent.innerHTML = `
        <div class="loader">
            <div class="spinner"></div>
            <p>Verifying access for ${state.user.name}...</p>
        </div>
    `;

    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=getProjects&phone=${state.user.phone}`);
        const data = await response.json();
        
        if (data.status === 'not_found') {
            state.availableProjects = data.availableProjects || [];
            renderRequestForm();
        } else if (data.status === 'pending') {
            renderPendingStatus();
        } else if (data.status === 'approved') {
            state.budgetData = data.projects;
            state.authStatus = 'approved';
            renderProjectList();
        }
    } catch (error) {
        mainContent.innerHTML = `<div class="error-msg">Connection Error: Please check your internet or retry.</div>`;
    }
}

function renderRequestForm() {
    state.currentView = 'request';
    projectNameEl.textContent = 'Request Access';
    
    let projectsHtml = `
        <div class="checkbox-group">
            <label class="checkbox-item">
                <input type="checkbox" name="req-project" value="All">
                <span>All Projects (Coordinators)</span>
            </label>
    `;
    
    state.availableProjects.forEach(p => {
        projectsHtml += `
            <label class="checkbox-item">
                <input type="checkbox" name="req-project" value="${p}">
                <span>${p}</span>
            </label>
        `;
    });
    projectsHtml += `</div>`;
    
    mainContent.innerHTML = `
        <div class="auth-card glass">
            <h2>Access Required</h2>
            <p>Select the projects you need to manage. You can choose one or multiple.</p>
            
            <div class="form-group">
                <label>Projects to Access</label>
                ${projectsHtml}
            </div>
            
            <button onclick="handleRequestAccess()" style="width: 100%; justify-content: center; margin-top: 1.5rem;">
                <i data-lucide="send"></i> Send Request
            </button>
            
            <button onclick="logout()" class="btn-secondary" style="width: 100%; margin-top: 1rem; justify-content: center;">
                Change Identity
            </button>
        </div>
    `;
    initIcons();
}

async function handleRequestAccess() {
    const selected = Array.from(document.querySelectorAll('input[name="req-project"]:checked')).map(cb => cb.value);
    
    if (selected.length === 0) {
        alert("Please select at least one project");
        return;
    }
    
    mainContent.innerHTML = `<div class="loader"><div class="spinner"></div><p>Sending request...</p></div>`;
    
    try {
        await fetch(CONFIG.SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'requestAccess',
                name: state.user.name,
                phone: state.user.phone,
                position: state.user.position,
                requestedProjects: selected
            })
        });
        renderPendingStatus();
    } catch (error) {
        alert("Failed to send request. Check your connection.");
        renderRequestForm();
    }
}

function renderPendingStatus() {
    state.currentView = 'pending';
    projectNameEl.textContent = 'Access Pending';
    
    mainContent.innerHTML = `
        <div class="auth-card glass" style="text-align: center;">
            <i data-lucide="clock" style="width: 64px; height: 64px; color: var(--warning); margin-bottom: 1.5rem;"></i>
            <h2>Request Pending</h2>
            <p>Your access request for <strong>${state.user.name}</strong> is currently being reviewed.</p>
            <p style="font-size: 0.9rem; color: var(--text-dim); margin-top: 1rem;">Admin: Ensure you have marked status as "Approved" in the Approvals sheet.</p>
            
            <button onclick="checkAuthAndLoadProjects()" style="width: 100%; justify-content: center; margin-top: 2rem;">
                <i data-lucide="refresh-cw"></i> Check Status
            </button>
            
            <button onclick="logout()" class="btn-secondary" style="width: 100%; margin-top: 1rem; justify-content: center;">
                Logout
            </button>
        </div>
    `;
    initIcons();
}

function renderProjectList() {
    state.currentView = 'projects';
    state.selectedProject = null;
    projectNameEl.textContent = 'Project Dashboard';
    backBtn.classList.add('hidden');
    
    const projectNames = Object.keys(state.budgetData);

    if (projectNames.length === 0) {
        mainContent.innerHTML = `<div class="error-msg">No projects assigned to you. Contact admin.</div>`;
        return;
    }
    
    let html = `
        <div class="view-header">
            <h1>Your Projects</h1>
            <p>Hello ${state.user.name}, select a project to manage.</p>
        </div>
        <div class="project-grid">
    `;

    projectNames.forEach(project => {
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

function logout() {
    localStorage.removeItem('ovid_budget_user');
    state.user = null;
    renderAuthForm();
}

async function loadProject(projectName) {
    state.selectedProject = projectName;
    state.currentView = 'detail';
    projectNameEl.textContent = projectName;
    backBtn.classList.remove('hidden');
    
    renderProjectDetail(projectName, state.budgetData[projectName]);
}

function renderProjectDetail(name, data) {
    const totalBudget = data.items.reduce((sum, item) => item.isTotal ? sum + (item.amount || 0) : sum, 0) || 
                       data.items.filter(i => i.isCategory).reduce((sum, i) => sum + i.amount, 0);
    
    const utilizedBudget = data.items.reduce((sum, item) => {
        if (item.isCategory || item.isTotal) return sum;
        return sum + ((item.amount * (item.utilization || 0)) / 100);
    }, 0);
    
    const remainingBudget = totalBudget - utilizedBudget;

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
                <p>Manage utilization for ${name}</p>
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
                        <th>Reported By</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
    `;

    sections.forEach(section => {
        html += `
            <tr class="${section.isGrandTotal ? 'total-row' : 'category-row'}">
                <td colspan="2">${section.category.description}</td>
                <td colspan="2">${formatCurrency(section.category.amount)}</td>
                <td colspan="2">${section.isGrandTotal ? 'Project Total' : 'Section Total'}</td>
            </tr>
        `;

        section.items.forEach(item => {
            const index = data.items.indexOf(item);
            const utilizedAmt = (item.amount * (item.utilization || 0)) / 100;
            
            html += `
                <tr>
                    <td>${item.description}</td>
                    <td>${formatCurrency(item.amount)}</td>
                    <td>${(item.utilization || 0) + '%'}</td>
                    <td>${formatCurrency(utilizedAmt)}</td>
                    <td><div class="reporter-cell">${item.reportedBy || '<span style="opacity:0.3">-</span>'}</div></td>
                    <td>
                        <button onclick="openEditModal(${index})">
                            <i data-lucide="edit-3"></i> Update
                        </button>
                    </td>
                </tr>
            `;
        });
    });

    html += `</tbody></table></div>`;
    mainContent.innerHTML = html;
    initIcons();
}

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
            "Payment submitted to Finance; issuance pending",
            "Material delivery pending",
            "Contractor not yet assigned",
            "Delayed by preceding material deliveries",
            "Price adjustment or budget revision required",
            "Other"
        ];
    } else if (category === 'Provider') {
        options = [
            "Incomplete documentation for payment processing",
            "Check has already been issued",
            "Proforma collection in progress",
            "Market price exceeds allocated budget",
            "Minor delay expected (3-4 business days)",
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

    const saveBtn = document.querySelector('.modal-content button');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="spinner" style="width:20px; height:20px; border-width:2px; margin:0 auto;"></div>';

    try {
        await fetch(CONFIG.SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'updateUtilization',
                projectName: project,
                row: item.row,
                utilization: percent,
                issueCategory: issueCategory,
                issue: issue,
                reporter: state.user.name + " (" + state.user.position + ")"
            })
        });

        item.utilization = percent;
        item.issue = issue ? `[${issueCategory}] ${issue}` : "";
        item.reportedBy = state.user.name;

        modalContainer.classList.add('hidden');
        renderProjectDetail(project, state.budgetData[project]);
    } catch (error) {
        alert("Error saving data: " + error.message);
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
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
initApp();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.log('Service Worker failed', err));
    });
}
