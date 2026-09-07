let allPosters = [];
let allDivisions = [];
let charts = {};
let analytics = null;
let currentView = 'overview';
let dashboardLoaded = false;
const REFRESH_INTERVAL_MS = 30000;

const byId = (id) => document.getElementById(id);
const clean = (value) => value || 'Unknown';
const countBy = (rows, key) => rows.reduce((counts, row) => { const value = clean(row[key]); counts[value] = (counts[value] || 0) + 1; return counts; }, {});

function makeChart(id, type, labels, values, options = {}) {
  if (charts[id]) charts[id].destroy();
  const palette = options.palette || ['#5d5bea', '#10b9c5', '#22b987', '#ffae3d', '#f36b73', '#8b72e8'];
  const canvas = byId(id);
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, 320);
  gradient.addColorStop(0, options.fill || 'rgba(93,91,234,.3)');
  gradient.addColorStop(1, 'rgba(93,91,234,.02)');
  const circular = type === 'doughnut' || type === 'polarArea';
  charts[id] = new Chart(byId(id), {
    type,
    data: { labels, datasets: [{ data: values, borderColor: type === 'line' ? (options.lineColor || options.color || '#5d5bea') : 'transparent', backgroundColor: circular ? palette : (type === 'line' ? gradient : (options.fill || '#5d5bea')), borderWidth: type === 'line' ? 3 : 0, fill: type === 'line', tension: type === 'line' ? .45 : .38, borderRadius: type === 'bar' ? 8 : 0, pointRadius: type === 'line' ? 3 : 0, pointHoverRadius: type === 'line' ? 8 : 7, pointBackgroundColor: type === 'line' ? '#fff' : (options.color || '#5d5bea'), pointBorderColor: type === 'line' ? (options.lineColor || options.color || '#5d5bea') : 'transparent', pointBorderWidth: type === 'line' ? 2 : 0, hoverBorderWidth: 0, hoverOffset: circular ? 6 : 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 1350, easing: 'easeOutQuart' },
      transitions: { active: { animation: { duration: 260 } }, resize: { animation: { duration: 450 } } },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: circular, position: 'bottom', labels: { usePointStyle: true, padding: 18, color: '#697795', font: { family: 'DM Sans', weight: '600' } } }, tooltip: { backgroundColor: '#17243e', padding: 13, cornerRadius: 10, displayColors: true, titleColor: '#fff', bodyColor: '#dce8ff', borderWidth: 0 } },
      scales: circular ? {} : { y: { beginAtZero: true, border: { display: false }, grid: { color: type === 'line' ? 'rgba(93,91,234,.09)' : 'rgba(71,91,140,.1)', drawTicks: false }, ticks: { color: '#8090ad', padding: 8 } }, x: { border: { display: false }, grid: { display: false }, ticks: { color: '#8090ad', maxRotation: type === 'bar' ? 0 : 45, autoSkip: true, maxTicksLimit: 12, padding: 6 } } },
      indexAxis: options.indexAxis || 'x'
    }
  });
}

const escapeHtml = (value) => String(clean(value)).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
const chartLabels = (rows) => rows.map((row) => row.label);
const chartValues = (rows) => rows.map((row) => Number(row.total));

function filteredRows() {
  const campaign = byId('campaignFilter').value;
  const start = byId('startDate').value;
  const end = byId('endDate').value;
  return allPosters.filter((row) => {
    const created = (row.GEN_POSTER_CREATED_TS || '').slice(0, 10);
    return (campaign === 'All campaigns' || clean(row.CAMPAIGN_NAME) === campaign) && (!start || created >= start) && (!end || created <= end);
  });
}

function divisionRows() {
  return Object.entries(countBy(divisionFilteredRows(), 'DIVISION_ID')).sort((a, b) => b[1] - a[1]);
}

function divisionName(id) {
  const division = allDivisions.find((item) => String(item.DIVISION_ID) === String(id));
  return division ? (division.DIVISON_NAME || division.DIVISION_SHORTNAME || `Division ${id}`) : `Unknown division (${id})`;
}

