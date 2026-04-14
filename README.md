# MCSR Ranked Stats Tracker

A single-page stats dashboard for [MCSR Ranked](https://mcsrranked.com) — the competitive Minecraft speedrunning ladder. Search any player to see their elo history, split times, match log, and win/loss breakdown.

---

## Data source

All data comes from the public **MCSR Ranked API** (`api.mcsrranked.com`). No API key is required. Two endpoints are used:

| Endpoint | What it returns |
|---|---|
| `/users/{username}` | Player profile: elo, rank, lifetime win/loss counts, best time |
| `/users/{username}/matches?count=100` | Up to 100 recent matches with outcomes and elo changes |
| `/matches/{id}` | Full match detail including per-player split timelines (fetched on demand for the Splits tab) |

---

## Statistics explained

### Header cards

| Stat | Calculation |
|---|---|
| **Elo** | Current rated elo pulled directly from the player profile (`eloRate`) |
| **Rank** | Global leaderboard position (`eloRank`) |
| **Win rate** | `wins / (wins + losses)` from lifetime ranked totals in the profile |
| **Best time** | Fastest ranked finish time from the player profile (`bestTime.ranked`) |
| **Forfeit rate** | Among the 100 fetched ranked matches: matches where the opponent forfeited / total ranked matches |
| **Draw rate** | Among the 100 fetched ranked matches: matches with no recorded result / total ranked matches |

### Outcome charts (donut)

Built from the 100 fetched ranked matches.

- **Results** — counts of wins (player uuid matches `result.uuid`), losses (opponent uuid matches), and draws (no result uuid). Center shows win rate as a percentage.
- **Win types** — normal wins vs. forfeit wins (`forfeited === true` and player is the winner).
- **Loss types** — normal losses vs. forfeit losses (`forfeited === true` and opponent is the winner).

### Elo history (line chart)

Each match in the fetched set that contains an `eloRate` entry for the player is plotted in chronological order. The y-axis is the elo value after that match. Filterable by mode (Ranked / Casual / Private) and match count (50 / 100).

Private matches carry no elo data and will show an empty state.

### Average splits

Fetched on demand — individual match detail is requested for each match in the current filter set (batched 10 at a time). Splits are derived from the `timelines` array, which logs the timestamp of each in-game milestone for each player.

The seven tracked segments and their timeline event boundaries:

| Segment | Start event | End event |
|---|---|---|
| Overworld | match start (0) | `story.enter_the_nether` |
| Nether | `story.enter_the_nether` | `nether.find_bastion` |
| Bastion | `nether.find_bastion` | `nether.find_fortress` |
| Fortress | `nether.find_fortress` | `projectelo.timeline.blind_travel` |
| Blind | `projectelo.timeline.blind_travel` | `story.follow_ender_eye` |
| Stronghold | `story.follow_ender_eye` | `story.enter_the_end` |
| End | `story.enter_the_end` | match result time |

Each segment time is `end_timestamp - start_timestamp` in milliseconds. Averages are computed only over runs where both boundary events are present.

#### Split performance score

Each split average is scored 0–100 against hardcoded community benchmarks (elite ≈ top 1%, floor = generous lower bound):

```
score = (floor - avgMs) / (floor - elite) * 100   (clamped to [0, 100])
```

The radar chart plots these scores per split. The average score across all splits maps to a tier label (Top 5%, Top 10%, Top 25%, Top 50%, Bottom 50%).

### Match log

Lists matches in the current filter set showing opponent, outcome, elo delta, and date. Match detail is fetched individually when a row is expanded.

---

## Tech stack

| Layer | Tool |
|---|---|
| Markup | Vanilla HTML |
| Styling | Custom CSS + [Tailwind CSS](https://tailwindcss.com) (CDN, utility classes only) |
| Charts | [Chart.js v4](https://www.chartjs.org) (CDN) |
| Logic | Vanilla JavaScript (no build step, no framework) |
| Data | MCSR Ranked public REST API |
| Persistence | `localStorage` — saves theme preference and last searched username |
