"""Fast integrity checks for the generated FantasyStacks dataset."""

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data" / "v1"


def load(name: str) -> dict:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


manifest = load("manifest.json")
players = load("players.json")["data"]
player_games = load("player-games.json")["data"]
team_games = load("team-games.json")["data"]

player_ids = {player["playerId"] for player in players}
team_context = {(game["gameId"], game["team"]): game for game in team_games}

assert player_games, "player-game dataset is empty"
assert team_games, "team-game dataset is empty"
assert all(game["playerId"] in player_ids for game in player_games)
assert all((game["gameId"], game["team"]) in team_context for game in player_games)
assert all(game["receptions"] <= game["targets"] for game in player_games)
assert all(game["receivingTouchdowns"] <= game["receptions"] for game in player_games)
assert all(game["position"] in {"WR", "TE", "RB", "QB"} for game in player_games)
assert all(game["completions"] <= game["passingAttempts"] for game in player_games)
assert all(game["passingTouchdowns"] <= game["completions"] for game in player_games)
assert all(game["interceptions"] <= game["passingAttempts"] for game in player_games)
assert all(game["sacks"] >= 0 for game in player_games)
assert all(game["carries"] >= 0 for game in player_games)
assert all(game["rushingTouchdowns"] <= game["carries"] for game in player_games)
assert any(game["position"] == "RB" and game["carries"] > 0 for game in player_games)
assert any(game["position"] == "QB" and game["passingAttempts"] > 0 for game in player_games)
assert all(player["ecr"] is None or player["ecr"] > 0 for player in players)
assert sum(player["ecr"] is not None for player in players) >= 300

for key, descriptor in manifest["files"].items():
    path = DATA / Path(descriptor["path"]).name
    assert hashlib.sha256(path.read_bytes()).hexdigest() == descriptor["sha256"], f"bad checksum: {key}"

qualified_season = {}
for game in player_games:
    if not game["played"]:
        continue
    aggregate = qualified_season.setdefault(game["playerId"], {"games": 0, "usage": 0, "position": game["position"]})
    aggregate["games"] += 1
    aggregate["usage"] += (
        game["passingAttempts"]
        if game["position"] == "QB"
        else game["targets"] + (game["carries"] if game["position"] == "RB" else 0)
    )
qualified_count = sum(1 for value in qualified_season.values() if value["games"] >= 6 and value["usage"] / value["games"] >= 2)
assert qualified_count >= 50, f"unexpectedly small qualified cohort: {qualified_count}"

print(f"Integrity checks passed for {len(players)} players and {len(player_games)} player-games; {qualified_count} qualify by default.")
