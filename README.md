# FantasyStacks

FantasyStacks is an experimental fantasy-football visualization for comparing WR and TE opportunity-to-production profiles.

Each player stack has seven layers:

1. Team offensive possessions
2. Team offensive plays
3. Player offensive snaps
4. Targets
5. Receptions
6. Receiving yards
7. Receiving touchdowns

Layer width is the player’s percentile for raw volume among the currently qualified cohort. Layer height is the percentile of the transition rate into that layer. Geometry is calculated after filtering; it is never stored in the source dataset.

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
