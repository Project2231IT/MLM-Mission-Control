// Charts storage
let charts = {};
const LOCATION_NAMES = { TCF: 'The City Forum', D17: 'Dock 17', ACME: 'ACME', MLC: 'Miss Lucilles' };
const LOCATION_COLORS = { TCF: '#3b82f6', D17: '#10b981', ACME: '#f59e0b', MLC: '#ef4444' };
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Tab management
function showTab(name) {
  document.querySelectorAll('[id^="panel-"]').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('[id^="tab-"]').forEach(t => {
    t.classList.remove('tab-active');
    t.classList.add('text-gray-400');
  });
  document.getElementById(`panel-${name}`).classList.remove('hidden');
  const tab = document.getElementById(`tab-${name}`);
  tab.classList.add('tab-active');
  tab.classList.remove('text-gray-400');

  if (name === 'dashboard') loadDashboard();
  if (name === 'upload') loadUploadHistory();
  if (name === 'guests') searchGuests();
}

// Dashboard
async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard/stats');
    if (res.status === 401) return window.location.href = '/login';
    const data = await res.json();
    renderDashboard(data);
  } catch (err) {
    console.error('Dashboard load failed:', err);
  }
}

function renderDashboard(data) {
  document.getElementById('kpi-total').textContent = data.totalGuests.toLocaleString();
  document.getElementById('kpi-week').textContent = data.thisWeekGuests.toLocaleString();
  document.getElementById('kpi-new').textContent = data.newGuests.toLocaleString();
  document.getElementById('kpi-returning').textContent = data.returningGuests.toLocaleString();

  // Location chart
  renderChart('chart-locations', 'bar', {
    labels: data.locationBreakdown.map(l => LOCATION_NAMES[l.location_code] || l.location_code),
    datasets: [{
      label: 'Unique Guests',
      data: data.locationBreakdown.map(l => l.unique_guests),
      backgroundColor: data.locationBreakdown.map(l => LOCATION_COLORS[l.location_code] || '#6b7280'),
      borderRadius: 6,
    }]
  }, { plugins: { legend: { display: false } } });

  // New vs Returning pie
  renderChart('chart-ratio', 'doughnut', {
    labels: ['New', 'Returning'],
    datasets: [{
      data: [data.newGuests, data.returningGuests],
      backgroundColor: ['#10b981', '#f59e0b'],
    }]
  });

  // Peak days
  const dayData = new Array(7).fill(0);
  data.peakDays.forEach(d => dayData[parseInt(d.day_of_week)] = parseInt(d.visit_count));
  renderChart('chart-days', 'bar', {
    labels: DAY_NAMES,
    datasets: [{
      label: 'Visits',
      data: dayData,
      backgroundColor: '#6366f1',
      borderRadius: 6,
    }]
  }, { plugins: { legend: { display: false } } });

  // Peak hours
  const hourData = new Array(24).fill(0);
  data.peakHours.forEach(h => hourData[parseInt(h.hour)] = parseInt(h.visit_count));
  renderChart('chart-hours', 'line', {
    labels: hourData.map((_, i) => `${i}:00`),
    datasets: [{
      label: 'Visits',
      data: hourData,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.1)',
      fill: true,
      tension: 0.3,
    }]
  }, { plugins: { legend: { display: false } } });

  // Age demographics
  const ageFiltered = data.ageDemographics.filter(a => a.age_group !== 'Unknown');
  renderChart('chart-age', 'bar', {
    labels: ageFiltered.map(a => a.age_group),
    datasets: [{
      label: 'Guests',
      data: ageFiltered.map(a => parseInt(a.count)),
      backgroundColor: '#8b5cf6',
      borderRadius: 6,
    }]
  }, { plugins: { legend: { display: false } } });

  // Top returning
  const topEl = document.getElementById('top-returning');
  if (data.topReturning.length === 0) {
    topEl.innerHTML = '<p class="text-gray-500">No returning visitors yet</p>';
  } else {
    topEl.innerHTML = data.topReturning.map(g => `
      <div class="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2">
        <div>
          <span class="font-medium">${esc(g.first_name || '')} ${esc(g.last_name || '')}</span>
          <span class="text-gray-400 text-sm ml-2">${esc(g.email)}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">${(g.locations || []).filter(l => l !== 'UNK').map(l => LOCATION_NAMES[l] || l).join(', ')}</span>
          <span class="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">${g.total_visits} visits</span>
        </div>
      </div>
    `).join('');
  }

  // Cross-location
  const crossEl = document.getElementById('cross-location');
  if (data.crossLocationVisitors.length === 0) {
    crossEl.innerHTML = '<p class="text-gray-500">No cross-location visitors yet</p>';
  } else {
    crossEl.innerHTML = `
      <table class="w-full text-sm">
        <thead><tr class="text-left text-gray-400 border-b border-gray-700">
          <th class="pb-2">Name</th><th class="pb-2">Email</th><th class="pb-2">Visits</th><th class="pb-2">Locations</th>
        </tr></thead>
        <tbody>
          ${data.crossLocationVisitors.map(g => `
            <tr class="border-b border-gray-700/50">
              <td class="py-2">${esc(g.first_name || '')} ${esc(g.last_name || '')}</td>
              <td class="py-2 text-gray-400">${esc(g.email)}</td>
              <td class="py-2">${g.total_visits}</td>
              <td class="py-2">${(g.locations || []).map(l =>
                `<span class="inline-block text-xs px-2 py-0.5 rounded-full mr-1" style="background:${LOCATION_COLORS[l] || '#6b7280'}33;color:${LOCATION_COLORS[l] || '#6b7280'}">${LOCATION_NAMES[l] || l}</span>`
              ).join('')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
}

function renderChart(id, type, data, extraOpts = {}) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id).getContext('2d');
  const defaults = {
    responsive: true,
    maintainAspectRatio: true,
    scales: type === 'doughnut' ? {} : {
      y: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
      x: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
    },
    plugins: { legend: { labels: { color: '#d1d5db' } } },
  };
  charts[id] = new Chart(ctx, {
    type,
    data,
    options: { ...defaults, ...extraOpts, plugins: { ...defaults.plugins, ...(extraOpts.plugins || {}) } },
  });
}

