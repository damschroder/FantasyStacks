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
defense_games = load("defense-games.json")["data"]

player_ids = {player["playerId"] for player in players}
team_context = {(game["gameId"], game["team"]): game for game in team_games}

assert player_games, "player-game dataset is empty"
assert team_games, "team-game dataset is empty"
assert defense_games, "defense-game dataset is empty"
assert manifest["seasons"] == [2025, 2026]
current_weeks = set(range(1, manifest["currentSeasonThroughWeek"] + 1))
assert {game["week"] for game in player_games if game["season"] == manifest["season"]} == current_weeks
assert {game["week"] for game in team_games if game["season"] == manifest["season"]} == current_weeks
current_game_ids = {game["gameId"] for game in team_games if game["season"] == manifest["season"]}
latest_week_game_ids = {
    game["gameId"]
    for game in team_games
    if game["season"] == manifest["season"] and game["week"] == manifest["currentSeasonThroughWeek"]
}
assert len(current_game_ids) == manifest["currentSeasonGamesIncluded"]
assert len(latest_week_game_ids) == manifest["currentWeekGamesIncluded"]
assert manifest["currentWeekGamesIncluded"] <= manifest["currentWeekGamesScheduled"]
assert manifest["currentSeasonGamesIncluded"] <= manifest["currentSeasonGamesScheduledThroughWeek"]
assert {game["season"] for game in player_games} == set(manifest["seasons"])
assert all(game["playerId"] in player_ids for game in player_games)
assert all((game["gameId"], game["team"]) in team_context for game in player_games)
assert all(game["receptions"] <= game["targets"] for game in player_games)
# Lateral plays can credit receiving yards/TDs without an official reception.
assert all(game["receivingTouchdowns"] <= max(game["receptions"], 1) for game in player_games)
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

# Business rule: starting from the newest official weekly injury feed, a
# refresh must attach only current game designations or material practice
# limitations. Missing status remains null rather than being presented as
# healthy; a failure means the cards can show stale or misleading availability.
injured_players = [player for player in players if player.get("injuryStatus") is not None]
assert all(
    {"injuryStatus", "injuryStatusSource", "injuryDescription", "injuryWeek"}.issubset(player)
    for player in players
), "player records are missing injury status fields"
assert all(player["injuryStatusSource"] in {"game", "practice"} for player in injured_players)
assert len({player["injuryWeek"] for player in injured_players}) <= 1, "injury statuses span multiple report weeks"
assert all(
    player.get("injuryStatus") is None
    or player["injuryStatusSource"] == "game"
    or player["injuryStatus"] in {"Did Not Participate In Practice", "Limited Participation in Practice"}
    for player in players
)

defense_context = {(game["gameId"], game["team"]): game for game in defense_games}
assert len(defense_context) == len(defense_games), "duplicate defense-game keys"
assert defense_context.keys() == team_context.keys(), "defense games do not match team games"
assert {game["week"] for game in defense_games if game["season"] == manifest["season"]} == current_weeks
for game in defense_games:
    opponent = team_context[(game["gameId"], game["opponent"])]
    assert game["opponentPlays"] == opponent["offensivePlays"]
    assert game["season"] == opponent["season"] and game["week"] == opponent["week"]
    assert all(game[field] >= 0 for field in (
        "opponentPlays", "opponentYards", "opponentPoints", "sacks",
        "interceptions", "fumbleRecoveries", "defensiveTouchdowns",
        "specialTeamsTouchdowns", "safeties",
    ))

for key, descriptor in manifest["files"].items():
    path = DATA / Path(descriptor["path"]).name
    assert hashlib.sha256(path.read_bytes()).hexdigest() == descriptor["sha256"], f"bad checksum: {key}"

qualified_season = {}
for game in player_games:
    if game["season"] != manifest["season"] or not game["played"]:
        continue
    aggregate = qualified_season.setdefault(game["playerId"], {"games": 0, "usage": 0, "position": game["position"]})
    aggregate["games"] += 1
    aggregate["usage"] += (
        game["passingAttempts"]
        if game["position"] == "QB"
        else game["targets"] + (game["carries"] if game["position"] == "RB" else 0)
    )
qualified_count = sum(1 for value in qualified_season.values() if value["games"] >= 1 and value["usage"] / value["games"] >= 2)
assert qualified_count >= 50, f"unexpectedly small qualified cohort: {qualified_count}"

print(f"Integrity checks passed for {len(players)} players, {len(player_games)} player-games, and {len(defense_games)} defense-games; {qualified_count} players qualify by default.")
