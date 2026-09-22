# Defense first pass

The DEF tab is a team defense / special-teams comparison, separate from the offensive player stacks. It shows five layers: fantasy points, impact plays, opponent points, opponent net offensive yards, and opponent offensive plays. The 2026 week buttons are discrete named weeks derived from the data snapshot; the current-season button states the latest completed week included, and the prior-season button identifies the full 2025 regular season.

## Data and scoring

Run `npm run data:refresh` to rebuild the offensive data and then join the published team-game snapshot to nflverse weekly team statistics and schedules. The defense join produces `public/data/v1/defense-games.json` and updates its manifest checksum. Each defense record has a matching team-game record. Opponent plays come from the opposing team's offensive-play field in that existing snapshot. Opponent net yards equal passing yards plus rushing yards plus signed sack yards lost from the opposing offense's nflverse team stats. Opponent points are the final opposing scoreboard total from the schedule, including any points the opposing defense or special teams scored.

Fantasy points are a transparent comparison baseline, not a league-platform score. For each game, award one point per sack; two per interception, opponent fumble recovery, or safety; and six per defensive or special-teams touchdown. Add the points-allowed bracket based on the opponent's final scoreboard total: 10 for 0, 7 for 1–6, 4 for 7–13, 1 for 14–20, 0 for 21–27, −1 for 28–34, and −4 for 35+. Sum game scores for a season. The scoreboard definition can differ from a platform's DST points-allowed attribution, so the displayed fantasy total should not be treated as an official ESPN, Yahoo, or Sleeper result.

Impact plays are a simple count of sacks, interceptions, opponent fumble recoveries, defensive touchdowns, and special-teams touchdowns. Safeties affect fantasy points but are not in that count. The opponent-points and opponent-yards layers use points per game and yards per play for rank/shape, with lower values better. The opponent-plays layer is exposure only, not a quality score. Total/per-game changes displayed cumulative values and volume-based ranks; rate-based suppression ranks stay the same. Widths visualize rank among the currently qualified defenses.

Validate locally with `node scripts/validate-contract.mjs`, `python scripts/check_data.py`, `npm run lint`, `npm run typecheck`, and `npm run build`.