// Upload
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

if (dropZone) {
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) uploadFile(fileInput.files[0]);
  });
}

async function uploadFile(file) {
  const progressEl = document.getElementById('upload-progress');
  const statusEl = document.getElementById('upload-status');
  const resultEl = document.getElementById('upload-result');
  const barEl = document.getElementById('progress-bar');

  progressEl.classList.remove('hidden');
  resultEl.classList.add('hidden');
  statusEl.textContent = `Uploading ${file.name}...`;
  barEl.style.width = '30%';

  const formData = new FormData();
  formData.append('file', file);

  try {
    barEl.style.width = '60%';
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    barEl.style.width = '100%';

    const data = await res.json();
    if (res.ok) {
      statusEl.textContent = 'Upload complete!';
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `
        <div class="text-green-400 font-medium mb-2">✓ Successfully imported</div>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>File: <span class="text-white">${esc(data.filename)}</span></div>
          <div>Rows: <span class="text-white">${data.rowsImported}</span></div>
          <div>New guests: <span class="text-green-400">${data.newGuests}</span></div>
          <div>Returning: <span class="text-yellow-400">${data.returningGuests}</span></div>
          <div>Skipped: <span class="text-gray-400">${data.skipped} (no email)</span></div>
        </div>
      `;
      loadUploadHistory();
    } else {
      statusEl.textContent = 'Upload failed';
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `<div class="text-red-400">${esc(data.error)}</div>`;
    }
  } catch (err) {
    statusEl.textContent = 'Upload failed';
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `<div class="text-red-400">${esc(err.message)}</div>`;
  }
}

