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
                borderColor:          c.accent,
                backgroundColor:      c.fill,
                fill:                 true,
                tension:              0.35,
                pointRadius:          4,
                pointHoverRadius:     6,
                pointBackgroundColor: c.accent,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: c.grid }, ticks: { color: c.tick, font: { size: 12 } } },
                x: { grid: { color: c.grid }, ticks: { color: c.tick, font: { size: 12 } } },
            },
            plugins: {
                legend:  { display: false },
                tooltip: { callbacks: { label: ctx => ` Elo: ${ctx.parsed.y}` } },
            },
        },
    });
}