function divisionFilteredRows() {
  const division = byId('divisionFilter').value;
  const campaign = byId('divisionCampaignFilter').value;
  const start = byId('divisionStartDate').value;
  const end = byId('divisionEndDate').value;
  return allPosters.filter((row) => {
    const created = (row.GEN_POSTER_CREATED_TS || '').slice(0, 10);
    return (division === 'All divisions' || String(row.DIVISION_ID) === division) && (campaign === 'All campaigns' || clean(row.CAMPAIGN_NAME) === campaign) && (!start || created >= start) && (!end || created <= end);
  });
}

function renderDivisionView() {
  const rows = divisionFilteredRows();
  const divisions = divisionRows();
  const selectedDivision = byId('divisionFilter').value;
  const directoryDivisions = allDivisions.filter((division) => {
    if (selectedDivision !== 'All divisions') return String(division.DIVISION_ID) === selectedDivision;
    return rows.some((row) => String(row.DIVISION_ID) === String(division.DIVISION_ID));
  });
  const labels = divisions.map((item) => divisionName(item[0]));
  byId('divisionCount').textContent = divisions.length.toLocaleString();
  makeChart('divisionChart', 'polarArea', labels, divisions.map((item) => item[1]), { palette: ['#5d5bea', '#10b9c5', '#22b987', '#ffae3d', '#f36b73', '#8b72e8', '#3478db', '#13a49f'], color: '#17243e' });
  makeChart('divisionShareChart', 'doughnut', labels.slice(0, 8), divisions.slice(0, 8).map((item) => item[1]), { palette: ['#17243e', '#5d5bea', '#10b9c5', '#22b987', '#ffae3d', '#f36b73', '#8b72e8', '#3478db'] });
  const topCampaigns = [...new Set(rows.map((row) => clean(row.CAMPAIGN_NAME)))].slice(0, 5);
  const campaignValues = topCampaigns.map((campaign) => rows.filter((row) => clean(row.CAMPAIGN_NAME) === campaign).length);
  makeChart('divisionCampaignChart', 'bar', topCampaigns, campaignValues, { color: '#5d5bea', fill: '#5d5bea' });
  const counts = countBy(rows, 'DIVISION_ID');
  byId('divisionRecords').innerHTML = directoryDivisions.map((division) => {
    const divisionRowsForRecord = rows.filter((row) => String(row.DIVISION_ID) === String(division.DIVISION_ID));
    const campaignsForDivision = [...new Set(divisionRowsForRecord.map((row) => clean(row.CAMPAIGN_NAME)))].sort();
    const active = Number(division.STATUS) === 1001;
    return `<tr><td><strong>${escapeHtml(division.DIVISON_NAME || division.DIVISION_SHORTNAME || `Division ${division.DIVISION_ID}`)}</strong><small class="division-code">#${escapeHtml(division.DIVISION_ID)}</small></td><td><span class="status-pill ${active ? 'status-active' : 'status-inactive'}">${active ? 'Active' : 'Inactive'}</span></td><td>${(counts[division.DIVISION_ID] || 0).toLocaleString()}</td><td>${campaignsForDivision.length ? campaignsForDivision.map(escapeHtml).join(', ') : 'No campaigns in selection'}</td></tr>`;
  }).join('');
}

function setView(view) {
  const pages = ['overview', 'division', 'operations', 'audience', 'catalog'];
  currentView = view;
  const division = view === 'division';
  byId('filterBar').classList.toggle('d-none', view !== 'overview');
  pages.forEach((page) => {
    const content = byId(`${page}Content`);
    const button = byId(`${page}View`);
    if (content) content.classList.toggle('d-none', page !== view);
    if (button) button.classList.toggle('active', page === view);
  });
  document.querySelectorAll('.module-link').forEach((link) => link.classList.toggle('active', link.dataset.view === view));
  if (division) {
    populateDivisionCampaigns();
    renderDivisionView();
  }
  if (view === 'operations' || view === 'audience' || view === 'catalog') renderAnalyticsPage(view);
}

