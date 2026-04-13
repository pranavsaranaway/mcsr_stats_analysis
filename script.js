/* ── Theme ── */
(function () {
    const saved = localStorage.getItem('mcsr-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
})();

function getThemeColors() {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return {
        grid:    light ? '#e8e8ee' : '#1e1e21',
        tick:    light ? '#aaaabc' : '#55555f',
        accent:  light ? '#16a34a' : '#3fb950',
        fill:    light ? 'rgba(22,163,74,.1)' : 'rgba(63,185,80,.12)',
    };
}

document.getElementById('themeToggle').addEventListener('click', () => {
    const html  = document.documentElement;
    const next  = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('mcsr-theme', next);
    if (currentTab === 'elo' && eloChart) renderEloChart();
    else if (currentTab === 'splits' && splitsRadarChart) renderSplits();
});

/* ── State ── */
let eloChart = null;
let allMatches = [];       // summary matches from /matches
let matchDetails = {};     // cache: id -> full match detail with timelines
let currentMode = 'ranked';
let currentCount = 50;
let currentTab = 'elo';
let playerUuid = '';

// Ordered checkpoints — each split's time = delta from previous checkpoint
// Overworld = 0 → nether, Nether terrain = nether → bastion, etc.
const CHECKPOINTS = [
    { key: 'story.enter_the_nether',           label: 'Overworld'  },
    { key: 'nether.find_bastion',              label: 'Nether'     },
    { key: 'nether.find_fortress',             label: 'Bastion'    },
    { key: 'projectelo.timeline.blind_travel', label: 'Fortress'   },
    { key: 'story.follow_ender_eye',           label: 'Blind'      },
    { key: 'story.enter_the_end',              label: 'Stronghold' },
    { key: 'story.enter_the_end',              label: 'End'        }, // absolute, not delta
];

// What we display — 7 segments
const SPLITS = [
    { label: 'Overworld',   icon: '<img src="images/overworld_icon.png"  class="split-img-icon" alt="Overworld">',  segStart: null,                               segEnd: 'story.enter_the_nether'           },
    { label: 'Nether',      icon: '<img src="images/nether_icon.png"  class="split-img-icon" alt="Nether">',                                                                              segStart: 'story.enter_the_nether',           segEnd: 'nether.find_bastion'              },
    { label: 'Bastion',     icon: '<img src="images/bastion_icon.png"    class="split-img-icon" alt="Bastion">',    segStart: 'nether.find_bastion',              segEnd: 'nether.find_fortress'             },
    { label: 'Fortress',    icon: '<img src="images/fortress_icon.png"   class="split-img-icon" alt="Fortress">',   segStart: 'nether.find_fortress',             segEnd: 'projectelo.timeline.blind_travel' },
    { label: 'Blind',       icon: '<img src="images/blind_icon.webp"     class="split-img-icon" alt="Blind">',      segStart: 'projectelo.timeline.blind_travel', segEnd: 'story.follow_ender_eye'           },
    { label: 'Stronghold',  icon: '<img src="images/stronnghold_icon.png" class="split-img-icon" alt="Stronghold">',segStart: 'story.follow_ender_eye',           segEnd: 'story.enter_the_end'              },
    { label: 'End',         icon: '<img src="images/end_icon.png"        class="split-img-icon" alt="End">',        segStart: 'story.enter_the_end',              segEnd: null, useResultTime: true           },
];

// Benchmark times per split in ms: [elite≈top1%, top5%, top10%, top25%, median, floor]
// floor is generous (bad-but-not-unheard-of) so typical players don't score 0.
const SPLIT_BENCHMARKS = {
    'Overworld':  [ 85000, 110000, 135000, 175000, 215000, 360000],
    'Nether':     [ 50000,  65000,  80000, 105000, 135000, 240000],
    'Bastion':    [ 75000, 100000, 125000, 165000, 205000, 360000],
    'Fortress':   [ 60000,  80000, 100000, 135000, 170000, 300000],
    'Blind':      [ 25000,  38000,  52000,  72000,  95000, 180000],
    'Stronghold': [ 30000,  45000,  60000,  82000, 108000, 200000],
    'End':        [ 22000,  32000,  44000,  60000,  80000, 150000],
};

let splitsRadarChart = null;

function splitScore(avgMs, label) {
    const b = SPLIT_BENCHMARKS[label];
    if (!b || avgMs <= 0) return null;
    const [elite, , , , , slow] = b;
    return Math.max(0, Math.min(100, (slow - avgMs) / (slow - elite) * 100));
}

function scoreTier(score) {
    if (score >= 80) return 'Top 5%';
    if (score >= 65) return 'Top 10%';
    if (score >= 45) return 'Top 25%';
    if (score >= 28) return 'Top 50%';
    return 'Bottom 50%';
}

/* ── Helpers ── */
function msToTime(ms) {
    if (!ms) return '—';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function getFilteredMatches() {
    return allMatches
        .filter(m => {
            if (currentMode === 'ranked')  return m.type === 2;
            if (currentMode === 'casual')  return m.type === 1;
            if (currentMode === 'private') return m.type === 3;
            return true;
        })
        .slice(0, currentCount);
}

/* ── Elo Chart ── */
function renderEloChart() {
    const canvas      = document.getElementById('eloCanvas');
    const placeholder = document.getElementById('chartPlaceholder');

    const matches = getFilteredMatches().filter(m => m.changes && m.changes.length > 0);

    const points = matches
        .slice().reverse()
        .map(m => {
            const myChange = m.changes.find(c => c.uuid === playerUuid);
            if (!myChange) return null;
            return {
                elo:  myChange.eloRate,
                date: new Date(m.date * 1000).toLocaleDateString([], { month: 'numeric', day: 'numeric' }),
            };
        })
        .filter(Boolean);

    if (points.length === 0) {
        if (eloChart) { eloChart.destroy(); eloChart = null; }
        canvas.classList.add('hidden');
        placeholder.classList.remove('hidden');
        placeholder.textContent = currentMode === 'private'
            ? 'Private matches have no elo data'
            : 'No elo data found — try switching to Ranked';
        return;
    }
    canvas.classList.remove('hidden');
    placeholder.classList.add('hidden');

    if (eloChart) eloChart.destroy();

    const c = getThemeColors();
    eloChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: points.map(p => p.date),
            datasets: [{
                label: 'Elo',
                data:  points.map(p => p.elo),
                borderColor:     c.accent,
                backgroundColor: c.fill,
                fill:     true,
                tension:  0.35,
                pointRadius:          4,
                pointHoverRadius:     6,
                pointBackgroundColor: c.accent,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { grid: { color: c.grid }, ticks: { color: c.tick, font: { size: 12 } } },
                x: { grid: { color: c.grid }, ticks: { color: c.tick, font: { size: 12 } } },
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` Elo: ${ctx.parsed.y}` } },
            },
        },
    });
}

