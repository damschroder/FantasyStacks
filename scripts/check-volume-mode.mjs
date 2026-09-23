import assert from 'node:assert/strict';
import { aggregateProfiles } from '../lib/data-contract.ts';

const player = (playerId, name) => ({
  playerId,
  name,
  position: 'WR',
  latestTeam: 'DEN',
  headshotUrl: null,
  ecr: null,
  ecrUpdatedAt: null,
  sourceIds: { gsis: playerId, pfr: null },
});

const playerGame = (playerId, week, targets, fantasyPointsPpr) => ({
  gameId: `2026_0${week}_LV_DEN`,
  playerId,
  team: 'DEN',
  opponent: 'LV',
  season: 2026,
  week,
  position: 'WR',
  played: true,
  offensiveSnaps: 40,
  passingAttempts: 0,
  completions: 0,
  passingYards: 0,
  passingTouchdowns: 0,
  interceptions: 0,
  sacks: 0,
  carries: 0,
  rushingYards: 0,
  rushingTouchdowns: 0,
  targets,
  receptions: targets,
  receivingYards: targets * 10,
  receivingTouchdowns: 0,
  fantasyPointsPpr,
});

const teamGame = (week, offensivePlays) => ({
  gameId: `2026_0${week}_LV_DEN`,
  team: 'DEN',
  opponent: 'LV',
  season: 2026,
  week,
  gameDate: `2026-09-${10 + week}`,
  offensivePossessions: 10,
  offensivePlays,
});

const dataset = {
  manifest: {
    schemaVersion: '1.4.0',
    generatedAt: '2026-09-23T00:00:00Z',
    season: 2026,
    seasons: [2025, 2026],
    currentSeasonThroughWeek: 3,
    provider: { name: 'nflverse', license: 'CC BY 4.0', sourceUrls: [] },
    files: {},
    definitions: {},
  },
  players: [player('player-a', 'Player A'), player('player-b', 'Player B')],
  playerGames: [
    playerGame('player-a', 1, 6, 10),
    // Player A missed Week 2, so there is intentionally no player-game record.
    playerGame('player-a', 3, 6, 10),
    playerGame('player-b', 1, 5, 8),
    playerGame('player-b', 2, 5, 8),
    playerGame('player-b', 3, 5, 8),
  ],
  teamGames: [teamGame(1, 100), teamGame(2, 110), teamGame(3, 120)],
  defenseGames: [],
};

const aggregate = (volumeMode) => aggregateProfiles(
  dataset,
  'thisYear',
  'WR',
  'ALL',
  1,
  0,
  1,
  500,
  true,
  volumeMode,
  'full',
  'targets',
);

const totals = aggregate('total');
const perGame = aggregate('perGame');
const playerATotal = totals.find((profile) => profile.playerId === 'player-a');

assert.equal(totals[0].playerId, 'player-b', 'Total mode should sort by accumulated targets');
assert.equal(perGame[0].playerId, 'player-a', 'Per-game mode should sort by targets per appearance');
assert.equal(playerATotal.games, 2, 'A missed team game must not count as a player appearance');
assert.equal(playerATotal.teamPlays, 220, 'Team plays should include only games in which the player appeared');

console.log('Total / Per game behavior excludes missed player games.');