function renderSummaryCards(targetId, rows) {
  byId(targetId).innerHTML = rows.map((row) => `<div class="col-12 col-sm-6 col-xl-3"><div class="metric analytics-metric"><span>${escapeHtml(row.label)}</span><strong>${Number(row.total).toLocaleString()}</strong><small>Live database summary</small></div></div>`).join('');
}

function renderCatalogTable() {
  const filter = byId('catalogStatusFilter').value;
  const rows = analytics.catalog.campaigns.filter((row) => {
    const needsAttention = Number(row.active_cards) < Number(row.cards) || Number(row.field_configs) < Number(row.cards);
    return filter === 'all' || (filter === 'active' && Number(row.STATUS) === 1001) || (filter === 'incomplete' && needsAttention);
  });
  byId('catalogRecords').innerHTML = rows.map((row) => {
    const cards = Number(row.cards);
    const activeCards = Number(row.active_cards);
    const forms = Number(row.field_configs);
    const ready = Number(row.STATUS) === 1001 && activeCards >= cards && forms >= cards;
    const status = ready ? 'Ready' : Number(row.STATUS) === 1001 ? 'Needs attention' : 'Inactive';
    return `<tr><td><strong>${escapeHtml(row.CAMPAIGN_NAME)}</strong><small class="division-code">#${escapeHtml(row.CAMPAIGN_ID)}</small></td><td>${escapeHtml(divisionName(row.DIVISION_ID))}</td><td>${escapeHtml(row.CARD_FROM_DATE || '—')} → ${escapeHtml(row.CARD_TO_DATE || '—')}</td><td>${cards.toLocaleString()}</td><td>${activeCards.toLocaleString()}</td><td>${forms.toLocaleString()}</td><td><span class="status-pill ${ready ? 'status-active' : 'status-inactive'}">${status}</span></td></tr>`;
  }).join('');
}

function renderAnalyticsPage(view) {
  if (!analytics) return;
  if (view === 'operations') {
    const operations = analytics.operations;
    makeChart('operationsMonthlyChart', 'line', chartLabels(operations.monthly_output), chartValues(operations.monthly_output), { color: '#10b9c5', lineColor: '#0b9eaf', fill: 'rgba(16,185,197,.24)' });
    makeChart('operationsStatusChart', 'doughnut', chartLabels(operations.status), chartValues(operations.status), { palette: ['#22b987', '#ffae3d', '#f36b73'] });
    makeChart('operationsCardChart', 'bar', chartLabels(operations.card_types).slice(0, 8), chartValues(operations.card_types).slice(0, 8), { color: '#5d5bea', fill: '#5d5bea', indexAxis: 'y' });
    makeChart('operationsSourceChart', 'doughnut', chartLabels(operations.sources), chartValues(operations.sources), { palette: ['#5d5bea', '#10b9c5', '#22b987', '#ffae3d', '#f36b73'] });
    makeChart('operationsEmployeeChart', 'bar', chartLabels(operations.employee_output), chartValues(operations.employee_output), { color: '#10b9c5', fill: '#10b9c5', indexAxis: 'y' });
  }
  if (view === 'audience') {
    renderSummaryCards('audienceSummary', analytics.audience.summary);
    makeChart('audienceSpecialtyChart', 'bar', chartLabels(analytics.audience.specialties).slice(0, 10), chartValues(analytics.audience.specialties).slice(0, 10), { color: '#22b987', fill: '#22b987', indexAxis: 'y' });
    makeChart('audienceServiceChart', 'doughnut', chartLabels(analytics.audience.services), chartValues(analytics.audience.services), { palette: ['#f36b73', '#5d5bea', '#10b9c5', '#ffae3d'] });
  }
  if (view === 'catalog') {
    renderSummaryCards('catalogSummary', analytics.catalog.summary);
    renderCatalogTable();
  }
}

