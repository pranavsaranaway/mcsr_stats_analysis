/* ── Utility helpers ── */

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