/* ── Splits ── */
async function renderSplits() {
    if (splitsRadarChart) { splitsRadarChart.destroy(); splitsRadarChart = null; }
    const body = document.getElementById('splitsBody');
    const matches = getFilteredMatches();

    if (matches.length === 0) {
        body.innerHTML = '<p class="splits-empty">No matches for this filter.</p>';
        return;
    }

    // Show loading state
    body.innerHTML = '<p class="splits-empty">Loading split data…</p>';

    // Fetch individual match details for any we don't have cached
    const uncached = matches.filter(m => !matchDetails[m.id]);
    if (uncached.length > 0) {
        // Batch in groups of 10 to avoid hammering the API
        for (let i = 0; i < uncached.length; i += 10) {
            const batch = uncached.slice(i, i + 10);
            await Promise.all(batch.map(async m => {
                try {
                    const res  = await fetch(`https://api.mcsrranked.com/matches/${m.id}`);
                    const data = await res.json();
                    if (data.status === 'success') matchDetails[m.id] = data.data;
                } catch(e) { /* skip failed */ }
            }));
        }
    }

    // Aggregate split times as SEGMENT deltas (time between checkpoints)
    const sums   = {};
    const counts = {};
    SPLITS.forEach(s => { sums[s.label] = 0; counts[s.label] = 0; });

    matches.forEach(m => {
        const detail = matchDetails[m.id];
        if (!detail) return;
        const tl = detail.timelines;
        if (!Array.isArray(tl)) return;

        // Build a lookup of { eventType -> time } for this player
        const evtMap = {};
        tl.filter(e => e.uuid === playerUuid).forEach(e => { evtMap[e.type] = e.time; });

        SPLITS.forEach(s => {
            let delta;
            if (s.useResultTime) {
                // "End" split = time from entering the end to run finish
                const startTime = evtMap[s.segStart];
                const finishTime = m.result?.time;
                if (!startTime || !finishTime) return;
                delta = finishTime - startTime;
            } else {
                const endTime = evtMap[s.segEnd];
                if (!endTime) return; // player didn't reach this checkpoint
                const startTime = s.segStart ? evtMap[s.segStart] : 0;
                if (s.segStart && !startTime) return; // didn't reach previous checkpoint
                delta = endTime - (startTime || 0);
            }

            if (delta > 0) { sums[s.label] += delta; counts[s.label]++; }
        });
    });

    const avgs = SPLITS.map(s => ({
        ...s,
        avg: counts[s.label] > 0 ? sums[s.label] / counts[s.label] : 0,
        n:   counts[s.label],
    }));

    // Check if we got any data at all
    const hasData = avgs.some(a => a.n > 0);
    if (!hasData) {
        body.innerHTML = '<p class="splits-empty">No timeline data available for these matches.<br>The MCSR API only stores splits for some match types.</p>';
        return;
    }

    // Completions = matches where player reached the end
    const completions = matches.filter(m => {
        const detail = matchDetails[m.id];
        if (!detail?.timelines) return false;
        return detail.timelines.some(e => e.uuid === playerUuid && e.type === 'story.enter_the_end');
    }).length;

    body.innerHTML = `
    <p class="splits-meta">${matches.length} games analysed &nbsp;·&nbsp; ${completions} completions</p>
    <div class="splits-grid">${
        avgs.map(a => `
        <div class="split-card">
            <div class="split-icon">${a.icon}</div>
            <div class="split-card-label">${a.label}</div>
            <div class="split-card-time">${a.avg > 0 ? msToTime(a.avg) : '—'}</div>
            <div class="split-card-count">${a.n > 0 ? `${a.n} runs` : 'no data'}</div>
        </div>`).join('')
    }</div>
    <div class="splits-radar-wrap">
        <div class="splits-radar-header">
            <span class="splits-radar-title">Split performance</span>
            <span class="splits-radar-tier" id="splitsTier"></span>
        </div>
        <div class="splits-radar-chart">
            <canvas id="splitsRadar"></canvas>
        </div>
        <p class="splits-radar-note">Scores vs. approximate community benchmarks &mdash; higher is faster</p>
    </div>`;

    renderSplitsRadar(avgs);
}