function populateDivisionCampaigns() {
  const division = byId('divisionFilter').value;
  const campaignSelect = byId('divisionCampaignFilter');
  const currentCampaign = campaignSelect.value;
  const campaigns = [...new Set(allPosters.filter((row) => division === 'All divisions' || String(row.DIVISION_ID) === division).map((row) => clean(row.CAMPAIGN_NAME)))].sort();
  campaignSelect.replaceChildren(new Option('All campaigns', 'All campaigns'), ...campaigns.map((campaign) => new Option(campaign, campaign)));
  campaignSelect.value = campaigns.includes(currentCampaign) ? currentCampaign : 'All campaigns';
}

function render() {
  const rows = filteredRows();
  byId('posterCount').textContent = rows.length.toLocaleString();
  byId('doctorCount').textContent = new Set(rows.map((row) => clean(row.DOCTOR_NAME))).size.toLocaleString();
  byId('recordSummary').textContent = `${rows.length.toLocaleString()} records`;
  const daily = countBy(rows.map((row) => ({ date: (row.GEN_POSTER_CREATED_TS || '').slice(0, 10) })), 'date');
  const selectedCampaign = byId('campaignFilter').value;
  byId('campaignName').textContent = selectedCampaign;
  byId('pageTitle').textContent = selectedCampaign === 'All campaigns' ? 'Analytics dashboard' : selectedCampaign;
  byId('pageSubtitle').textContent = selectedCampaign === 'All campaigns' ? 'Poster generation activity across campaigns and regions.' : 'Campaign performance, reach, and poster generation activity.';
  byId('campaignDescription').textContent = selectedCampaign === 'All campaigns' ? 'A combined view of poster generation activity.' : `Performance view for ${selectedCampaign}.`;
  const regions = Object.entries(countBy(rows, 'REGION')).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const campaigns = Object.entries(countBy(rows, 'CAMPAIGN_NAME')).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const sortedDates = Object.keys(daily).sort();
  makeChart('activityChart', 'line', sortedDates, sortedDates.map((key) => daily[key]), { color: '#f36b73', lineColor: '#df596a', fill: 'rgba(243,107,115,.24)' });
  makeChart('regionChart', 'doughnut', regions.map((item) => item[0]), regions.map((item) => item[1]), { palette: ['#5d5bea', '#10b9c5', '#22b987', '#ffae3d', '#f36b73', '#8b72e8'] });
  makeChart('campaignChart', 'bar', campaigns.map((item) => item[0]), campaigns.map((item) => item[1]), { color: '#5d5bea', fill: '#5d5bea', indexAxis: 'y' });
  byId('peakRegion').textContent = regions.length ? `${regions[0][0]} · ${regions[0][1].toLocaleString()}` : 'No data';
  byId('records').innerHTML = rows.slice(0, 100).map((row) => `<tr><td>${escapeHtml(row.GEN_POSTER_CREATED_TS)}</td><td>${escapeHtml(row.CAMPAIGN_NAME)}</td><td>${escapeHtml(row.CARD_NAME)}</td><td>${escapeHtml(row.REGION)}</td><td>${escapeHtml(row.EMPLOYEE_NAME)}</td><td>${escapeHtml(row.DOCTOR_NAME)}</td><td>${escapeHtml(row.CARD_TYPE)}</td></tr>`).join('');
}