async function loadUploadHistory() {
  try {
    const res = await fetch('/api/upload/history');
    const uploads = await res.json();
    const el = document.getElementById('upload-history');
    if (!el) return;
    if (uploads.length === 0) {
      el.innerHTML = '<p class="text-gray-500">No uploads yet</p>';
      return;
    }
    el.innerHTML = uploads.map(u => `
      <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 flex items-center justify-between">
        <div>
          <span class="font-medium">${esc(u.filename)}</span>
          <span class="text-gray-500 text-sm ml-2">${new Date(u.uploaded_at).toLocaleString()}</span>
        </div>
        <div class="text-sm">
          <span class="text-green-400">${u.new_guests} new</span> ·
          <span class="text-yellow-400">${u.returning_guests} returning</span> ·
          ${u.rows_imported} rows
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load upload history:', err);
  }
}

// Guests
let currentPage = 1;

async function searchGuests(page = 1) {
  currentPage = page;
  const search = document.getElementById('guest-search')?.value || '';
  const location = document.getElementById('guest-location-filter')?.value || 'all';

  try {
    const res = await fetch(`/api/guests?search=${encodeURIComponent(search)}&location=${location}&page=${page}`);
    const data = await res.json();
    renderGuestsTable(data);
  } catch (err) {
    console.error('Guest search failed:', err);
  }
}

function renderGuestsTable(data) {
  const el = document.getElementById('guests-table');
  if (data.guests.length === 0) {
    el.innerHTML = '<p class="text-gray-500 text-center py-8">No guests found</p>';
    document.getElementById('guests-pagination').innerHTML = '';
    return;
  }
  el.innerHTML = `
    <table class="w-full text-sm">
      <thead><tr class="text-left text-gray-400 border-b border-gray-700">
        <th class="pb-2">Name</th><th class="pb-2">Email</th><th class="pb-2">Phone</th>
        <th class="pb-2">Visits</th><th class="pb-2">First Seen</th><th class="pb-2">Last Seen</th><th class="pb-2">Locations</th>
      </tr></thead>
      <tbody>
        ${data.guests.map(g => `
          <tr class="border-b border-gray-700/50 hover:bg-gray-800/50">
            <td class="py-2">${esc(g.first_name || '')} ${esc(g.last_name || '')}</td>
            <td class="py-2 text-gray-400">${esc(g.email || '')}</td>
            <td class="py-2 text-gray-400">${esc(g.mobile_phone || '')}</td>
            <td class="py-2">${g.total_visits}</td>
            <td class="py-2 text-gray-400">${g.first_seen ? new Date(g.first_seen).toLocaleDateString() : ''}</td>
            <td class="py-2 text-gray-400">${g.last_seen ? new Date(g.last_seen).toLocaleDateString() : ''}</td>
            <td class="py-2">${(g.locations || []).map(l =>
              `<span class="inline-block text-xs px-2 py-0.5 rounded-full mr-1" style="background:${LOCATION_COLORS[l] || '#6b7280'}33;color:${LOCATION_COLORS[l] || '#6b7280'}">${LOCATION_NAMES[l] || l}</span>`
            ).join('')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Pagination
  const pagEl = document.getElementById('guests-pagination');
  if (data.pages <= 1) { pagEl.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= data.pages; i++) {
    html += `<button onclick="searchGuests(${i})" class="px-3 py-1 rounded ${i === data.page ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}">${i}</button>`;
  }
  pagEl.innerHTML = html;
}

// Add enter key for search
document.getElementById('guest-search')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchGuests();
});

// Export
function exportCsv() {
  const params = new URLSearchParams();
  const loc = document.getElementById('export-location').value;
  const from = document.getElementById('export-from').value;
  const to = document.getElementById('export-to').value;
  const type = document.getElementById('export-type').value;

  if (loc !== 'all') params.set('location', loc);
  if (from) params.set('dateFrom', from);
  if (to) params.set('dateTo', to);
  if (type !== 'all') params.set('guestType', type);

  window.location.href = `/api/export/csv?${params.toString()}`;
}

// Logout
async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

// Util
function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Init
loadDashboard();