function renderSplitsRadar(avgs) {
    const canvas = document.getElementById('splitsRadar');
    if (!canvas) return;

    // Only plot splits that actually have data — null values render as 0 in radar charts
    const withData = avgs.filter(a => a.n > 0);
    if (withData.length < 3) return; // need at least 3 axes for a meaningful radar

    const scores = withData.map(a => splitScore(a.avg, a.label));

    // Compute overall estimated tier
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const tierEl = document.getElementById('splitsTier');
    if (tierEl) tierEl.textContent = `~${scoreTier(avgScore)} overall`;

    const c = getThemeColors();
    const n = withData.length;
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const gridColor  = isLight ? 'rgba(0,0,0,0.08)'  : 'rgba(255,255,255,0.07)';
    const labelColor = isLight ? '#55555f' : '#9a9aa8';

    splitsRadarChart = new Chart(canvas.getContext('2d'), {
        type: 'radar',
        data: {
            labels: withData.map(a => a.label),
            datasets: [
                {
                    label: 'You',
                    data: scores,
                    borderColor: c.accent,
                    backgroundColor: c.fill,
                    pointBackgroundColor: c.accent,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                },
                {
                    label: 'Top 10%',
                    data: new Array(n).fill(65),
                    borderColor: 'rgba(250,200,50,0.65)',
                    backgroundColor: 'transparent',
                    borderDash: [5, 4],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                },
                {
                    label: 'Top 25%',
                    data: new Array(n).fill(45),
                    borderColor: 'rgba(110,150,255,0.5)',
                    backgroundColor: 'transparent',
                    borderDash: [5, 4],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    min: 0,
                    max: 100,
                    ticks: { display: false, stepSize: 25 },
                    grid: { color: gridColor },
                    angleLines: { color: gridColor },
                    pointLabels: {
                        color: labelColor,
                        font: { size: 12, weight: '600' },
                    },
                },
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: labelColor,
                        boxWidth: 12,
                        padding: 20,
                        font: { size: 12 },
                        usePointStyle: true,
                        pointStyleWidth: 10,
                    },
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            if (ctx.dataset.label === 'You') {
                                // Use the scores closure — ctx.parsed.r would show 0 for null
                                const s = scores[ctx.dataIndex];
                                return s != null ? ` ${s.toFixed(0)}/100 — ${scoreTier(s)}` : ' No data';
                            }
                            return ` ${ctx.dataset.label} benchmark`;
                        },
                    },
                },
            },
        },
    });
}

