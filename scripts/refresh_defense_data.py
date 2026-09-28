"""Join nflverse team box scores to the published FantasyStacks game snapshot."""

from __future__ import annotations

import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests
from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data" / "v1"
TEAM_STATS_URL = "https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_{season}.parquet"
SCHEDULES_URL = "https://github.com/nflverse/nflverse-data/releases/download/schedules/games.parquet"


def parquet(url: str) -> pd.DataFrame:
    response = requests.get(url, timeout=120, headers={"User-Agent": "FantasyStacks/0.1"})
    response.raise_for_status()
    return pd.read_parquet(io.BytesIO(response.content))


def whole(value: object, field: str, game_id: str) -> int:
    if pd.isna(value):
        raise ValueError(f"Missing {field} for {game_id}")
    result = int(round(float(value)))
    if result < 0:
        raise ValueError(f"Negative {field} for {game_id}")
    return result


def main() -> None:
    manifest_path = DATA / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    games = json.loads((DATA / "team-games.json").read_text(encoding="utf-8"))["data"]
    seasons = manifest["seasons"]
    urls = [TEAM_STATS_URL.format(season=season) for season in seasons]
    stats = pd.concat([parquet(url) for url in urls], ignore_index=True)
    stats = stats[stats["season_type"] == "REG"].set_index(["game_id", "team"])
    schedules = parquet(SCHEDULES_URL).set_index("game_id")
    offense = {(game["gameId"], game["team"]): game for game in games}
    records = []

    for game in games:
        game_id, team, opponent = game["gameId"], game["team"], game["opponent"]
        if (game_id, opponent) not in offense:
            raise ValueError(f"Missing opponent offensive context for {game_id}")
        try:
            defense = stats.loc[(game_id, team)]
            opposing_offense = stats.loc[(game_id, opponent)]
            schedule = schedules.loc[game_id]
        except KeyError as error:
            raise ValueError(f"Missing nflverse defense source for {game_id}: {error}") from error
        if team == schedule.home_team:
            opponent_score = schedule.away_score
        elif team == schedule.away_team:
            opponent_score = schedule.home_score
        else:
            raise ValueError(f"Schedule team mismatch for {game_id}")
        # nflverse stores sack yards lost as a signed (negative) yard value.
        sack_yards = opposing_offense.sack_yards_lost
        if pd.isna(sack_yards):
            raise ValueError(f"Missing sack_yards_lost for {game_id}")
        opponent_yards = (
            whole(opposing_offense.passing_yards, "passing_yards", game_id)
            + whole(opposing_offense.rushing_yards, "rushing_yards", game_id)
            + int(round(float(sack_yards)))
        )
        records.append({
            "gameId": game_id,
            "team": team,
            "opponent": opponent,
            "season": game["season"],
            "week": game["week"],
            "opponentPlays": whole(offense[(game_id, opponent)]["offensivePlays"], "offensivePlays", game_id),
            "opponentYards": opponent_yards,
            "opponentPoints": whole(opponent_score, "opponent score", game_id),
            "sacks": whole(defense.def_sacks, "def_sacks", game_id),
            "interceptions": whole(defense.def_interceptions, "def_interceptions", game_id),
            "fumbleRecoveries": whole(defense.fumble_recovery_opp, "fumble_recovery_opp", game_id),
            "defensiveTouchdowns": whole(defense.def_tds, "def_tds", game_id),
            "specialTeamsTouchdowns": whole(defense.special_teams_tds, "special_teams_tds", game_id),
            "safeties": whole(defense.def_safeties, "def_safeties", game_id),
        })

    payload = {"schemaVersion": "1.4.0", "data": records}
    schema = json.loads((ROOT / "schema" / "defense-games.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator(schema).validate(payload)
    output = DATA / "defense-games.json"
    previous_hash = hashlib.sha256(output.read_bytes()).hexdigest() if output.exists() else None
    encoded = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    output.write_bytes(encoded)
    current_hash = hashlib.sha256(encoded).hexdigest()
    manifest["files"]["defenseGames"] = {
        "path": "/data/v1/defense-games.json",
        "records": len(records),
        "sha256": current_hash,
    }
    manifest["definitions"]["opponentPoints"] = (
        "Opponent final scoreboard points; includes any points scored by the opponent's defense or special teams."
    )
    manifest["definitions"]["opponentYards"] = (
        "Opponent net offensive yards: passing plus rushing yards plus signed sack yards lost."
    )
    manifest["provider"]["sourceUrls"] = list(dict.fromkeys([
        *manifest["provider"]["sourceUrls"], *urls, SCHEDULES_URL,
    ]))
    if previous_hash != current_hash:
        manifest["generatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Generated {len(records)} defense-games across {len(seasons)} seasons")


if __name__ == "__main__":
    main()
