export type Position = 'WR' | 'TE';

export interface Player {
  playerId: string;
  name: string;
  position: Position;
  latestTeam: string | null;
  headshotUrl: string | null;
  sourceIds: { gsis: string; pfr: string | null };
}

export interface PlayerGame {
  gameId: string;
  playerId: string;
  team: string;
  opponent: string;
  season: number;
  week: number;
  position: Position;
  played: boolean;
  offensiveSnaps: number | null;
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTouchdowns: number;
  fantasyPointsPpr: number;
}

export interface TeamGame {
  gameId: string;
  team: string;
  opponent: string;
  season: number;
  week: number;
  gameDate: string;
  offensivePossessions: number | null;
  offensivePlays: number | null;
}

export interface Envelope<T> { schemaVersion: '1.0.0'; data: T[] }

export interface Manifest {
  schemaVersion: '1.0.0';
  generatedAt: string;
  season: number;
  provider: { name: 'nflverse'; license: string; sourceUrls: string[] };
  files: Record<'players' | 'playerGames' | 'teamGames', { path: string; records: number; sha256: string }>;
  definitions: { offensivePossessions: string; offensivePlays: string; nullSemantics: string };
}

export interface Dataset {
  manifest: Manifest;
  players: Player[];
  playerGames: PlayerGame[];
  teamGames: TeamGame[];
}

export function parseDataset(
  manifest: unknown,
  players: unknown,
  playerGames: unknown,
  teamGames: unknown,
): Dataset {
  const envelopes = [players, playerGames, teamGames] as Array<{ schemaVersion?: unknown; data?: unknown }>;
  if (!manifest || typeof manifest !== 'object' || (manifest as { schemaVersion?: unknown }).schemaVersion !== '1.0.0') {
    throw new Error('Unsupported FantasyStacks manifest');
  }
  if (envelopes.some((envelope) => envelope?.schemaVersion !== '1.0.0' || !Array.isArray(envelope?.data))) {
    throw new Error('Unsupported FantasyStacks data envelope');
  }
  return {
    manifest: manifest as Manifest,
    players: (players as Envelope<Player>).data,
    playerGames: (playerGames as Envelope<PlayerGame>).data,
    teamGames: (teamGames as Envelope<TeamGame>).data,
  };
}

export type WindowKey = 'week18' | 'last3' | 'last5' | 'season';
export type SortKey =
  | 'ppr'
  | 'stackScore'
  | 'possessions'
  | 'teamPlays'
  | 'snaps'
  | 'targets'
  | 'receptions'
  | 'yards'
  | 'touchdowns'
  | 'possessionPerGame'
  | 'playsPerPossession'
  | 'snapShare'
  | 'targetsPerSnap'
  | 'catchRate'
  | 'yardsPerCatch'
  | 'touchdownsPerCatch';

export interface Profile {
  playerId: string;
  name: string;
  position: Position;
  team: string;
  games: number;
  possessions: number;
  teamPlays: number;
  snaps: number;
  targets: number;
  receptions: number;
  yards: number;
  touchdowns: number;
  ppr: number;
  possessionPerGame: number;
  playsPerPossession: number;
  snapShare: number;
  targetsPerSnap: number;
  catchRate: number;
  yardsPerCatch: number;
  touchdownsPerCatch: number;
  widths: number[];
  heights: number[];
  stackScore: number;
}

const safeRate = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : 0;

function percentile(value: number, values: number[]): number {
  if (!values.length) return 0;
  const belowOrEqual = values.reduce((total, candidate) => total + (candidate <= value ? 1 : 0), 0);
  return (belowOrEqual / values.length) * 100;
}

