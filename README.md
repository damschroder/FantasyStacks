# FantasyStacks

FantasyStacks is an experimental fantasy-football visualization for comparing WR, TE, RB, and QB opportunity-to-production profiles.

Receiver stacks have seven layers:

1. Team offensive plays
2. Player offensive snaps
3. Targets
4. Receptions
5. Receiving yards
6. Receiving touchdowns
7. Fantasy points

Running-back stacks use the same team-plays base, then show player snaps, touches plus targets, catches, scrimmage yards, total touchdowns, and fantasy points. Rushing volume uses the team color; target and receiving volume use the contrasting highlight color.

The FLEX view combines RB, WR, and TE stacks in one qualified field while preserving each position's stack grammar.

Quarterback stacks use the same team-plays base, then show player snaps, pass attempts, sacks plus interceptions, completions, passing yards, passing touchdowns, and fantasy points. The loss-event layer splits sacks from interceptions by color; its height represents the percentage of dropbacks that avoided either outcome.

The Geometry control switches between the original Trapezoid silhouette and rectangular Blocks. Trapezoid width is the player’s percentile for raw volume among the currently qualified cohort. Block widths span exactly one-third to full width: the Team Plays base ranks against all teams in the selected window, and each player layer ranks against the currently qualified player universe. For the quarterback loss layer, fewer sacks plus interceptions ranks better. Layer height remains the percentile of the transition rate into that layer. Geometry is calculated after filtering; it is never stored in the source dataset.

The two-sided FP ECR control filters the cohort by the current FantasyPros redraft-overall expert consensus ranking distributed through nflverse/DynastyProcess. Its NR endpoint preserves players without a current ranking. Stack geometry recalculates within the selected ECR range.

Time windows cover the latest week, trailing three and five games, the 2025 season, and the 2024 season. The independent Total / Per game setting controls displayed layer volume, width percentiles, fantasy points, volume sorting, and stack score without changing transition-rate heights.

The PPR control switches between Full, Half, and Off. The app retains full-PPR source facts and derives the other modes by applying 0.5 or 0 reception points, so the Fantasy Points layer, points-per-opportunity transition, sorting, widths, and stack score all update without rewriting the underlying records.

## Run locally

```powershell
npm install
npm run dev
```

## Deploy with GitHub Pages

Push the `main` branch to a GitHub repository named `FantasyStacks`, then enable **Settings → Pages → Source: GitHub Actions**. The included workflow validates the data contract, creates a static export, and publishes it at:

`https://damschroder.github.io/FantasyStacks/`

Local development remains at `http://localhost:3000`; the `/FantasyStacks` base path is applied only inside the Pages build.

## Refresh the data

```powershell
npm run data:refresh
```

The refresh script downloads the 2025 nflverse player-stat, snap-count, play-by-play, and player-identity Parquet feeds. It emits compact canonical JSON under `public/data/v1`.

## Data contract

JSON Schema 2020-12 files live in `schema/`. Both the Python producer and the JavaScript build validate every payload. Important rules:

- `null` means unknown or unavailable; `0` means a verified zero.
- Raw facts are transported; rates, percentiles, and visualization geometry are derived.
- The contract is versioned independently of any provider.
- The manifest records source URLs, definitions, record counts, and SHA-256 checksums.

The normalized provider boundary makes it possible to replace nflverse with a licensed REST API without changing the visualization.

## Source and license

Data is provided by [nflverse](https://nflverse.nflverse.com/) under CC BY 4.0. Underlying NFL data remains subject to its owners’ terms.