/* ── Match Log ── */
function renderMatches() {
    const list    = document.getElementById('matchList');
    const matches = getFilteredMatches();

    if (matches.length === 0) {
        list.innerHTML = '<p class="splits-empty">No matches for this filter.</p>';
        return;
    }

    list.innerHTML = matches.map(m => {
        const myChange   = m.changes ? m.changes.find(c => c.uuid === playerUuid) : null;
        const opps       = (m.players || []).filter(x => x.uuid !== playerUuid);
        const oppName    = opps.length > 0 ? opps[0].nickname : '?';
        const winnerUuid = m.result?.uuid ?? null;
        const isDraw     = !winnerUuid;
        const won        = winnerUuid === playerUuid;

        const badgeCls = isDraw ? 'draw' : won ? 'win' : 'loss';
        const badgeTxt = isDraw ? 'D'   : won ? 'W'  : 'L';

        const delta     = myChange?.change ?? null;
        const deltaText = delta !== null ? (delta >= 0 ? `+${delta}` : `${delta}`) : '—';
        const deltaCls  = delta !== null ? (delta >= 0 ? 'up' : 'down') : '';

        const modeLabel  = m.type === 2 ? 'Ranked' : m.type === 1 ? 'Casual' : 'Private';
        const finishTime = m.result?.time ? msToTime(m.result.time) : '—';

        return `
        <div class="match-item">
            <span class="badge ${badgeCls}">${badgeTxt}</span>
            <span class="match-opp">vs ${oppName}</span>
            <span class="match-mode">${modeLabel}</span>
            <span class="match-time">${finishTime}</span>
            <span class="match-elo ${deltaCls}">${deltaText}</span>
        </div>`;
    }).join('');
}

/* ── Render dispatch ── */
function renderCurrentTab() {
    if (currentTab === 'elo')          renderEloChart();
    else if (currentTab === 'splits')  renderSplits();
    else if (currentTab === 'matches') renderMatches();
}

/* ── Fetch ── */
async function fetchStats() {
    const username = document.getElementById('usernameInput').value.trim();
    const errorMsg = document.getElementById('errorMsg');
    if (!username) return;
    errorMsg.textContent = 'Fetching…';

    try {
        const [userRes, matchRes] = await Promise.all([
            fetch(`https://api.mcsrranked.com/users/${username}`),
            fetch(`https://api.mcsrranked.com/users/${username}/matches?count=100`),
        ]);

        const userData  = await userRes.json();
        const matchData = await matchRes.json();

        if (userData.status !== 'success') throw new Error('Player not found.');

        const p    = userData.data;
        playerUuid = p.uuid;
        allMatches = matchData.status === 'success' ? (matchData.data || []) : [];
        matchDetails = {}; // clear cache on new search

        document.getElementById('playerName').textContent = p.nickname;
        document.getElementById('skinImg').src            = `https://mc-heads.net/body/${p.nickname}`;
        document.getElementById('sc-elo').textContent     = p.eloRate ?? 'N/A';
        document.getElementById('sc-rank').textContent    = p.eloRank ? `#${p.eloRank}` : 'Unranked';

        const wins   = p.statistics?.total?.wins?.ranked  ?? 0;
        const losses = p.statistics?.total?.loses?.ranked ?? 0;
        const total  = wins + losses;
        document.getElementById('sc-wr').textContent   = total > 0 ? ((wins / total) * 100).toFixed(1) + '%' : '0%';
        document.getElementById('sc-best').textContent = msToTime(p.statistics?.total?.bestTime?.ranked);

        errorMsg.textContent = '';
        document.getElementById('searchArea').classList.add('hidden');
        document.getElementById('statsArea').classList.remove('hidden');

        setTab('elo');

    } catch (e) {
        errorMsg.textContent = e.message;
    }
}

/* ── Tab switching ── */
function setTab(name) {
    currentTab = name;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.getElementById('tab-elo').classList.toggle('hidden',     name !== 'elo');
    document.getElementById('tab-splits').classList.toggle('hidden',  name !== 'splits');
    document.getElementById('tab-matches').classList.toggle('hidden', name !== 'matches');
    renderCurrentTab();
}

/* ── Event Listeners ── */
document.getElementById('searchBtn').addEventListener('click', fetchStats);
document.getElementById('usernameInput').addEventListener('keydown', e => { if (e.key === 'Enter') fetchStats(); });

document.getElementById('backBtn').addEventListener('click', () => {
    document.getElementById('statsArea').classList.add('hidden');
    document.getElementById('searchArea').classList.remove('hidden');
    document.getElementById('errorMsg').textContent = '';
});

document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
});

document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        currentMode = btn.dataset.mode;
        renderCurrentTab();
    });
});

document.querySelectorAll('[data-count]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-count]').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        currentCount = parseInt(btn.dataset.count);
        renderCurrentTab();
    });
});