"""Build the canonical FantasyStacks v1 JSON dataset from nflverse feeds."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq
import requests
from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "public" / "data" / "v1"
SCHEMA_DIR = ROOT / "schema"
SEASON = 2025
SCHEMA_VERSION = "1.3.0"

URLS = {
    "stats": f"https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_{SEASON}.parquet",
    "snaps": f"https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_{SEASON}.parquet",
    "pbp": f"https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{SEASON}.parquet",
    "players": "https://github.com/nflverse/nflverse-data/releases/download/players/players.parquet",
}
CSV_URLS = {
    "ecr": "https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_fpecr_latest.csv",
    "playerids": "https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv",
}


def download(name: str, url: str, suffix: str = ".parquet") -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    destination = RAW_DIR / f"{name}{suffix}"
    temporary = destination.with_suffix(".part")
    with requests.get(
        url,
        stream=True,
        timeout=120,
        headers={"User-Agent": "FantasyStacks/0.1 (personal analytics project)"},
    ) as response:
        response.raise_for_status()
        with temporary.open("wb") as output:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    output.write(chunk)
    temporary.replace(destination)
    return destination


def as_int(value: object) -> int | None:
    if pd.isna(value):
        return None
    return int(round(float(value)))


def as_text(value: object) -> str | None:
    if pd.isna(value) or value is None or str(value).strip() == "":
        return None
    return str(value)


def write_json(filename: str, payload: dict, pretty: bool = False) -> dict:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / filename
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        indent=2 if pretty else None,
        separators=None if pretty else (",", ":"),
    ).encode("utf-8")
    path.write_bytes(encoded)
    return {
        "path": f"/data/v1/{filename}",
        "records": len(payload.get("data", [])),
        "sha256": hashlib.sha256(encoded).hexdigest(),
    }


def validate(schema_name: str, payload: dict) -> None:
    schema = json.loads((SCHEMA_DIR / schema_name).read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(payload), key=lambda error: list(error.path))
    if errors:
        details = "\n".join(f"{list(error.path)}: {error.message}" for error in errors[:20])
        raise ValueError(f"{schema_name} validation failed:\n{details}")


def main() -> None:
    paths = {name: download(name, url) for name, url in URLS.items()}
    csv_paths = {name: download(name, url, ".csv") for name, url in CSV_URLS.items()}

    stats = pd.read_parquet(paths["stats"])
    snaps = pd.read_parquet(paths["snaps"])
    people = pd.read_parquet(paths["players"])
    rankings = pd.read_csv(csv_paths["ecr"])
    fantasy_ids = pd.read_csv(csv_paths["playerids"], low_memory=False)
    pbp = pq.read_table(
        paths["pbp"],
        columns=["game_id", "season", "season_type", "week", "game_date", "posteam", "drive"],
    ).to_pandas()

    stats = stats[
        (stats["season"] == SEASON)
        & (stats["season_type"] == "REG")
        & (stats["position"].isin(["WR", "TE", "RB", "QB"]))
    ].copy()
    snaps = snaps[(snaps["season"] == SEASON) & (snaps["game_type"] == "REG")].copy()
    pbp = pbp[(pbp["season"] == SEASON) & (pbp["season_type"] == "REG")].copy()

    rankings = rankings[
        (rankings["page_type"] == "redraft-overall")
        & (rankings["pos"].isin(["WR", "TE", "RB", "QB"]))
    ].copy()
    rankings["id"] = pd.to_numeric(rankings["id"], errors="coerce")
    fantasy_ids["fantasypros_id"] = pd.to_numeric(fantasy_ids["fantasypros_id"], errors="coerce")
    rankings = rankings.merge(
        fantasy_ids[["fantasypros_id", "gsis_id"]].drop_duplicates("fantasypros_id"),
        left_on="id",
        right_on="fantasypros_id",
        how="left",
    ).dropna(subset=["gsis_id", "ecr"])
    rankings = rankings.sort_values("scrape_date").drop_duplicates("gsis_id", keep="last")
    ecr_by_gsis = rankings.set_index("gsis_id")["ecr"].to_dict()
    ecr_date_by_gsis = rankings.set_index("gsis_id")["scrape_date"].astype(str).to_dict()

    id_map = people[["gsis_id", "pfr_id"]].dropna(subset=["gsis_id"]).drop_duplicates("pfr_id")
    snaps = snaps.merge(id_map, left_on="pfr_player_id", right_on="pfr_id", how="left")
    snap_join = snaps[["game_id", "gsis_id", "offense_snaps"]].dropna(subset=["gsis_id"])
    snap_join = snap_join.rename(columns={"gsis_id": "player_id"}).drop_duplicates(["game_id", "player_id"])
    stats = stats.merge(snap_join, on=["game_id", "player_id"], how="left")
    stats = stats[
        (stats["offense_snaps"].fillna(0) > 0)
        | (stats["targets"].fillna(0) > 0)
        | (stats["carries"].fillna(0) > 0)
        | (stats["attempts"].fillna(0) > 0)
    ].copy()

    # Team offensive play totals are reconstructed from the published snap total
    # and snap percentage for every offensive player. Median suppresses rounding noise.
    usable_snaps = snaps[(snaps["offense_pct"] > 0) & (snaps["offense_pct"] <= 1.05)].copy()
    usable_snaps["team_plays_estimate"] = usable_snaps["offense_snaps"] / usable_snaps["offense_pct"]
    team_plays = (
        usable_snaps.groupby(["game_id", "team"], as_index=False)["team_plays_estimate"]
        .median()
        .rename(columns={"team_plays_estimate": "offensive_plays"})
    )
    team_plays["offensive_plays"] = team_plays["offensive_plays"].round().astype("Int64")

    drives = pbp.dropna(subset=["posteam", "drive"])[["game_id", "posteam", "drive"]].drop_duplicates()
    possessions = (
        drives.groupby(["game_id", "posteam"], as_index=False)
        .size()
        .rename(columns={"posteam": "team", "size": "offensive_possessions"})
    )
    game_context = (
        pbp.dropna(subset=["posteam"])
        .groupby(["game_id", "posteam"], as_index=False)
        .agg(season=("season", "first"), week=("week", "first"), game_date=("game_date", "first"))
        .rename(columns={"posteam": "team"})
    )
    team_games = game_context.merge(possessions, on=["game_id", "team"], how="left")
    team_games = team_games.merge(team_plays, on=["game_id", "team"], how="left")

    def opponent_for(game_id: str, team: str) -> str:
        parts = game_id.split("_")
        away, home = parts[-2], parts[-1]
        return home if team == away else away

    team_game_records = []
    for row in team_games.sort_values(["week", "game_id", "team"]).itertuples(index=False):
        team_game_records.append(
            {
                "gameId": str(row.game_id),
                "team": str(row.team),
                "opponent": opponent_for(str(row.game_id), str(row.team)),
                "season": int(row.season),
                "week": int(row.week),
                "gameDate": str(row.game_date)[:10],
                "offensivePossessions": as_int(row.offensive_possessions),
                "offensivePlays": as_int(row.offensive_plays),
            }
        )

    player_game_records = []
    for row in stats.sort_values(["week", "game_id", "player_display_name"]).itertuples(index=False):
        player_game_records.append(
            {
                "gameId": str(row.game_id),
                "playerId": str(row.player_id),
                "team": str(row.team),
                "opponent": str(row.opponent_team),
                "season": int(row.season),
                "week": int(row.week),
                "position": str(row.position),
                "played": bool(
                    (0 if pd.isna(row.offense_snaps) else row.offense_snaps) > 0
                    or row.targets > 0
                    or row.carries > 0
                    or row.attempts > 0
                ),
                "offensiveSnaps": as_int(row.offense_snaps),
                "passingAttempts": int(row.attempts),
                "completions": int(row.completions),
                "passingYards": int(row.passing_yards),
                "passingTouchdowns": int(row.passing_tds),
                "interceptions": int(row.passing_interceptions),
                "sacks": int(row.sacks_suffered),
                "carries": int(row.carries),
                "rushingYards": int(row.rushing_yards),
                "rushingTouchdowns": int(row.rushing_tds),
                "targets": int(row.targets),
                "receptions": int(row.receptions),
                "receivingYards": int(row.receiving_yards),
                "receivingTouchdowns": int(row.receiving_tds),
                "fantasyPointsPpr": round(float(row.fantasy_points_ppr), 2),
            }
        )

    used_ids = set(stats["player_id"].astype(str))
    people_by_gsis = people.drop_duplicates("gsis_id").set_index("gsis_id", drop=False)
    latest_stats = stats.sort_values("week").drop_duplicates("player_id", keep="last").set_index("player_id")
    player_records = []
    for player_id in sorted(used_ids):
        stat = latest_stats.loc[player_id]
        person = people_by_gsis.loc[player_id] if player_id in people_by_gsis.index else None
        player_records.append(
            {
                "playerId": player_id,
                "name": str(stat["player_display_name"]),
                "position": str(stat["position"]),
                "latestTeam": as_text(stat["team"]),
                "headshotUrl": as_text(stat["headshot_url"]),
                "ecr": None if player_id not in ecr_by_gsis else round(float(ecr_by_gsis[player_id]), 2),
                "ecrUpdatedAt": ecr_date_by_gsis.get(player_id),
                "sourceIds": {
                    "gsis": player_id,
                    "pfr": None if person is None else as_text(person["pfr_id"]),
                },
            }
        )

    players_payload = {"schemaVersion": SCHEMA_VERSION, "data": player_records}
    player_games_payload = {"schemaVersion": SCHEMA_VERSION, "data": player_game_records}
    team_games_payload = {"schemaVersion": SCHEMA_VERSION, "data": team_game_records}
    validate("players.schema.json", players_payload)
    validate("player-games.schema.json", player_games_payload)
    validate("team-games.schema.json", team_games_payload)

    files = {
        "players": write_json("players.json", players_payload),
        "playerGames": write_json("player-games.json", player_games_payload),
        "teamGames": write_json("team-games.json", team_games_payload),
    }
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "season": SEASON,
        "provider": {
            "name": "nflverse",
            "license": "CC BY 4.0; underlying NFL data remains subject to its owners' terms",
            "sourceUrls": [*URLS.values(), *CSV_URLS.values()],
        },
        "files": files,
        "definitions": {
            "offensivePossessions": "Distinct nflverse play-by-play drive identifiers with a recorded possession team.",
            "offensivePlays": "Median team snap total reconstructed from player offense_snaps / offense_pct, rounded to a whole play.",
            "ecr": "Current FantasyPros redraft-overall expert consensus rank distributed by DynastyProcess through nflverse; null means the player is not currently ranked.",
            "nullSemantics": "null means unknown or unavailable; 0 means a verified zero",
        },
    }
    validate("manifest.schema.json", manifest)
    write_json("manifest.json", manifest, pretty=True)
    print(
        f"Generated {len(player_records)} players, {len(player_game_records)} player-games, "
        f"and {len(team_game_records)} team-games for {SEASON}."
    )


if __name__ == "__main__":
    main()
