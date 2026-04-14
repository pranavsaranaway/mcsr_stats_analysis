/* ── Theme ── */

function getThemeColors() {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return {
        grid:   light ? '#e8e8ee'           : '#1e1e21',
        tick:   light ? '#aaaabc'           : '#55555f',
        accent: light ? '#16a34a'           : '#3fb950',
        fill:   light ? 'rgba(22,163,74,.1)': 'rgba(63,185,80,.12)',
    };
}

document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('mcsr-theme', next);

    renderOutcomeCharts();
    if (currentTab === 'elo' && eloChart)                 renderEloChart();
    else if (currentTab === 'splits' && splitsRadarChart) renderSplits();
});
