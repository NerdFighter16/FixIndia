// This script handles all frontend interactivity for the FixIndia app.

// --- Global variables for maps and markers ---
let map, reportMap;
let markers = [];
let reportMarker;

// --- Main execution block ---
document.addEventListener('DOMContentLoaded', () => {
    // Handle login and registration forms
    handleAuthForms();

    // Attach submit handler for the issue reporting form
    if (document.getElementById('report-form')) {
        handleReportForm();
        initReportMap();
    }

    // Initialize the main map and issue list ONLY on department pages
    if (document.getElementById('map')) {
        initDepartmentMapAndList();
    }
    
    // Initialize the management dashboard table
    if (document.getElementById('dashboard-table')) {
        initDashboard();
    }

    // Initialize the analytics dashboard charts
    if (document.getElementById('issuesPerDeptChart')) {
        initAnalyticsDashboard();
    }
});


// ---- AUTHENTICATION LOGIC ----
function handleAuthForms() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(loginForm).entries());
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (response.ok) window.location.href = '/';
            else alert('Login failed. Please check your credentials.');
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(registerForm).entries());
            if (data.password !== data.confirmPassword) return alert('Passwords do not match.');
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: data.name, email: data.email, password: data.password })
            });
            if (response.ok) {
                alert('Registration successful! Please log in.');
                window.location.href = '/login';
            } else {
                alert('Registration failed. Email may already be in use.');
            }
        });
    }
}

// ---- REPORTING LOGIC ----
function handleReportForm() {
    document.getElementById('report-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        if (!formData.get('latitude') || !formData.get('longitude')) return alert('Please select a location on the map.');
        const response = await fetch('/api/issues', { method: 'POST', body: formData });
        if (response.ok) {
            alert('Issue reported successfully!');
            window.location.href = '/';
        } else {
            alert('Failed to report issue.');
        }
    });
}

// ---- VOTING LOGIC ----
async function handleVote(e) {
    const button = e.currentTarget;
    const issueId = button.dataset.id;
    const response = await fetch(`/api/issues/${issueId}/vote`, { method: 'POST' });
    if (response.ok) {
        const data = await response.json();
        document.getElementById(`vote-count-${issueId}`).textContent = data.votes_count;
    } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
    }
}

// ---- MANAGEMENT DASHBOARD LOGIC ----
async function initDashboard() {
    const response = await fetch('/api/issues');
    const issues = await response.json();
    const tbody = document.getElementById('dashboard-table-body');
    tbody.innerHTML = '';
    issues.forEach(issue => {
        tbody.innerHTML += `
            <tr>
                <td>${issue.id}</td>
                <td>${issue.title}</td>
                <td>${issue.category}</td>
                <td><span class="badge status-badge status-${issue.status.replace(' ', '.')}">${issue.status}</span></td>
                <td>${new Date(issue.created_at).toLocaleDateString()}</td>
                <td>
                    <select class="form-select form-select-sm status-update-select" data-id="${issue.id}">
                        <option value="Pending" ${issue.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="In Progress" ${issue.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Resolved" ${issue.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                    </select>
                </td>
            </tr>`;
    });
    document.querySelectorAll('.status-update-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const res = await fetch(`/api/issues/${e.target.dataset.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: e.target.value })
            });
            if (res.ok) {
                alert('Status updated successfully');
                initDashboard();
            } else {
                alert('Failed to update status.');
            }
        });
    });
}

// ---- ANALYTICS DASHBOARD LOGIC ----
async function initAnalyticsDashboard() {
    const response = await fetch('/api/issues/analytics');
    const data = await response.json();

    // Update Average Resolution Time
    const avgTimeDisplay = document.getElementById('avg-time-display');
    if (data.averageResolutionTime && data.averageResolutionTime.days) {
        avgTimeDisplay.textContent = `${data.averageResolutionTime.days} Days`;
    } else {
        avgTimeDisplay.textContent = 'N/A';
    }

    // Chart 1: Issues per Department
    const deptCtx = document.getElementById('issuesPerDeptChart').getContext('2d');
    new Chart(deptCtx, {
        type: 'bar',
        data: {
            labels: data.issuesPerDepartment.map(d => d.category),
            datasets: [{
                label: '# of Issues',
                data: data.issuesPerDepartment.map(d => d.count),
                backgroundColor: '#FF9933'
            }]
        },
        options: {
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            responsive: true,
            plugins: { legend: { display: false } }
        }
    });

    // Chart 2: Status Breakdown
    const statusCtx = document.getElementById('statusBreakdownChart').getContext('2d');
    new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: data.statusBreakdown.map(s => s.status),
            datasets: [{
                data: data.statusBreakdown.map(s => s.count),
                backgroundColor: ['#ffc107', '#FF9933', '#138808']
            }]
        },
        options: { responsive: true }
    });
}


