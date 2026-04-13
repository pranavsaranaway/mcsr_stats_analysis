/* ── Outcome Charts ── */

let outcomeCharts = [];

const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
        const opts = chart.options.plugins.centerText;
        if (!opts) return;
        const { ctx, chartArea: { left, top, width, height } } = chart;
        const cx  = left + width  / 2;
        const cy  = top  + height / 2;
        const f   = `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;
        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = `bold 18px ${f}`;
        ctx.fillStyle    = opts.color;
        ctx.fillText(opts.text, cx, cy - 8);
        ctx.font      = `11px ${f}`;
        ctx.fillStyle = opts.subColor;
        ctx.fillText(opts.sub, cx, cy + 9);
        ctx.restore();
    }
};

function makeLegendHTML(items) {
    return items.map(({ color, label, count }) => `
        <div class="outcome-legend-item">
            <span class="outcome-dot" style="background:${color}"></span>
            <span>${label} <strong>${count}</strong></span>
        </div>`).join('');
}

function makeDonut(canvasId, legendId, segments, center) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    document.getElementById(legendId).innerHTML = makeLegendHTML(segments);

    const isLight   = document.documentElement.getAttribute('data-theme') === 'light';
    const textColor = isLight ? '#111114' : '#e8e8e8';
    const subColor  = isLight ? '#55555f' : '#9a9aa8';

    return new Chart(canvas.getContext('2d'), {
        type:    'doughnut',
        plugins: [centerTextPlugin],
        data: {
            datasets: [{
                data:            segments.map(s => s.count || 0.001),
                backgroundColor: segments.map(s => s.color),
                borderWidth:     0,
                hoverOffset:     4,
            }]
        },
        options: {
            cutout:              '70%',
            responsive:          true,
            maintainAspectRatio: false,
            animation:           { animateRotate: true, duration: 700, easing: 'easeInOutQuart' },
            plugins: {
                legend:     { display: false },
                tooltip:    { enabled: false },
                centerText: {
                    text:     center.text,
                    sub:      center.sub,
                    color:    center.color ?? textColor,
                    subColor,
                },
            },
            events: [],
        }
    });
}

function renderOutcomeCharts() {
    outcomeCharts.forEach(c => c?.destroy());
    outcomeCharts = [];

    const ranked = allMatches.filter(m => m.type === 2);
    if (ranked.length === 0) return;

    const total    = ranked.length;
    const wins     = ranked.filter(m => m.result?.uuid === playerUuid).length;
    const losses   = ranked.filter(m => m.result?.uuid && m.result.uuid !== playerUuid).length;
    const draws    = total - wins - losses;
    const ffWins   = ranked.filter(m => m.forfeited && m.result?.uuid === playerUuid).length;
    const ffLosses = ranked.filter(m => m.forfeited && m.result?.uuid && m.result.uuid !== playerUuid).length;

    const isLight   = document.documentElement.getAttribute('data-theme') === 'light';
    const textColor = isLight ? '#111114' : '#e8e8e8';

    // Chart 1 — W / L / D
    outcomeCharts.push(makeDonut('chartWLD', 'legendWLD', [
        { color: '#3fb950', label: 'W', count: wins   },
        { color: '#ff6060', label: 'L', count: losses },
        { color: '#9a9aa8', label: 'D', count: draws  },
    ], {
        text:  total > 0 ? `${Math.round(wins / total * 100)}%` : '—',
        sub:   'win rate',
        color: textColor,
    }));

    // Chart 2 — Win types
    outcomeCharts.push(makeDonut('chartWins', 'legendWins', [
        { color: '#3fb950', label: 'W',  count: wins - ffWins },
        { color: '#d29922', label: 'FF', count: ffWins        },
    ], {
        text:  `${wins}`,
        sub:   'total wins',
        color: textColor,
    }));

    // Chart 3 — Loss types
    outcomeCharts.push(makeDonut('chartLosses', 'legendLosses', [
        { color: '#ff6060', label: 'L',  count: losses - ffLosses },
        { color: '#d29922', label: 'FF', count: ffLosses          },
    ], {
        text:  `${losses}`,
        sub:   'total losses',
        color: textColor,
    }));
}