function selectCampaign(campaign) {
  byId('campaignFilter').value = campaign;
  document.querySelectorAll('.campaign-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.campaign === campaign));
  render();
}

function downloadCsv() {
  const rows = filteredRows();
  const columns = ['GEN_POSTER_ID', 'GEN_POSTER_CREATED_TS', 'CAMPAIGN_NAME', 'CARD_NAME', 'REGION', 'EMPLOYEE_NAME', 'DOCTOR_NAME', 'CARD_TYPE', 'GEN_POSTER_STATUS'];
  const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => `"${String(row[column] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'hhcl_ecards_filtered_posters.csv'; link.click(); URL.revokeObjectURL(link.href);
}

function loadDashboardData() {
  return fetch(`/api/dashboard?refresh=${Date.now()}`, { cache: 'no-store' }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }).then((data) => {
    allPosters = data.posters || [];
    allDivisions = data.divisions || [];
    byId('divisionFilterSummary').textContent = `${allDivisions.length.toLocaleString()} available`;
    byId('campaignCount').textContent = Number(data.campaigns || 0).toLocaleString();
    byId('cardCount').textContent = Number(data.active_cards || 0).toLocaleString();

    const selectedCampaign = byId('campaignFilter').value;
    byId('campaignFilter').replaceChildren(new Option('All campaigns', 'All campaigns'));
    [...new Set(allPosters.map((row) => clean(row.CAMPAIGN_NAME)))].sort().forEach((campaign) => byId('campaignFilter').add(new Option(campaign, campaign)));
    byId('campaignFilter').value = [...byId('campaignFilter').options].some((option) => option.value === selectedCampaign) ? selectedCampaign : 'All campaigns';

    const selectedDivision = byId('divisionFilter').value;
    byId('divisionFilter').replaceChildren(new Option('All divisions', 'All divisions'));
    allDivisions.slice().sort((a, b) => (a.DIVISON_NAME || '').localeCompare(b.DIVISON_NAME || '')).forEach((division) => byId('divisionFilter').add(new Option(division.DIVISON_NAME || division.DIVISION_SHORTNAME || `Division ${division.DIVISION_ID}`, division.DIVISION_ID)));
    byId('divisionFilter').value = [...byId('divisionFilter').options].some((option) => option.value === selectedDivision) ? selectedDivision : 'All divisions';

    if (!dashboardLoaded) {
      const dates = allPosters.map((row) => (row.GEN_POSTER_CREATED_TS || '').slice(0, 10)).filter(Boolean).sort();
      if (dates.length) { byId('startDate').value = dates[0]; byId('endDate').value = dates[dates.length - 1]; }
      dashboardLoaded = true;
    }
    if (currentView === 'division') { populateDivisionCampaigns(); renderDivisionView(); }
    else render();
  }).catch((error) => { byId('error').textContent = `Could not load dashboard data: ${error.message}`; byId('error').classList.remove('d-none'); throw error; });
}

loadDashboardData();
setInterval(loadDashboardData, REFRESH_INTERVAL_MS);

['startDate', 'endDate'].forEach((id) => byId(id).addEventListener('change', render));
byId('campaignFilter').addEventListener('change', () => selectCampaign(byId('campaignFilter').value));
byId('resetFilters').addEventListener('click', () => { byId('startDate').value = ''; byId('endDate').value = ''; selectCampaign('All campaigns'); loadDashboardData(); });
byId('downloadCsv').addEventListener('click', downloadCsv);
byId('overviewView').addEventListener('click', () => setView('overview'));
byId('divisionView').addEventListener('click', () => setView('division'));
byId('operationsView').addEventListener('click', () => setView('operations'));
byId('audienceView').addEventListener('click', () => setView('audience'));
byId('catalogView').addEventListener('click', () => setView('catalog'));
document.querySelectorAll('.module-link').forEach((link) => link.addEventListener('click', () => setView(link.dataset.view)));
byId('divisionFilter').addEventListener('change', () => { populateDivisionCampaigns(); renderDivisionView(); });
byId('divisionCampaignFilter').addEventListener('change', renderDivisionView);
['divisionStartDate', 'divisionEndDate'].forEach((id) => byId(id).addEventListener('change', renderDivisionView));
byId('divisionResetFilters').addEventListener('click', () => {
  byId('divisionFilter').value = 'All divisions';
  byId('divisionCampaignFilter').value = 'All campaigns';
  byId('divisionStartDate').value = '';
  byId('divisionEndDate').value = '';
  populateDivisionCampaigns();
  renderDivisionView();
  loadDashboardData();
});
byId('catalogStatusFilter').addEventListener('change', renderCatalogTable);

fetch('/api/analytics').then(async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}).then((data) => {
  analytics = data;
  if (currentView !== 'overview' && currentView !== 'division') renderAnalyticsPage(currentView);
}).catch((error) => {
  byId('error').textContent = `Could not load extended analytics: ${error.message}`;
  byId('error').classList.remove('d-none');
});