// ===================================================================
// ===== LEAFLET.JS MAP LOGIC FOR DEPARTMENT & REPORT PAGES ========
// ===================================================================

function addTileLayer(mapInstance) {
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance);
}

async function initDepartmentMapAndList() {
    map = L.map('map').setView([20.5937, 78.9629], 5);
    addTileLayer(map);
    await fetchAndDisplayIssues();
    document.getElementById('filter-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await fetchAndDisplayIssues();
    });
}

async function fetchAndDisplayIssues() {
    const departmentName = document.getElementById('department-name').value;
    const formData = new FormData(document.getElementById('filter-form'));
    const params = new URLSearchParams(formData);
    params.set('category', departmentName);
    const response = await fetch(`/api/issues?${params.toString()}`);
    const issues = await response.json();
    updateIssueList(issues);
    updateMapMarkers(issues);
}

function updateIssueList(issues) {
    const listContainer = document.getElementById('issue-list');
    listContainer.innerHTML = '';
    if (issues.length === 0) {
        listContainer.innerHTML = '<p class="text-muted p-3">No issues found for this department.</p>';
        return;
    }
    issues.forEach(issue => {
        listContainer.innerHTML += `
            <div class="card issue-card" id="issue-card-${issue.id}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    ${issue.title}
                    <span class="badge status-badge status-${issue.status.replace(' ', '.')}">${issue.status}</span>
                </div>
                <div class="card-body">
                    <p class="card-text">${issue.description}</p>
                    ${issue.image_path ? `<img src="${issue.image_path}" alt="Issue Image" class="img-fluid rounded mb-2">` : ''}
                    <div class="d-flex justify-content-between align-items-center">
                        <button class="btn btn-sm btn-primary vote-btn" data-id="${issue.id}">
                            Vote (<span id="vote-count-${issue.id}">${issue.votes_count}</span>)
                        </button>
                        <small class="text-muted">By: ${issue.reporter_name}</small>
                    </div>
                </div>
            </div>`;
    });
    document.querySelectorAll('.vote-btn').forEach(btn => btn.addEventListener('click', handleVote));
}

function updateMapMarkers(issues) {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    const statusColors = { 'Pending': '#ffc107', 'In Progress': '#FF9933', 'Resolved': '#138808' };
    issues.forEach(issue => {
        const position = [parseFloat(issue.latitude), parseFloat(issue.longitude)];
        const color = statusColors[issue.status] || 'grey';
        const circleMarker = L.circleMarker(position, { radius: 8, fillColor: color, color: "#fff", weight: 2, opacity: 1, fillOpacity: 0.9 }).addTo(map);
        circleMarker.bindPopup(`<h6>${issue.title}</h6><p>${issue.description}</p>`);
        circleMarker.on('click', () => document.getElementById(`issue-card-${issue.id}`).scrollIntoView({ behavior: 'smooth', block: 'center' }));
        markers.push(circleMarker);
    });
}

function initReportMap() {
    const latInput = document.getElementById('latitude');
    const lngInput = document.getElementById('longitude');
    reportMap = L.map("reportMap").setView([20.5937, 78.9629], 5);
    addTileLayer(reportMap);
    reportMap.on('click', (e) => {
        const { lat, lng } = e.latlng;
        latInput.value = lat.toFixed(6);
        lngInput.value = lng.toFixed(6);
        if (!reportMarker) reportMarker = L.marker(e.latlng).addTo(reportMap);
        else reportMarker.setLatLng(e.latlng);
        reportMap.panTo(e.latlng);
    });
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const pos = [position.coords.latitude, position.coords.longitude];
            reportMap.setView(pos, 15);
            if (!reportMarker) reportMarker = L.marker(pos).addTo(reportMap);
            else reportMarker.setLatLng(pos);
            latInput.value = pos[0].toFixed(6);
            lngInput.value = pos[1].toFixed(6);
        });
    }
}