export function aggregateProfiles(
  dataset: Dataset,
  windowKey: WindowKey,
  position: 'ALL' | Position,
  team: string,
  minGames: number,
  minTargetsPerGame: number,
  sortKey: SortKey,
): Profile[] {
  const maximumWeek = Math.max(...dataset.playerGames.map((game) => game.week));
  const allowedWeeks = windowKey === 'week18'
    ? new Set([maximumWeek])
    : windowKey === 'last3'
      ? new Set([maximumWeek - 2, maximumWeek - 1, maximumWeek])
      : windowKey === 'last5'
        ? new Set([maximumWeek - 4, maximumWeek - 3, maximumWeek - 2, maximumWeek - 1, maximumWeek])
        : null;
  const players = new Map(dataset.players.map((player) => [player.playerId, player]));
  const teamGames = new Map(dataset.teamGames.map((game) => [`${game.gameId}:${game.team}`, game]));
  const accumulators = new Map<string, Omit<Profile, 'widths' | 'heights' | 'stackScore' | 'possessionPerGame' | 'playsPerPossession' | 'snapShare' | 'targetsPerSnap' | 'catchRate' | 'yardsPerCatch' | 'touchdownsPerCatch'>>();

  for (const game of dataset.playerGames) {
    if (!game.played || (allowedWeeks && !allowedWeeks.has(game.week))) continue;
    if (position !== 'ALL' && game.position !== position) continue;
    if (team !== 'ALL' && game.team !== team) continue;
    const player = players.get(game.playerId);
    if (!player) continue;
    const context = teamGames.get(`${game.gameId}:${game.team}`);
    const current = accumulators.get(game.playerId) ?? {
      playerId: game.playerId, name: player.name, position: game.position, team: game.team,
      games: 0, possessions: 0, teamPlays: 0, snaps: 0, targets: 0,
      receptions: 0, yards: 0, touchdowns: 0, ppr: 0,
    };
    current.games += 1;
    current.team = game.team;
    current.possessions += context?.offensivePossessions ?? 0;
    current.teamPlays += context?.offensivePlays ?? 0;
    current.snaps += game.offensiveSnaps ?? 0;
    current.targets += game.targets;
    current.receptions += game.receptions;
    current.yards += game.receivingYards;
    current.touchdowns += game.receivingTouchdowns;
    current.ppr += game.fantasyPointsPpr;
    accumulators.set(game.playerId, current);
  }

  const profiles = [...accumulators.values()]
    .filter((profile) => profile.games >= minGames && safeRate(profile.targets, profile.games) >= minTargetsPerGame)
    .map((profile): Profile => ({
      ...profile,
      possessionPerGame: safeRate(profile.possessions, profile.games),
      playsPerPossession: safeRate(profile.teamPlays, profile.possessions),
      snapShare: safeRate(profile.snaps, profile.teamPlays),
      targetsPerSnap: safeRate(profile.targets, profile.snaps),
      catchRate: safeRate(profile.receptions, profile.targets),
      yardsPerCatch: safeRate(profile.yards, profile.receptions),
      touchdownsPerCatch: safeRate(profile.touchdowns, profile.receptions),
      widths: [], heights: [], stackScore: 0,
    }));

  const volumeKeys: Array<keyof Profile> = ['possessions', 'teamPlays', 'snaps', 'targets', 'receptions', 'yards', 'touchdowns'];
  const efficiencyKeys: Array<keyof Profile> = ['possessionPerGame', 'playsPerPossession', 'snapShare', 'targetsPerSnap', 'catchRate', 'yardsPerCatch', 'touchdownsPerCatch'];
  for (const profile of profiles) {
    profile.widths = volumeKeys.map((key) => percentile(Number(profile[key]), profiles.map((candidate) => Number(candidate[key]))));
    profile.heights = efficiencyKeys.map((key) => percentile(Number(profile[key]), profiles.map((candidate) => Number(candidate[key]))));
    profile.stackScore = [...profile.widths.slice(2), ...profile.heights.slice(2)].reduce((a, b) => a + b, 0) / 10;
  }

  const selectors: Record<SortKey, (profile: Profile) => number> = {
    ppr: (profile) => profile.ppr,
    stackScore: (profile) => profile.stackScore,
    possessions: (profile) => profile.possessions,
    teamPlays: (profile) => profile.teamPlays,
    snaps: (profile) => profile.snaps,
    targets: (profile) => profile.targets,
    receptions: (profile) => profile.receptions,
    yards: (profile) => profile.yards,
    touchdowns: (profile) => profile.touchdowns,
    possessionPerGame: (profile) => profile.possessionPerGame,
    playsPerPossession: (profile) => profile.playsPerPossession,
    snapShare: (profile) => profile.snapShare,
    targetsPerSnap: (profile) => profile.targetsPerSnap,
    catchRate: (profile) => profile.catchRate,
    yardsPerCatch: (profile) => profile.yardsPerCatch,
    touchdownsPerCatch: (profile) => profile.touchdownsPerCatch,
  };
  return profiles.sort((a, b) =>
    selectors[sortKey](b) - selectors[sortKey](a)
    || b.ppr - a.ppr
    || b.targets - a.targets
    || a.name.localeCompare(b.name));
}

export const TEAM_COLORS: Record<string, string> = {
  ARI: '#97233f', ATL: '#a71930', BAL: '#5f4b8b', BUF: '#2f6fce', CAR: '#2a9fd6',
  CHI: '#c84522', CIN: '#fb4f14', CLE: '#ff6b22', DAL: '#5a7896', DEN: '#fb4f14',
  DET: '#28a7df', GB: '#5c8b74', HOU: '#2b596d', IND: '#4f7ea0', JAX: '#3a9296',
  KC: '#e31837', LA: '#3b82c4', LAC: '#36aeea', LV: '#8f9296', MIA: '#36a9a5',
  MIN: '#7b5aa6', NE: '#c2434a', NO: '#c7aa6a', NYG: '#4169a1', NYJ: '#3d8067',
  PHI: '#3d7775', PIT: '#d1aa32', SEA: '#3b7f70', SF: '#c7464a', TB: '#bb4741',
  TEN: '#5f8fb4', WAS: '#a13c42',
};
