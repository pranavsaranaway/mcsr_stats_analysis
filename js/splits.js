/* ── Splits ── */

function splitScore(avgMs, label) {
    const b = SPLIT_BENCHMARKS[label];
    if (!b || avgMs <= 0) return null;
    const [elite, , , , , floor] = b;
    return Math.max(0, Math.min(100, (floor - avgMs) / (floor - elite) * 100));
}

function scoreTier(score) {
    if (score >= 80) return 'Top 5%';
    if (score >= 65) return 'Top 10%';
    if (score >= 45) return 'Top 25%';
    if (score >= 28) return 'Top 50%';
    return 'Bottom 50%';
}

async function renderSplits() {
    if (splitsRadarChart) { splitsRadarChart.destroy(); splitsRadarChart = null; }

    const body    = document.getElementById('splitsBody');
    const matches = getFilteredMatches();

    if (matches.length === 0) {
        body.innerHTML = '<p class="splits-empty">No matches for this filter.</p>';
        return;
    }

    body.innerHTML = '<p class="splits-empty">Loading split data…</p>';

    // Fetch uncached match details in batches of 10
    const uncached = matches.filter(m => !matchDetails[m.id]);
    for (let i = 0; i < uncached.length; i += 10) {
        const batch = uncached.slice(i, i + 10);
        await Promise.all(batch.map(async m => {
            try {
                const res  = await fetch(`https://api.mcsrranked.com/matches/${m.id}`);
                const data = await res.json();
                if (data.status === 'success') matchDetails[m.id] = data.data;
            } catch (e) { /* skip failed */ }
        }));
    }

    // Aggregate segment deltas
    const sums   = {};
    const counts = {};
    SPLITS.forEach(s => { sums[s.label] = 0; counts[s.label] = 0; });

    matches.forEach(m => {
        const detail = matchDetails[m.id];
        if (!detail || !Array.isArray(detail.timelines)) return;

        const evtMap = {};
        detail.timelines
            .filter(e => e.uuid === playerUuid)
            .forEach(e => { evtMap[e.type] = e.time; });

        SPLITS.forEach(s => {
            let delta;
            if (s.useResultTime) {
                const startTime  = evtMap[s.segStart];
                const finishTime = m.result?.time;
                if (!startTime || !finishTime) return;
                delta = finishTime - startTime;
            } else {
                const endTime   = evtMap[s.segEnd];
                if (!endTime) return;
                const startTime = s.segStart ? evtMap[s.segStart] : 0;
                if (s.segStart && !startTime) return;
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

    if (!avgs.some(a => a.n > 0)) {
        body.innerHTML = '<p class="splits-empty">No timeline data available for these matches.<br>The MCSR API only stores splits for some match types.</p>';
        return;
    }

    const completions = matches.filter(m => {
        const detail = matchDetails[m.id];
        return detail?.timelines?.some(e => e.uuid === playerUuid && e.type === 'story.enter_the_end');
    }).length;

    body.innerHTML = `
    <p class="splits-meta">${matches.length} games analysed &nbsp;·&nbsp; ${completions} completions</p>
    <div class="splits-grid">
        ${avgs.map(a => `
        <div class="split-card">
            <div class="split-icon">${a.icon}</div>
            <div class="split-card-label">${a.label}</div>
            <div class="split-card-time">${a.avg > 0 ? msToTime(a.avg) : '—'}</div>
            <div class="split-card-count">${a.n > 0 ? `${a.n} runs` : 'no data'}</div>
        </div>`).join('')}
    </div>
    <div class="splits-radar-wrap">
        <div class="splits-radar-header">
            <span class="splits-radar-title">Split performance</span>
            <span class="splits-radar-tier" id="splitsTier"></span>
        </div>
        <div class="splits-radar-chart">
            <canvas id="splitsRadar"></canvas>
        </div>
        <p class="splits-radar-note">Scores vs. approximate community benchmarks — higher is faster</p>
    </div>`;

    renderSplitsRadar(avgs);
}

function renderSplitsRadar(avgs) {
    const canvas = document.getElementById('splitsRadar');
    if (!canvas) return;

    // Only plot splits with data — null values render as 0 in Chart.js radar
    const withData = avgs.filter(a => a.n > 0);
    if (withData.length < 3) return;

    const scores   = withData.map(a => splitScore(a.avg, a.label));
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const tierEl = document.getElementById('splitsTier');
    if (tierEl) tierEl.textContent = `~${scoreTier(avgScore)} overall`;

    const c       = getThemeColors();
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const gridColor  = isLight ? 'rgba(0,0,0,0.08)'  : 'rgba(255,255,255,0.07)';
    const labelColor = isLight ? '#55555f'            : '#9a9aa8';
    const n = withData.length;

    splitsRadarChart = new Chart(canvas.getContext('2d'), {
        type: 'radar',
        data: {
            labels: withData.map(a => a.label),
            datasets: [
                {
                    label:                'You',
                    data:                 scores,
                    borderColor:          c.accent,
                    backgroundColor:      c.fill,
                    pointBackgroundColor: c.accent,
                    pointRadius:          4,
                    pointHoverRadius:     6,
                    borderWidth:          2,
                },
                {
                    label:            'Top 10%',
                    data:             new Array(n).fill(65),
                    borderColor:      'rgba(250,200,50,0.65)',
                    backgroundColor:  'transparent',
                    borderDash:       [5, 4],
                    borderWidth:      1.5,
                    pointRadius:      0,
                    pointHoverRadius: 0,
                },
                {
                    label:            'Top 25%',
                    data:             new Array(n).fill(45),
                    borderColor:      'rgba(110,150,255,0.5)',
                    backgroundColor:  'transparent',
                    borderDash:       [5, 4],
                    borderWidth:      1.5,
                    pointRadius:      0,
                    pointHoverRadius: 0,
                },
            ],
        },
        options: {
            responsive:          true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    min:  0,
                    max:  100,
                    ticks:       { display: false, stepSize: 25 },
                    grid:        { color: gridColor },
                    angleLines:  { color: gridColor },
                    pointLabels: { color: labelColor, font: { size: 12, weight: '600' } },
                },
            },
            plugins: {
                legend: {
                    display:  true,
                    position: 'bottom',
                    labels: {
                        color:           labelColor,
                        boxWidth:        12,
                        padding:         20,
                        font:            { size: 12 },
                        usePointStyle:   true,
                        pointStyleWidth: 10,
                    },
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            if (ctx.dataset.label === 'You') {
                                const s = scores[ctx.dataIndex];
                                return s != null
                                    ? ` ${s.toFixed(0)}/100 — ${scoreTier(s)}`
                                    : ' No data';
                            }
                            return ` ${ctx.dataset.label} benchmark`;
                        },
                    },
                },
            },
        },
    });
}
