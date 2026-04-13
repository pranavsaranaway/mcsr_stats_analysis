/* ── Match Log ── */

function renderMatches() {
    const list    = document.getElementById('matchList');
    const matches = getFilteredMatches();

    if (matches.length === 0) {
        list.innerHTML = '<p class="splits-empty">No matches for this filter.</p>';
        return;
    }

    list.innerHTML = matches.map(m => {
        const myChange   = m.changes?.find(c => c.uuid === playerUuid) ?? null;
        const oppName    = (m.players || []).find(x => x.uuid !== playerUuid)?.nickname ?? '?';
        const winnerUuid = m.result?.uuid ?? null;
        const isDraw     = !winnerUuid;
        const won        = winnerUuid === playerUuid;

        const badgeCls = isDraw ? 'draw' : won ? 'win' : 'loss';
        const badgeTxt = isDraw ? 'D'    : won ? 'W'   : 'L';

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
