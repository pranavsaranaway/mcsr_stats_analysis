/* ── Render dispatch ── */

function renderCurrentTab() {
    if (currentTab === 'elo')          renderEloChart();
    else if (currentTab === 'splits')  renderSplits();
    else if (currentTab === 'matches') renderMatches();
}

/* ── Tab switching ── */
function setTab(name) {
    currentTab = name;
    document.querySelectorAll('.tab').forEach(t =>
        t.classList.toggle('active', t.dataset.tab === name)
    );
    document.getElementById('tab-elo').classList.toggle('hidden',     name !== 'elo');
    document.getElementById('tab-splits').classList.toggle('hidden',  name !== 'splits');
    document.getElementById('tab-matches').classList.toggle('hidden', name !== 'matches');
    renderCurrentTab();
}

/* ── Fetch & render player ── */
function setSearchLoading(on) {
    const btn     = document.getElementById('searchBtn');
    const btnText = document.getElementById('searchBtnText');
    const spinner = document.getElementById('searchBtnSpinner');
    btn.disabled = on;
    btnText.classList.toggle('hidden', on);
    spinner.classList.toggle('hidden', !on);
    spinner.classList.toggle('flex', on);
}

async function fetchStats() {
    const username = document.getElementById('usernameInput').value.trim();
    const errorMsg = document.getElementById('errorMsg');
    if (!username) return;

    setSearchLoading(true);
    errorMsg.textContent = '';

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
        matchDetails = {};

        document.getElementById('playerName').textContent = p.nickname;
        document.getElementById('skinImg').src            = `https://mc-heads.net/body/${p.nickname}`;
        document.getElementById('sc-elo').textContent     = p.eloRate ?? 'N/A';
        document.getElementById('sc-rank').textContent    = p.eloRank ? `#${p.eloRank}` : 'Unranked';

        const wins   = p.statistics?.total?.wins?.ranked  ?? 0;
        const losses = p.statistics?.total?.loses?.ranked ?? 0;
        const total  = wins + losses;
        document.getElementById('sc-wr').textContent   = total > 0
            ? ((wins / total) * 100).toFixed(1) + '%'
            : '0%';
        document.getElementById('sc-best').textContent = msToTime(p.statistics?.total?.bestTime?.ranked);

        const rankedMatches = allMatches.filter(m => m.type === 2);
        const rankedTotal   = rankedMatches.length;

        const forfeitCount = rankedMatches.filter(m =>
            m.forfeited === true && m.result?.uuid !== playerUuid
        ).length;
        document.getElementById('sc-ff').textContent = rankedTotal > 0
            ? (forfeitCount / rankedTotal * 100).toFixed(1) + '%'
            : '—';

        const drawCount = rankedMatches.filter(m => !m.result?.uuid).length;
        document.getElementById('sc-draw').textContent = rankedTotal > 0
            ? (drawCount / rankedTotal * 100).toFixed(1) + '%'
            : '—';

        renderOutcomeCharts();
        localStorage.setItem('mcsr-last-user', username);

        setSearchLoading(false);
        document.getElementById('searchArea').classList.add('hidden');
        document.getElementById('statsArea').classList.remove('hidden');

        setTab('elo');

    } catch (e) {
        setSearchLoading(false);
        errorMsg.textContent = e.message;
    }
}

/* ── Event listeners ── */
document.getElementById('searchBtn').addEventListener('click', fetchStats);

document.getElementById('usernameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') fetchStats();
});

document.getElementById('backBtn').addEventListener('click', () => {
    document.getElementById('statsArea').classList.add('hidden');
    document.getElementById('searchArea').classList.remove('hidden');
    document.getElementById('errorMsg').textContent = '';
    localStorage.removeItem('mcsr-last-user');
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

/* ── Restore last session ── */
(function () {
    const last = localStorage.getItem('mcsr-last-user');
    if (last) {
        document.getElementById('usernameInput').value = last;
        fetchStats();
    }
})();
