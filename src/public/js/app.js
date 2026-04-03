// Charts storage
let charts = {};
const LOCATION_NAMES = { TCF: 'The City Forum', D17: 'Dock 17', ACME: 'ACME Athletics', AHW: 'ACME Health & Wellness', MLC: "Miss Lucille's Café", MLM: "Miss Lucille's Marketplace" };
const LOCATION_COLORS = { TCF: '#3b82f6', D17: '#10b981', ACME: '#f59e0b', AHW: '#14b8a6', MLC: '#ef4444', MLM: '#8b5cf6' };
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Page navigation
function showPage(name) {
  // Hide all pages
  document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
  // Deactivate all nav items
  document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
  // Show target page
  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.remove('hidden');
  // Activate nav item
  const nav = document.getElementById(`nav-${name}`);
  if (nav) nav.classList.add('active');
  // Update title
  const titles = { dashboard: 'Dashboard', customers: 'Customers', analytics: 'Analytics', locations: 'Locations', marketing: 'Marketing', settings: 'Settings' };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[name] || name;
  // Update hash
  window.location.hash = name;
  // Load data
  if (name === 'dashboard') loadDashboard();
  if (name === 'customers') searchCustomers();
  if (name === 'analytics') loadAnalytics();
  if (name === 'locations') loadLocations();
  if (name === 'marketing') loadMarketing();
  if (name === 'settings') loadAdmin();
}

