/* ── Shared state ── */
let eloChart         = null;
let splitsRadarChart = null;
let allMatches       = [];   // summary matches from /matches
let matchDetails     = {};   // cache: id -> full match detail with timelines
let currentMode      = 'ranked';
let currentCount     = 50;
let currentTab       = 'elo';
let playerUuid       = '';

/* ── Split definitions ── */
const CHECKPOINTS = [
    { key: 'story.enter_the_nether',           label: 'Overworld'  },
    { key: 'nether.find_bastion',              label: 'Nether'     },
    { key: 'nether.find_fortress',             label: 'Bastion'    },
    { key: 'projectelo.timeline.blind_travel', label: 'Fortress'   },
    { key: 'story.follow_ender_eye',           label: 'Blind'      },
    { key: 'story.enter_the_end',              label: 'Stronghold' },
    { key: 'story.enter_the_end',              label: 'End'        },
];

const SPLITS = [
    { label: 'Overworld',  icon: '<img src="images/overworld_icon.png"   class="split-img-icon" alt="Overworld">',  segStart: null,                               segEnd: 'story.enter_the_nether'           },
    { label: 'Nether',     icon: '<img src="images/nether_icon.png"      class="split-img-icon" alt="Nether">',     segStart: 'story.enter_the_nether',           segEnd: 'nether.find_bastion'              },
    { label: 'Bastion',    icon: '<img src="images/bastion_icon.png"     class="split-img-icon" alt="Bastion">',    segStart: 'nether.find_bastion',              segEnd: 'nether.find_fortress'             },
    { label: 'Fortress',   icon: '<img src="images/fortress_icon.png"    class="split-img-icon" alt="Fortress">',   segStart: 'nether.find_fortress',             segEnd: 'projectelo.timeline.blind_travel' },
    { label: 'Blind',      icon: '<img src="images/blind_icon.webp"      class="split-img-icon" alt="Blind">',      segStart: 'projectelo.timeline.blind_travel', segEnd: 'story.follow_ender_eye'           },
    { label: 'Stronghold', icon: '<img src="images/stronnghold_icon.png" class="split-img-icon" alt="Stronghold">', segStart: 'story.follow_ender_eye',           segEnd: 'story.enter_the_end'              },
    { label: 'End',        icon: '<img src="images/end_icon.png"         class="split-img-icon" alt="End">',        segStart: 'story.enter_the_end',              segEnd: null, useResultTime: true           },
];

// Benchmark times per split in ms: [elite≈top1%, top5%, top10%, top25%, median, floor]
// Floor is generous so typical players don't score 0.
const SPLIT_BENCHMARKS = {
    'Overworld':  [ 85000, 110000, 135000, 175000, 215000, 360000],
    'Nether':     [ 50000,  65000,  80000, 105000, 135000, 240000],
    'Bastion':    [ 75000, 100000, 125000, 165000, 205000, 360000],
    'Fortress':   [ 60000,  80000, 100000, 135000, 170000, 300000],
    'Blind':      [ 25000,  38000,  52000,  72000,  95000, 180000],
    'Stronghold': [ 30000,  45000,  60000,  82000, 108000, 200000],
    'End':        [ 22000,  32000,  44000,  60000,  80000, 150000],
};
