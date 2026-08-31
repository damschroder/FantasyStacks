export type Position = 'WR' | 'TE' | 'RB';
export type PositionFilter = 'FLEX' | 'RECEIVERS' | Position;

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
  carries: number;
  rushingYards: number;
  rushingTouchdowns: number;
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

export interface Envelope<T> { schemaVersion: '1.1.0'; data: T[] }

export interface Manifest {
  schemaVersion: '1.1.0';
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
  if (!manifest || typeof manifest !== 'object' || (manifest as { schemaVersion?: unknown }).schemaVersion !== '1.1.0') {
    throw new Error('Unsupported FantasyStacks manifest');
  }
  if (envelopes.some((envelope) => envelope?.schemaVersion !== '1.1.0' || !Array.isArray(envelope?.data))) {
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
  | 'opportunities'
  | 'carries'
  | 'targets'
  | 'receptions'
  | 'yards'
  | 'rushingYards'
  | 'receivingYards'
  | 'touchdowns'
  | 'rushingTouchdowns'
  | 'receivingTouchdowns'
  | 'possessionPerGame'
  | 'playsPerPossession'
  | 'snapShare'
  | 'targetsPerSnap'
  | 'opportunitiesPerSnap'
  | 'catchRate'
  | 'yardsPerCatch'
  | 'touchdownsPerCatch'
  | 'yardsPerTouch'
  | 'touchdownsPerTouch';

export interface Profile {
  playerId: string;
  name: string;
  position: Position;
  team: string;
  games: number;
  possessions: number;
  teamPlays: number;
  snaps: number;
  carries: number;
  targets: number;
  receptions: number;
  rushingYards: number;
  receivingYards: number;
  rushingTouchdowns: number;
  receivingTouchdowns: number;
  opportunities: number;
  yards: number;
  touchdowns: number;
  ppr: number;
  possessionPerGame: number;
  playsPerPossession: number;
  snapShare: number;
  targetsPerSnap: number;
  opportunitiesPerSnap: number;
  catchRate: number;
  yardsPerCatch: number;
  touchdownsPerCatch: number;
  yardsPerTouch: number;
  touchdownsPerTouch: number;
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
  position: PositionFilter,
  team: string,
  minGames: number,
  minUsagePerGame: number,
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
  type Accumulator = Pick<Profile,
    'playerId' | 'name' | 'position' | 'team' | 'games' | 'possessions' | 'teamPlays' | 'snaps'
    | 'carries' | 'targets' | 'receptions' | 'rushingYards' | 'receivingYards'
    | 'rushingTouchdowns' | 'receivingTouchdowns' | 'ppr'>;
  const accumulators = new Map<string, Accumulator>();

  for (const game of dataset.playerGames) {
    if (!game.played || (allowedWeeks && !allowedWeeks.has(game.week))) continue;
    if (position === 'RECEIVERS' && game.position === 'RB') continue;
    if (position !== 'FLEX' && position !== 'RECEIVERS' && game.position !== position) continue;
    if (team !== 'ALL' && game.team !== team) continue;
    const player = players.get(game.playerId);
    if (!player) continue;
    const context = teamGames.get(`${game.gameId}:${game.team}`);
    const current = accumulators.get(game.playerId) ?? {
      playerId: game.playerId, name: player.name, position: game.position, team: game.team,
      games: 0, possessions: 0, teamPlays: 0, snaps: 0, carries: 0, targets: 0,
      receptions: 0, rushingYards: 0, receivingYards: 0,
      rushingTouchdowns: 0, receivingTouchdowns: 0, ppr: 0,
    };
    current.games += 1;
    current.team = game.team;
    current.possessions += context?.offensivePossessions ?? 0;
    current.teamPlays += context?.offensivePlays ?? 0;
    current.snaps += game.offensiveSnaps ?? 0;
    current.carries += game.carries;
    current.targets += game.targets;
    current.receptions += game.receptions;
    current.rushingYards += game.rushingYards;
    current.receivingYards += game.receivingYards;
    current.rushingTouchdowns += game.rushingTouchdowns;
    current.receivingTouchdowns += game.receivingTouchdowns;
    current.ppr += game.fantasyPointsPpr;
    accumulators.set(game.playerId, current);
  }

  const profiles = [...accumulators.values()]
    .filter((profile) => {
      const usage = profile.position === 'RB' ? profile.carries + profile.targets : profile.targets;
      return profile.games >= minGames && safeRate(usage, profile.games) >= minUsagePerGame;
    })
    .map((profile): Profile => {
      const isRunningBack = profile.position === 'RB';
      const opportunities = isRunningBack ? profile.carries + profile.targets : profile.targets;
      const yards = isRunningBack ? profile.rushingYards + profile.receivingYards : profile.receivingYards;
      const touchdowns = isRunningBack ? profile.rushingTouchdowns + profile.receivingTouchdowns : profile.receivingTouchdowns;
      const actualTouches = profile.carries + profile.receptions;
      return {
        ...profile,
        opportunities,
        yards,
        touchdowns,
        possessionPerGame: safeRate(profile.possessions, profile.games),
        playsPerPossession: safeRate(profile.teamPlays, profile.possessions),
        snapShare: safeRate(profile.snaps, profile.teamPlays),
        targetsPerSnap: safeRate(profile.targets, profile.snaps),
        opportunitiesPerSnap: safeRate(opportunities, profile.snaps),
        catchRate: safeRate(profile.receptions, profile.targets),
        yardsPerCatch: safeRate(profile.receivingYards, profile.receptions),
        touchdownsPerCatch: safeRate(profile.receivingTouchdowns, profile.receptions),
        yardsPerTouch: safeRate(yards, actualTouches),
        touchdownsPerTouch: safeRate(touchdowns, actualTouches),
        widths: [], heights: [], stackScore: 0,
      };
    });

  const volumeValues = (profile: Profile) => profile.position === 'RB'
    ? [profile.possessions, profile.teamPlays, profile.snaps, profile.opportunities, profile.receptions, profile.yards, profile.touchdowns]
    : [profile.possessions, profile.teamPlays, profile.snaps, profile.targets, profile.receptions, profile.yards, profile.touchdowns];
  const efficiencyValues = (profile: Profile) => profile.position === 'RB'
    ? [profile.possessionPerGame, profile.playsPerPossession, profile.snapShare, profile.opportunitiesPerSnap, profile.catchRate, profile.yardsPerTouch, profile.touchdownsPerTouch]
    : [profile.possessionPerGame, profile.playsPerPossession, profile.snapShare, profile.targetsPerSnap, profile.catchRate, profile.yardsPerCatch, profile.touchdownsPerCatch];
  const volumeMatrix = profiles.map(volumeValues);
  const efficiencyMatrix = profiles.map(efficiencyValues);
  for (const profile of profiles) {
    profile.widths = volumeValues(profile).map((value, index) => percentile(value, volumeMatrix.map((candidate) => candidate[index])));
    profile.heights = efficiencyValues(profile).map((value, index) => percentile(value, efficiencyMatrix.map((candidate) => candidate[index])));
    profile.stackScore = [...profile.widths.slice(2), ...profile.heights.slice(2)].reduce((a, b) => a + b, 0) / 10;
  }

  const selectors: Record<SortKey, (profile: Profile) => number> = {
    ppr: (profile) => profile.ppr,
    stackScore: (profile) => profile.stackScore,
    possessions: (profile) => profile.possessions,
    teamPlays: (profile) => profile.teamPlays,
    snaps: (profile) => profile.snaps,
    opportunities: (profile) => profile.opportunities,
    carries: (profile) => profile.carries,
    targets: (profile) => profile.targets,
    receptions: (profile) => profile.receptions,
    yards: (profile) => profile.yards,
    rushingYards: (profile) => profile.rushingYards,
    receivingYards: (profile) => profile.receivingYards,
    touchdowns: (profile) => profile.touchdowns,
    rushingTouchdowns: (profile) => profile.rushingTouchdowns,
    receivingTouchdowns: (profile) => profile.receivingTouchdowns,
    possessionPerGame: (profile) => profile.possessionPerGame,
    playsPerPossession: (profile) => profile.playsPerPossession,
    snapShare: (profile) => profile.snapShare,
    targetsPerSnap: (profile) => profile.targetsPerSnap,
    opportunitiesPerSnap: (profile) => profile.opportunitiesPerSnap,
    catchRate: (profile) => profile.catchRate,
    yardsPerCatch: (profile) => profile.yardsPerCatch,
    touchdownsPerCatch: (profile) => profile.touchdownsPerCatch,
    yardsPerTouch: (profile) => profile.yardsPerTouch,
    touchdownsPerTouch: (profile) => profile.touchdownsPerTouch,
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

export const TEAM_LOGOS: Record<string, string> = {
  ARI: 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
  ATL: 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
  BAL: 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
  BUF: 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
  CAR: 'https://a.espncdn.com/i/teamlogos/nfl/500-dark/car.png',
  CHI: 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
  CIN: 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
  CLE: 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
  DAL: 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
  DEN: 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
  DET: 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
  GB: 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
  HOU: 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
  IND: 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
  JAX: 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
  KC: 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
  LA: 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
  LAC: 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
  LV: 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
  MIA: 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
  MIN: 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
  NE: 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
  NO: 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
  NYG: 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
  NYJ: 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
  PHI: 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
  PIT: 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
  SEA: 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
  SF: 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
  TB: 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
  TEN: 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
  WAS: 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
};