// Backward compat
function showTab(name) { showPage(name); }

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
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('kpi-total', data.totalGuests.toLocaleString());
  setEl('kpi-week', data.thisWeekGuests.toLocaleString());
  const retPct = data.totalGuests > 0 ? Math.round((data.returningGuests / data.totalGuests) * 100) + '%' : '0%';
  setEl('kpi-returning-pct', retPct);
  setEl('kpi-returning-sub', data.returningGuests + ' returning customers');
  setEl('kpi-locations', data.locationBreakdown ? data.locationBreakdown.length : 0);

  // Show admin/settings nav if admin
  document.querySelectorAll('[data-admin]').forEach(el => el.classList.remove('hidden'));

  // Location chart
  renderChart('chart-locations-bar', 'bar', {
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
  renderChart('chart-trend-days', 'bar', {
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
  renderChart('chart-trend-hours', 'line', {
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
  const topEl = document.getElementById('top-returning-tbody');
  if (topEl) {
    if (!data.topReturning || data.topReturning.length === 0) {
      topEl.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-slate-400">No returning customers yet</td></tr>';
    } else {
      topEl.innerHTML = data.topReturning.map(g => `
        <tr class="border-b border-slate-100">
          <td class="py-2.5 px-3 font-medium text-slate-700">${esc(g.first_name || '')} ${esc(g.last_name || '')}</td>
          <td class="py-2.5 px-3 text-slate-500">${esc(g.email)}</td>
          <td class="py-2.5 px-3">${(g.locations || []).filter(l => l !== 'UNK').map(l => 
            `<span class="text-xs px-1.5 py-0.5 rounded" style="background:${LOCATION_COLORS[l]||'#6b7280'}15;color:${LOCATION_COLORS[l]||'#6b7280'}">${LOCATION_NAMES[l]||l}</span>`
          ).join(' ')}</td>
          <td class="py-2.5 px-3 text-right"><span class="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">${g.total_visits}</span></td>
        </tr>
      `).join('');
    }
  }

  // Recent signups
  const recentEl = document.getElementById('recent-signups');
  if (recentEl && data.topReturning) {
    // Use recent portal stats if available, fallback to top returning
    recentEl.innerHTML = data.topReturning.slice(0, 10).map(g => `
      <div class="flex items-center justify-between py-2 border-b border-slate-50">
        <div>
          <div class="text-sm font-medium text-slate-700">${esc(g.first_name || '')} ${esc(g.last_name || '')}</div>
          <div class="text-xs text-slate-400">${esc(g.email)}</div>
        </div>
        <div class="text-xs text-slate-400">${g.total_visits} visits</div>
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
  const el = document.getElementById(id);
  if (!el) return; // Canvas not on current page
  if (charts[id]) charts[id].destroy();
  const ctx = el.getContext('2d');
  const defaults = {
    responsive: true,
    maintainAspectRatio: true,
    scales: type === 'doughnut' ? {} : {
      y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8' } },
      x: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8' } },
    },
    plugins: { legend: { labels: { color: '#64748b' } } },
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

async function searchGuests(page = 1) { return searchCustomers(page); }

async function searchCustomers(page = 1) {
  currentPage = page;
  const search = document.getElementById('cust-search')?.value || '';
  const location = document.getElementById('cust-location')?.value || 'all';

  try {
    const res = await fetch(`/api/guests?search=${encodeURIComponent(search)}&location=${location}&page=${page}&limit=20`);
    if (res.status === 401) return window.location.href = '/login';
    const data = await res.json();
    renderCustomersTable(data);
  } catch (err) {
    console.error('Customer search failed:', err);
  }
}

function renderGuestsTable(data) { renderCustomersTable(data); }

function renderCustomersTable(data) {
  const tbody = document.getElementById('customers-tbody');
  const empty = document.getElementById('customers-empty');
  const countEl = document.getElementById('customers-count');
  const pagEl = document.getElementById('customers-pagination');
  
  if (!data.guests || data.guests.length === 0) {
    if (tbody) tbody.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    if (countEl) countEl.textContent = '0 customers';
    if (pagEl) pagEl.innerHTML = '';
    return;
  }
  
  if (empty) empty.classList.add('hidden');
  if (countEl) countEl.textContent = `${data.total} customer${data.total !== 1 ? 's' : ''}`;
  
  if (tbody) {
    tbody.innerHTML = data.guests.map(g => `
      <tr class="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onclick="showCustomerDetail(${g.id})">
        <td class="py-3 px-4 font-medium text-slate-800">${esc(g.first_name || '')} ${esc(g.last_name || '')}</td>
        <td class="py-3 px-4 text-slate-500">${esc(g.email || '')}</td>
        <td class="py-3 px-4">${(g.locations || []).map(l =>
          `<span class="inline-block text-xs px-2 py-0.5 rounded-full mr-1" style="background:${LOCATION_COLORS[l] || '#6b7280'}15;color:${LOCATION_COLORS[l] || '#6b7280'};border:1px solid ${LOCATION_COLORS[l] || '#6b7280'}30">${LOCATION_NAMES[l] || l}</span>`
        ).join('')}</td>
        <td class="py-3 px-4 text-center">${g.total_visits}</td>
        <td class="py-3 px-4 text-slate-400 text-sm">${g.first_seen ? new Date(g.first_seen).toLocaleDateString() : ''}</td>
        <td class="py-3 px-4 text-slate-400 text-sm">${g.last_seen ? new Date(g.last_seen).toLocaleDateString() : ''}</td>
      </tr>
    `).join('');
  }

  // Pagination
  if (pagEl) {
    if (data.pages <= 1) { pagEl.innerHTML = ''; }
    else {
      let html = '';
      for (let i = 1; i <= data.pages; i++) {
        html += `<button onclick="searchCustomers(${i})" class="px-2.5 py-1 rounded text-sm ${i === data.page ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${i}</button>`;
      }
      pagEl.innerHTML = html;
    }
  }
}

// Export
async function showCustomerDetail(id) {
  try {
    const res = await fetch(`/api/guests/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    const g = data.guest;
    const modal = document.getElementById('customer-modal');
    const body = document.getElementById('customer-modal-body');
    if (modal && body) {
      body.innerHTML = `
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div><span class="text-xs text-slate-400 block">Name</span><span class="font-medium">${esc(g.first_name || '')} ${esc(g.last_name || '')}</span></div>
            <div><span class="text-xs text-slate-400 block">Email</span><span class="font-medium">${esc(g.email)}</span></div>
            <div><span class="text-xs text-slate-400 block">Total Visits</span><span class="font-medium">${g.total_visits}</span></div>
            <div><span class="text-xs text-slate-400 block">First Seen</span><span class="font-medium">${g.first_seen ? new Date(g.first_seen).toLocaleDateString() : 'N/A'}</span></div>
          </div>
          ${data.visits && data.visits.length ? `
          <div>
            <h4 class="text-sm font-semibold text-slate-600 mb-2">Visit History</h4>
            <div class="space-y-2">
              ${data.visits.map(v => `
                <div class="flex justify-between items-center text-sm bg-slate-50 rounded-lg px-3 py-2">
                  <span>${esc(v.ssid || 'Unknown SSID')}</span>
                  <span class="text-slate-400">${v.start_time ? new Date(v.start_time).toLocaleString() : 'N/A'}</span>
                </div>
              `).join('')}
            </div>
          </div>` : ''}
        </div>
      `;
      modal.classList.remove('hidden');
    }
  } catch(e) { console.error('Customer detail failed:', e); }
}

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

// Analytics
function setGrowthRange(range) {
  // Update active button
  document.querySelectorAll('.range-btn').forEach(b => {
    b.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-600', 'font-semibold');
    b.classList.add('border-slate-200', 'text-slate-500');
  });
  const btn = document.querySelector(`[data-range="${range}"]`);
  if (btn) {
    btn.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-600', 'font-semibold');
    btn.classList.remove('border-slate-200', 'text-slate-500');
  }
  // Reload analytics with range (future: pass range to API)
  loadAnalytics();
}

async function loadAnalytics() {
  try {
    const [trendsRes, peakRes, statsRes] = await Promise.all([
      fetch('/api/dashboard/trends'),
      fetch('/api/dashboard/peak-times'),
      fetch('/api/dashboard/stats')
    ]);

    // Growth chart
    if (trendsRes.ok) {
      const trends = await trendsRes.json();
      if (trends.daily && trends.daily.length) {
        renderChart('chart-growth', 'line', {
          labels: trends.daily.map(d => new Date(d.date).toLocaleDateString('en-US', {month:'short', day:'numeric'})),
          datasets: [{
            label: 'Customers',
            data: trends.daily.map(d => d.count),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.08)',
            tension: 0.3,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: '#2563eb'
          }]
        }, { plugins: { legend: { display: false } } });
      }
    }

    // Peak times heatmap
    if (peakRes.ok) {
      const peak = await peakRes.json();

      // Build heatmap
      const heatEl = document.getElementById('heatmap-container');
      if (heatEl && peak.heatmap) {
        const maxCount = Math.max(...peak.heatmap.map(h => parseInt(h.count)), 1);
        let html = '<table class="w-full text-xs"><thead><tr><th class="text-slate-400 py-1"></th>';
        for (let h = 6; h <= 23; h++) html += `<th class="text-slate-400 py-1 px-1">${h > 12 ? (h-12)+'p' : h+'a'}</th>`;
        html += '</tr></thead><tbody>';
        for (let d = 0; d < 7; d++) {
          html += `<tr><td class="text-slate-500 pr-2 py-1 font-medium">${DAY_NAMES[d]}</td>`;
          for (let h = 6; h <= 23; h++) {
            const cell = peak.heatmap.find(c => parseInt(c.day) === d && parseInt(c.hour) === h);
            const count = cell ? parseInt(cell.count) : 0;
            const intensity = count > 0 ? Math.max(0.15, count / maxCount) : 0;
            html += `<td class="px-1 py-1"><div class="w-full h-6 rounded" style="background:rgba(37,99,235,${intensity})" title="${DAY_NAMES[d]} ${h}:00 — ${count} visitors"></div></td>`;
          }
          html += '</tr>';
        }
        html += '</tbody></table>';
        heatEl.innerHTML = html;
      }
    }

    // Visit frequency + age demographics from stats
    if (statsRes.ok) {
      const stats = await statsRes.json();

      // Age demographics
      if (stats.ageDemographics && stats.ageDemographics.length) {
        renderChart('chart-age', 'doughnut', {
          labels: stats.ageDemographics.map(a => a.age_group),
          datasets: [{
            data: stats.ageDemographics.map(a => a.count),
            backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#6b7280','#14b8a6']
          }]
        }, { plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } } });
      }

      // Cross-location visitors
      const crossEl = document.getElementById('cross-location-container');
      if (crossEl && stats.crossLocationVisitors && stats.crossLocationVisitors.length) {
        crossEl.innerHTML = stats.crossLocationVisitors.map(g => `
          <div class="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <div class="text-sm font-medium text-slate-700">${esc(g.first_name || '')} ${esc(g.last_name || '')}</div>
              <div class="text-xs text-slate-400">${esc(g.email)}</div>
            </div>
            <div class="flex gap-1">${(g.locations || []).map(l =>
              `<span class="text-xs px-1.5 py-0.5 rounded" style="background:${LOCATION_COLORS[l]||'#6b7280'}15;color:${LOCATION_COLORS[l]||'#6b7280'}">${LOCATION_NAMES[l]||l}</span>`
            ).join('')}</div>
          </div>
        `).join('');
      } else if (crossEl) {
        crossEl.innerHTML = '<p class="text-sm text-slate-400 py-4 text-center">No cross-location visitors yet</p>';
      }
    }

  } catch(e) { console.error('Analytics load failed:', e); }
}

// Locations
async function loadLocations() {
  try {
    const res = await fetch('/api/dashboard/locations');
    if (!res.ok) return;
    const data = await res.json();
    const el = document.getElementById('locations-grid');
    if (el && data.locations) {
      el.innerHTML = data.locations.map(l => {
        const name = LOCATION_NAMES[l.location_code] || l.location_code;
        const color = LOCATION_COLORS[l.location_code] || '#6b7280';
        const retPct = l.unique_guests > 0 ? Math.round((l.returning_guests / l.unique_guests) * 100) : 0;
        return `
        <div class="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-3 h-3 rounded-full" style="background:${color}"></div>
            <h3 class="font-semibold text-lg text-slate-800">${esc(name)}</h3>
          </div>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div><span class="text-slate-400">Unique Guests</span><div class="text-xl font-bold text-slate-800">${l.unique_guests}</div></div>
            <div><span class="text-slate-400">Total Visits</span><div class="text-xl font-bold text-slate-800">${l.total_visits}</div></div>
            <div><span class="text-slate-400">New</span><div class="text-emerald-600 font-semibold">${l.new_guests}</div></div>
            <div><span class="text-slate-400">Returning</span><div class="text-blue-600 font-semibold">${l.returning_guests} (${retPct}%)</div></div>
          </div>
        </div>`;
      }).join('');

      // Render comparison chart
      renderChart('chart-location-compare', 'bar', {
        labels: data.locations.map(l => LOCATION_NAMES[l.location_code] || l.location_code),
        datasets: [
          { label: 'New', data: data.locations.map(l => l.new_guests), backgroundColor: '#10b981', borderRadius: 4 },
          { label: 'Returning', data: data.locations.map(l => l.returning_guests), backgroundColor: '#3b82f6', borderRadius: 4 }
        ]
      });
    }
  } catch(e) { console.error('Locations load failed:', e); }
}

// Marketing
async function loadMarketing() {
  try {
    const res = await fetch('/api/dashboard/marketing');
    if (!res.ok) return;
    const data = await res.json();
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('mkt-lapsed30', data.lapsed_30 || 0);
    setEl('mkt-lapsed60', data.lapsed_60 || 0);
    setEl('mkt-lapsed90', data.lapsed_90 || 0);
  } catch(e) { console.error('Marketing load failed:', e); }
}

function exportMarketingList() {
  const location = document.getElementById('marketing-location')?.value || '';
  const segment = document.getElementById('marketing-segment')?.value || '';
  window.location.href = `/api/export/csv?location=${location}&segment=${segment}`;
}

// Admin
async function loadAdmin() {
  showAdminTab('users');
}

function showAdminTab(tab) {
  document.querySelectorAll('[id^="admin-panel-"]').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('[id^="admin-tab-"]').forEach(t => {
    t.classList.remove('text-blue-400', 'border-blue-400');
    t.classList.add('text-gray-400', 'border-transparent');
  });
  document.getElementById(`admin-panel-${tab}`)?.classList.remove('hidden');
  const tabEl = document.getElementById(`admin-tab-${tab}`);
  if (tabEl) {
    tabEl.classList.add('text-blue-400', 'border-blue-400');
    tabEl.classList.remove('text-gray-400', 'border-transparent');
  }
  if (tab === 'users') loadUsers();
  if (tab === 'audit') loadAuditLog();
}

async function loadUsers() {
  try {
    const res = await fetch('/api/admin/users');
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById('users-tbody');
    if (tbody) {
      tbody.innerHTML = data.map(u => `
        <tr class="border-b border-gray-700">
          <td class="px-4 py-3">${esc(u.username)}</td>
          <td class="px-4 py-3">${esc(u.email || '-')}</td>
          <td class="px-4 py-3"><span class="px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'}">${u.role}</span></td>
          <td class="px-4 py-3"><span class="${u.is_active ? 'text-green-400' : 'text-red-400'}">${u.is_active ? 'Active' : 'Disabled'}</span></td>
          <td class="px-4 py-3 text-right space-x-2">
            <button onclick="openPwModal(${u.id})" class="text-yellow-400 hover:text-yellow-300 text-sm">🔑</button>
            <button onclick="toggleUser(${u.id}, ${!u.is_active})" class="text-gray-400 hover:text-white text-sm">${u.is_active ? '🚫' : '✅'}</button>
          </td>
        </tr>
      `).join('');
    }
  } catch(e) { console.error('Users load failed:', e); }
}

async function loadAuditLog() {
  try {
    const res = await fetch('/api/admin/audit-log');
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById('audit-tbody');
    if (tbody) {
      tbody.innerHTML = data.map(a => `
        <tr class="border-b border-gray-700">
          <td class="px-4 py-3 text-xs text-gray-400">${new Date(a.created_at).toLocaleString()}</td>
          <td class="px-4 py-3">${esc(a.username || 'system')}</td>
          <td class="px-4 py-3">${esc(a.action)}</td>
          <td class="px-4 py-3 text-sm text-gray-400">${esc(a.details || '')}</td>
        </tr>
      `).join('');
    }
  } catch(e) { console.error('Audit log load failed:', e); }
}

function openUserModal(id) {
  document.getElementById('user-modal-title').textContent = id ? 'Edit User' : 'Add User';
  document.getElementById('user-modal-id').value = id || '';
  document.getElementById('user-username').value = '';
  document.getElementById('user-email').value = '';
  const pwField = document.getElementById('user-password');
  if (pwField) pwField.value = '';
  document.getElementById('user-role').value = 'viewer';
  // Show/hide password field for edit vs add
  const pwContainer = document.getElementById('user-password-field');
  if (pwContainer) pwContainer.style.display = id ? 'none' : 'block';
  const activeField = document.getElementById('user-active-field');
  if (activeField) activeField.classList.toggle('hidden', !id);
  document.getElementById('user-modal').classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function openPwModal(id) {
  document.getElementById('pw-user-id').value = id;
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-modal').classList.remove('hidden');
}

async function saveUser() {
  const id = document.getElementById('user-modal-id').value;
  const body = {
    username: document.getElementById('user-username').value,
    email: document.getElementById('user-email').value,
    password: document.getElementById('user-password').value,
    role: document.getElementById('user-role').value
  };
  try {
    const res = await fetch(id ? `/api/admin/users/${id}` : '/api/admin/users', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) { closeModal('user-modal'); loadUsers(); }
    else { const d = await res.json(); alert(d.error || 'Failed'); }
  } catch(e) { alert('Error saving user'); }
}

async function resetPassword() {
  const id = document.getElementById('pw-user-id').value;
  const password = document.getElementById('pw-new').value;
  if (password.length < 6) { document.getElementById('pw-modal-err').textContent = 'Min 6 characters'; document.getElementById('pw-modal-err').classList.remove('hidden'); return; }
  try {
    const res = await fetch(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) { closeModal('pw-modal'); loadUsers(); }
  } catch(e) { alert('Error resetting password'); }
}

async function toggleUser(id, active) {
  try {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: active })
    });
    loadUsers();
  } catch(e) {}
}

async function saveSettings() {
  const webhookUrl = document.getElementById('setting-webhook-url')?.value || '';
  try {
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhook_url: webhookUrl })
    });
    alert('Settings saved');
  } catch(e) { alert('Error saving settings'); }
}

async function testWebhook() {
  try {
    const res = await fetch('/api/admin/settings/test-webhook', { method: 'POST' });
    const data = await res.json();
    alert(data.success ? 'Webhook sent!' : 'Webhook failed: ' + (data.error || 'Unknown'));
  } catch(e) { alert('Error testing webhook'); }
}

function refreshCurrentPage() {
  const active = document.querySelector('.nav-item.active');
  if (active) active.click();
}

function sortGuests(field) {
  // TODO: implement sort
  searchGuests(1);
}

function exportSelectedGuests() {
  exportCsv();
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
