import type { Dataset, DefenseGame, VolumeMode, WindowKey } from './data-contract';

export type DefenseSort = 'fantasyPoints' | 'opponentPoints' | 'opponentYards' | 'opponentPlays' | 'sacks' | 'interceptions' | 'fumbleRecoveries' | 'touchdowns';

export interface DefenseProfile {
  team: string;
  games: number;
  opponentPlays: number;
  opponentYards: number;
  opponentPoints: number;
  sacks: number;
  interceptions: number;
  fumbleRecoveries: number;
  defensiveTouchdowns: number;
  specialTeamsTouchdowns: number;
  safeties: number;
  fantasyPoints: number;
  impactPlays: number;
  yardsPerPlay: number;
  pointsPerGame: number;
  widths: number[];
  ranks: Array<{ rank: number; total: number }>;
}

// Transparent baseline, calculated separately for each game before summing.
// Points allowed uses the opponent's final scoreboard score, not a platform's
// attribution rules for points scored by the opponent's defense or special teams.
export function defenseFantasyPoints(game: DefenseGame): number {
  const points = game.opponentPoints;
  const allowed = points === 0 ? 10 : points <= 6 ? 7 : points <= 13 ? 4
    : points <= 20 ? 1 : points <= 27 ? 0 : points <= 34 ? -1 : -4;
  return game.sacks + 2 * game.interceptions + 2 * game.fumbleRecoveries
    + 6 * (game.defensiveTouchdowns + game.specialTeamsTouchdowns)
    + 2 * game.safeties + allowed;
}

function rank(value: number, values: number[], lowerIsBetter = false) {
  const better = values.filter((candidate) => lowerIsBetter ? candidate < value : candidate > value).length;
  return { rank: better + 1, total: values.length };
}

export function aggregateDefenses(
  dataset: Dataset,
  windowKey: WindowKey,
  team: string,
  minGames: number,
  volumeMode: VolumeMode,
  sort: DefenseSort,
): DefenseProfile[] {
  const season = windowKey === 'lastYear' ? dataset.manifest.season - 1 : dataset.manifest.season;
  const week = windowKey.startsWith('week:') ? Number(windowKey.slice(5)) : null;
  const byTeam = new Map<string, DefenseProfile>();
  for (const game of dataset.defenseGames) {
    if (game.season !== season || (week !== null && game.week !== week) || (team !== 'ALL' && game.team !== team)) continue;
    const profile = byTeam.get(game.team) ?? {
      team: game.team, games: 0, opponentPlays: 0, opponentYards: 0, opponentPoints: 0,
      sacks: 0, interceptions: 0, fumbleRecoveries: 0, defensiveTouchdowns: 0,
      specialTeamsTouchdowns: 0, safeties: 0, fantasyPoints: 0, impactPlays: 0,
      yardsPerPlay: 0, pointsPerGame: 0, widths: [], ranks: [],
    };
    profile.games += 1;
    profile.opponentPlays += game.opponentPlays;
    profile.opponentYards += game.opponentYards;
    profile.opponentPoints += game.opponentPoints;
    profile.sacks += game.sacks;
    profile.interceptions += game.interceptions;
    profile.fumbleRecoveries += game.fumbleRecoveries;
    profile.defensiveTouchdowns += game.defensiveTouchdowns;
    profile.specialTeamsTouchdowns += game.specialTeamsTouchdowns;
    profile.safeties += game.safeties;
    profile.fantasyPoints += defenseFantasyPoints(game);
    byTeam.set(game.team, profile);
  }
  const profiles = [...byTeam.values()].filter((profile) => profile.games >= minGames);
  const perGame = volumeMode === 'perGame';
  const values = (profile: DefenseProfile) => [
    perGame ? profile.opponentPlays / profile.games : profile.opponentPlays,
    profile.yardsPerPlay,
    profile.pointsPerGame,
    perGame ? profile.impactPlays / profile.games : profile.impactPlays,
    perGame ? profile.fantasyPoints / profile.games : profile.fantasyPoints,
  ];
  for (const profile of profiles) {
    profile.impactPlays = profile.sacks + profile.interceptions + profile.fumbleRecoveries
      + profile.defensiveTouchdowns + profile.specialTeamsTouchdowns;
    profile.yardsPerPlay = profile.opponentPlays ? profile.opponentYards / profile.opponentPlays : 0;
    profile.pointsPerGame = profile.opponentPoints / profile.games;
  }
  const matrix = profiles.map(values);
  for (const profile of profiles) {
    profile.ranks = values(profile).map((value, index) => rank(value, matrix.map((row) => row[index]), index === 1 || index === 2));
    profile.widths = profile.ranks.map(({ rank: place, total }) => total < 2 ? 100 : 32 + (total - place) / (total - 1) * 68);
  }
  const sortValue = (profile: DefenseProfile) => {
    if (sort === 'opponentPoints') return -profile.pointsPerGame;
    if (sort === 'opponentYards') return -profile.yardsPerPlay;
    const raw = sort === 'touchdowns'
      ? profile.defensiveTouchdowns + profile.specialTeamsTouchdowns
      : profile[sort];
    return perGame ? raw / profile.games : raw;
  };
  return profiles.sort((a, b) => sortValue(b) - sortValue(a) || b.fantasyPoints - a.fantasyPoints || a.team.localeCompare(b.team));
}
