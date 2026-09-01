'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  aggregateProfiles,
  Dataset,
  PositionFilter,
  Profile,
  SortKey,
  TEAM_COLORS,
  TEAM_LOGOS,
  VolumeMode,
  WindowKey,
} from '@/lib/data-contract';

const WINDOW_LABELS: Record<WindowKey, string> = {
  lastWeek: 'Last week', last3: 'Last 3', last5: 'Last 5', thisYear: 'This year', lastYear: 'Last year',
};
const SORT_LABELS: Record<SortKey, string> = {
  ppr: 'PPR points',
  stackScore: 'Stack score',
  possessions: 'Team possessions',
  teamPlays: 'Team plays',
  snaps: 'Offensive snaps',
  opportunities: 'Touches + targets',
  carries: 'Rushing touches',
  targets: 'Targets',
  receptions: 'Catches',
  yards: 'Total yards',
  rushingYards: 'Rushing yards',
  receivingYards: 'Receiving yards',
  touchdowns: 'Total TDs',
  rushingTouchdowns: 'Rushing TDs',
  receivingTouchdowns: 'Receiving TDs',
  possessionPerGame: 'Possessions / game',
  playsPerPossession: 'Plays / possession',
  snapShare: 'Snap share',
  targetsPerSnap: 'Targets / snap',
  opportunitiesPerSnap: 'Opportunities / snap',
  catchRate: 'Catch rate',
  yardsPerCatch: 'Yards / catch',
  touchdownsPerCatch: 'TDs / catch',
  yardsPerTouch: 'Yards / touch',
  touchdownsPerTouch: 'TDs / touch',
  passingAttempts: 'Pass attempts',
  completions: 'Completions',
  passingYards: 'Passing yards',
  passingTouchdowns: 'Passing TDs',
  negativePlays: 'Sacks + interceptions',
  interceptions: 'Interceptions',
  sacks: 'Sacks',
  attemptsPerSnap: 'Attempts / snap',
  completionRate: 'Completion rate',
  cleanDropbackRate: 'Clean dropback rate',
  yardsPerAttempt: 'Yards / attempt',
  touchdownsPerAttempt: 'TDs / attempt',
  interceptionRate: 'Interception rate',
  sackRate: 'Sack rate',
};
const RECEIVER_SORT_GROUPS: Array<{ label: string; keys: SortKey[] }> = [
  { label: 'Overview', keys: ['ppr', 'stackScore'] },
  { label: 'Stack layers · volume', keys: ['possessions', 'teamPlays', 'snaps', 'targets', 'receptions', 'yards', 'touchdowns'] },
  { label: 'Transitions · efficiency', keys: ['possessionPerGame', 'playsPerPossession', 'snapShare', 'targetsPerSnap', 'catchRate', 'yardsPerCatch', 'touchdownsPerCatch'] },
];
const RB_SORT_GROUPS: Array<{ label: string; keys: SortKey[] }> = [
  { label: 'Overview', keys: ['ppr', 'stackScore'] },
  { label: 'Stack layers · volume', keys: ['possessions', 'teamPlays', 'snaps', 'opportunities', 'carries', 'targets', 'receptions', 'yards', 'rushingYards', 'receivingYards', 'touchdowns', 'rushingTouchdowns', 'receivingTouchdowns'] },
  { label: 'Transitions · efficiency', keys: ['possessionPerGame', 'playsPerPossession', 'snapShare', 'opportunitiesPerSnap', 'catchRate', 'yardsPerTouch', 'touchdownsPerTouch'] },
];
const FLEX_SORT_GROUPS: Array<{ label: string; keys: SortKey[] }> = [
  { label: 'Overview', keys: ['ppr', 'stackScore'] },
  { label: 'Shared layers · volume', keys: ['possessions', 'teamPlays', 'snaps', 'targets', 'receptions', 'receivingYards', 'receivingTouchdowns'] },
  { label: 'RB + composite layers', keys: ['opportunities', 'carries', 'yards', 'rushingYards', 'touchdowns', 'rushingTouchdowns'] },
  { label: 'Shared transitions', keys: ['possessionPerGame', 'playsPerPossession', 'snapShare', 'targetsPerSnap', 'catchRate', 'yardsPerCatch', 'touchdownsPerCatch'] },
  { label: 'RB + composite transitions', keys: ['opportunitiesPerSnap', 'yardsPerTouch', 'touchdownsPerTouch'] },
];
const QB_SORT_GROUPS: Array<{ label: string; keys: SortKey[] }> = [
  { label: 'Overview', keys: ['ppr', 'stackScore'] },
  { label: 'Stack layers · volume', keys: ['possessions', 'teamPlays', 'snaps', 'passingAttempts', 'negativePlays', 'sacks', 'interceptions', 'completions', 'passingYards', 'passingTouchdowns'] },
  { label: 'Transitions · efficiency', keys: ['possessionPerGame', 'playsPerPossession', 'snapShare', 'attemptsPerSnap', 'cleanDropbackRate', 'completionRate', 'yardsPerAttempt', 'touchdownsPerAttempt', 'sackRate', 'interceptionRate'] },
];

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = (value: number) => `${decimal.format(value * 100)}%`;
const minimumGamesForWindow = (windowKey: WindowKey) => windowKey === 'thisYear' || windowKey === 'lastYear' ? 6 : windowKey === 'last5' ? 3 : windowKey === 'last3' ? 2 : 1;

type StackLayer = {
  label: string;
  value: string;
  rate: string;
  receivingOnly?: boolean;
  split?: { primary: number; secondary: number; description: string };
};

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>;
}

function PlayerStack({
  profile,
  rank,
  pinned,
  volumeMode,
  onTogglePin,
}: {
  profile: Profile;
  rank: number;
  pinned: boolean;
  volumeMode: VolumeMode;
  onTogglePin: () => void;
}) {
  const perGame = volumeMode === 'perGame';
  const volume = (value: number) => perGame ? decimal.format(value / profile.games) : integer.format(value);
  const splitValue = (value: number, label: string) => `${volume(value)} ${label}${perGame ? ' / game' : ''}`;
  const receiverLayers: StackLayer[] = [
    { label: 'Possessions', value: volume(profile.possessions), rate: `${decimal.format(profile.possessionPerGame)} / game` },
    { label: 'Team plays', value: volume(profile.teamPlays), rate: `${decimal.format(profile.playsPerPossession)} / possession` },
    { label: 'Snaps', value: volume(profile.snaps), rate: `${percent(profile.snapShare)} snap share` },
    { label: 'Targets', value: volume(profile.targets), rate: `${percent(profile.targetsPerSnap)} / snap` },
    { label: 'Catches', value: volume(profile.receptions), rate: `${percent(profile.catchRate)} caught` },
    { label: 'Yards', value: volume(profile.yards), rate: `${decimal.format(profile.yardsPerCatch)} / catch` },
    { label: 'TD', value: volume(profile.touchdowns), rate: `${percent(profile.touchdownsPerCatch)} / catch` },
  ];
  const runningBackLayers: StackLayer[] = [
    { label: 'Possessions', value: volume(profile.possessions), rate: `${decimal.format(profile.possessionPerGame)} / game` },
    { label: 'Team plays', value: volume(profile.teamPlays), rate: `${decimal.format(profile.playsPerPossession)} / possession` },
    { label: 'Snaps', value: volume(profile.snaps), rate: `${percent(profile.snapShare)} snap share` },
    {
      label: 'Touches + targets',
      value: volume(profile.opportunities),
      rate: `${percent(profile.opportunitiesPerSnap)} / snap`,
      split: { primary: profile.carries, secondary: profile.targets, description: `${splitValue(profile.carries, 'rushing touches')} · ${splitValue(profile.targets, 'targets')}` },
    },
    { label: 'Catches', value: volume(profile.receptions), rate: `${percent(profile.catchRate)} caught`, receivingOnly: true },
    {
      label: 'Scrim yards',
      value: volume(profile.yards),
      rate: `${decimal.format(profile.yardsPerTouch)} / touch`,
      split: { primary: profile.rushingYards, secondary: profile.receivingYards, description: `${splitValue(profile.rushingYards, 'rushing yards')} · ${splitValue(profile.receivingYards, 'receiving yards')}` },
    },
    {
      label: 'Total TD',
      value: volume(profile.touchdowns),
      rate: `${percent(profile.touchdownsPerTouch)} / touch`,
      split: { primary: profile.rushingTouchdowns, secondary: profile.receivingTouchdowns, description: `${splitValue(profile.rushingTouchdowns, 'rushing TDs')} · ${splitValue(profile.receivingTouchdowns, 'receiving TDs')}` },
    },
  ];
  const quarterbackLayers: StackLayer[] = [
    { label: 'Possessions', value: volume(profile.possessions), rate: `${decimal.format(profile.possessionPerGame)} / game` },
    { label: 'Team plays', value: volume(profile.teamPlays), rate: `${decimal.format(profile.playsPerPossession)} / possession` },
    { label: 'Snaps', value: volume(profile.snaps), rate: `${percent(profile.snapShare)} snap share` },
    { label: 'Passes', value: volume(profile.passingAttempts), rate: `${percent(profile.attemptsPerSnap)} / snap` },
    {
      label: 'Sacks + INT',
      value: volume(profile.negativePlays),
      rate: `${percent(profile.cleanDropbackRate)} clean`,
      split: { primary: profile.sacks, secondary: profile.interceptions, description: `${splitValue(profile.sacks, 'sacks')} · ${splitValue(profile.interceptions, 'interceptions')}` },
    },
    { label: 'Completions', value: volume(profile.completions), rate: `${percent(profile.completionRate)} complete` },
    { label: 'Pass yards', value: volume(profile.passingYards), rate: `${decimal.format(profile.yardsPerAttempt)} / attempt` },
    { label: 'Pass TD', value: volume(profile.passingTouchdowns), rate: `${percent(profile.touchdownsPerAttempt)} / attempt` },
  ];
  const layers = profile.position === 'QB' ? quarterbackLayers : profile.position === 'RB' ? runningBackLayers : receiverLayers;
  const color = TEAM_COLORS[profile.team] ?? '#6e777a';
  const logo = TEAM_LOGOS[profile.team];
  return (
    <article className={`player-card${pinned ? ' pinned' : ''}`} style={{ '--accent': color } as React.CSSProperties}>
      <div className="player-heading">
        <div>
          <p className="player-meta">
            <span className="team-identity">
              {logo && <Image className="team-logo" src={logo} alt="" width={28} height={28} loading="lazy" unoptimized />}
              <strong>{profile.team}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>{profile.position}</span>
            <span aria-hidden="true">·</span>
            <span>{profile.games} GAMES</span>
          </p>
          <h2>{profile.name}</h2>
          <p className="ppr-line"><strong>{decimal.format(perGame ? profile.ppr / profile.games : profile.ppr)}</strong> {perGame ? 'PPR / GAME' : 'PPR TOTAL'}{profile.ecr !== null && <em>FP ECR {decimal.format(profile.ecr)}</em>}</p>
          {profile.position === 'RB' && <p className="role-legend"><span className="rush-key">RUSH / TOUCH</span><span className="receive-key">TARGET / RECEIVE</span></p>}
          {profile.position === 'QB' && <p className="role-legend"><span className="sack-key">SACKS</span><span className="interception-key">INTERCEPTIONS</span></p>}
        </div>
        <span className="rank">{String(rank).padStart(2, '0')}</span>
      </div>
      <div className="stack">
        {[...layers].reverse().map((layer, reverseIndex) => {
          const index = layers.length - 1 - reverseIndex;
          const width = 17 + profile.widths[index] * 0.83;
          const height = 39 + profile.heights[index] * 0.23;
          const splitTotal = (layer.split?.primary ?? 0) + (layer.split?.secondary ?? 0);
          const splitPercent = splitTotal > 0 ? ((layer.split?.primary ?? 0) / splitTotal) * 100 : 100;
          const tierClass = `tier tier-${reverseIndex}${layer.split ? ' split-tier' : ''}${layer.receivingOnly ? ' receiving-tier' : ''}`;
          return (
            <div className="tier-wrap" key={layer.label}>
              <span className="rate-label">{layer.rate}</span>
              <div
                className={tierClass}
                title={layer.split?.description ?? `${layer.label}: ${layer.value}`}
                style={{ width: `${width}%`, height: `${height}px`, '--split': `${splitPercent}%` } as React.CSSProperties}
              >
                <span>{layer.label}</span><strong>{layer.value}</strong>
              </div>
            </div>
          );
        })}
      </div>
      <div className="card-footer">
        <span>STACK {integer.format(profile.stackScore)}</span>
        <button className="pin-button" aria-pressed={pinned} onClick={onTogglePin}>
          {pinned ? 'Selected ✓' : 'Add to compare +'}
        </button>
      </div>
    </article>
  );
}

export default function FantasyStacksApp({ dataset }: { dataset: Dataset }) {
  const rankedEcrCeiling = Math.ceil(Math.max(1, ...dataset.players.map((player) => player.ecr ?? 0)) / 25) * 25;
  const ecrUnrankedSentinel = rankedEcrCeiling + 1;
  const [windowKey, setWindowKey] = useState<WindowKey>('thisYear');
  const [volumeMode, setVolumeMode] = useState<VolumeMode>('total');
  const [position, setPosition] = useState<PositionFilter>('RECEIVERS');
  const [team, setTeam] = useState('ALL');
  const [minGames, setMinGames] = useState(6);
  const [minTargets, setMinTargets] = useState(2);
  const [sortKey, setSortKey] = useState<SortKey>('ppr');
  const [pinned, setPinned] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [density, setDensity] = useState(3);
  const [minEcr, setMinEcr] = useState(1);
  const [maxEcr, setMaxEcr] = useState(ecrUnrankedSentinel);
  const [shown, setShown] = useState(9);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const teams = useMemo(() => [...new Set(dataset.playerGames.map((game) => game.team))].sort(), [dataset]);
  const profiles = useMemo(
    () => aggregateProfiles(dataset, windowKey, position, team, minGames, minTargets, minEcr, Math.min(maxEcr, rankedEcrCeiling), maxEcr === ecrUnrankedSentinel, volumeMode, sortKey),
    [dataset, windowKey, position, team, minGames, minTargets, minEcr, maxEcr, rankedEcrCeiling, ecrUnrankedSentinel, volumeMode, sortKey],
  );
  const comparisonProfiles = useMemo(
    () => profiles.filter((profile) => pinned.includes(profile.playerId)),
    [profiles, pinned],
  );
  const displayProfiles = compareMode ? comparisonProfiles : profiles;
  const visibleProfiles = compareMode ? displayProfiles : displayProfiles.slice(0, shown);
  const sortGroups = position === 'QB' ? QB_SORT_GROUPS : position === 'FLEX' ? FLEX_SORT_GROUPS : position === 'RB' ? RB_SORT_GROUPS : RECEIVER_SORT_GROUPS;
  const usageOptions = position === 'QB' ? [0, 5, 10, 15, 20, 25, 30, 35, 40, 45] : position === 'RB' || position === 'FLEX' ? [0, 2, 4, 6, 8, 10, 12, 15, 20] : [0, 1, 2, 3, 4, 5, 6];

  const changeWindow = (next: WindowKey) => {
    setWindowKey(next);
    setMinGames(minimumGamesForWindow(next));
    setShown(density * 3);
  };
  const changePosition = (next: PositionFilter) => {
    setPosition(next);
    setMinTargets(2);
    setSortKey('ppr');
    setPinned([]);
    setCompareMode(false);
    setShown(density * 3);
  };
  const togglePin = (playerId: string) => {
    const next = pinned.includes(playerId)
      ? pinned.filter((id) => id !== playerId)
      : [...pinned, playerId];
    setPinned(next);
    if (!next.length) setCompareMode(false);
  };

  return (
    <main>
      <nav className="topbar">
        <a className="brand" href="#top" aria-label="FantasyStacks home"><BrandMark /><span>FANTASY<span>STACKS</span></span></a>
        <div className="season-label">{windowKey === 'lastYear' ? dataset.manifest.season - 1 : dataset.manifest.season} REGULAR SEASON</div>
        <button className="about-button" onClick={() => setGuideOpen(true)}>How to read this</button>
      </nav>

      <section className="hero" id="top">
        <div><p className="eyebrow">OPPORTUNITY → PRODUCTION</p><h1>Cut through noisy fantasy points-per-game metrics.</h1></div>
        <p className="hero-copy">Find the durable opportunity underpinning predictable performance.</p>
      </section>

      <section className="control-deck" aria-label="Analysis controls">
        <div className="control-group">
          <span className="control-label">WINDOW</span>
          <div className="segmented">
            {(Object.keys(WINDOW_LABELS) as WindowKey[]).map((key) => (
              <button key={key} className={windowKey === key ? 'active' : ''} onClick={() => changeWindow(key)}>{WINDOW_LABELS[key]}</button>
            ))}
          </div>
        </div>
        <div className="control-group normalization-group">
          <span className="control-label">NORMALIZE</span>
          <div className="segmented compact">
            {(['total', 'perGame'] as const).map((value) => (
              <button key={value} className={volumeMode === value ? 'active' : ''} onClick={() => { setVolumeMode(value); setShown(density * 3); }}>
                {value === 'total' ? 'Total' : 'Per game'}
              </button>
            ))}
          </div>
        </div>
        <div className="control-group position-group">
          <span className="control-label">POSITION</span>
          <div className="segmented compact">
            {(['FLEX', 'RECEIVERS', 'WR', 'TE', 'RB', 'QB'] as const).map((value) => (
              <button key={value} className={position === value ? 'active' : ''} onClick={() => changePosition(value)} title={value === 'FLEX' ? 'Running backs, wide receivers, and tight ends' : undefined}>
                {value === 'RECEIVERS' ? 'WR + TE' : value}
              </button>
            ))}
          </div>
        </div>
        <button className={`filter-toggle${filtersOpen ? ' active' : ''}`} onClick={() => setFiltersOpen(!filtersOpen)}>
          Filters <span>{filtersOpen ? '−' : '+'}</span>
        </button>
        <div className="results-count"><strong>{profiles.length}</strong><span>QUALIFIED<br />PLAYERS</span></div>
      </section>

      {filtersOpen && (
        <section className="filter-panel" aria-label="Minimum qualification filters">
          <label>TEAM<select value={team} onChange={(event) => setTeam(event.target.value)}><option value="ALL">All teams</option>{teams.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>MIN. GAMES<select value={minGames} onChange={(event) => setMinGames(Number(event.target.value))}>{[1, 2, 3, 4, 6, 8, 10, 12].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>MIN. {position === 'QB' ? 'PASSES' : position === 'RB' || position === 'FLEX' ? 'OPPORTUNITIES' : 'TARGETS'} / GAME<select value={minTargets} onChange={(event) => setMinTargets(Number(event.target.value))}>{usageOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <button onClick={() => { setTeam('ALL'); setMinGames(minimumGamesForWindow(windowKey)); setMinTargets(2); }}>Reset filters</button>
        </section>
      )}

      {pinned.length > 0 && (
        <section className="compare-bar">
          <div><span>COMPARISON SET</span><strong>{pinned.length} selected</strong></div>
          <div className="compare-names">{pinned.map((id) => dataset.players.find((player) => player.playerId === id)?.name).filter(Boolean).map((name) => <span key={name}>{name}</span>)}</div>
          <div className="compare-actions">
            <button className="compare-button" onClick={() => { setCompareMode((current) => !current); setShown(Math.max(density * 3, pinned.length)); }}>
              {compareMode ? 'Show all stacks' : `Compare ${pinned.length}`}
            </button>
            <button onClick={() => { setPinned([]); setCompareMode(false); }}>Clear</button>
          </div>
        </section>
      )}

      <section className="results-head">
        <p>{compareMode ? `COMPARISON · ${displayProfiles.length} STACKS` : `PRODUCTION PROFILES · ${WINDOW_LABELS[windowKey].toUpperCase()}`}</p>
        <div className="results-tools">
          <label className="ecr-label">
            <span>FP ECR RANGE <output>{integer.format(minEcr)}–{maxEcr === ecrUnrankedSentinel ? 'NR' : integer.format(maxEcr)}</output></span>
            <span
              className="ecr-range"
              style={{
                '--ecr-start': `${((minEcr - 1) / (ecrUnrankedSentinel - 1)) * 100}%`,
                '--ecr-end': `${((maxEcr - 1) / (ecrUnrankedSentinel - 1)) * 100}%`,
              } as React.CSSProperties}
            >
              <input
                type="range"
                min="1"
                max={ecrUnrankedSentinel}
                step="1"
                value={minEcr}
                aria-label="Minimum FantasyPros ECR"
                onChange={(event) => { setMinEcr(Math.min(Number(event.target.value), maxEcr - 1)); setShown(density * 3); }}
              />
              <input
                type="range"
                min="1"
                max={ecrUnrankedSentinel}
                step="1"
                value={maxEcr}
                aria-label="Maximum FantasyPros ECR; maximum includes unranked players"
                onChange={(event) => { setMaxEcr(Math.max(Number(event.target.value), minEcr + 1)); setShown(density * 3); }}
              />
            </span>
          </label>
          <label className="density-label" htmlFor="density">DENSITY
            <span className="density-input">
              <input
                id="density"
                type="range"
                min="3"
                max="12"
                step="1"
                value={density}
                aria-valuetext={`${density} stacks per row`}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setDensity(next);
                  setShown(next * 3);
                }}
              />
              <output htmlFor="density">{density} / ROW</output>
            </span>
          </label>
          <label className="sort-label">SORT
            <select value={sortKey} onChange={(event) => { setSortKey(event.target.value as SortKey); setShown(density * 3); }}>
              {sortGroups.map((group) => (
                <optgroup label={group.label} key={group.label}>
                  {group.keys.map((key) => <option value={key} key={key}>{SORT_LABELS[key]}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
      </section>

      {displayProfiles.length ? (
        <>
          <section className="player-grid" data-density={density} style={{ '--density': density } as React.CSSProperties}>
            {visibleProfiles.map((profile) => (
              <PlayerStack key={profile.playerId} profile={profile} rank={profiles.findIndex((item) => item.playerId === profile.playerId) + 1} pinned={pinned.includes(profile.playerId)} volumeMode={volumeMode} onTogglePin={() => togglePin(profile.playerId)} />
            ))}
          </section>
          {!compareMode && shown < displayProfiles.length && <button className="load-more" onClick={() => setShown((current) => current + density * 3)}>Show 3 more rows <span>↓</span></button>}
        </>
      ) : (
        <section className="empty-state"><strong>{compareMode ? 'No selected stacks in this view.' : 'No qualified players.'}</strong><p>{compareMode ? 'Show all stacks or loosen the filters to restore the comparison.' : 'Loosen the minimum games or usage filter to widen the field.'}</p></section>
      )}

      <footer>
        <span>ALPHA · {dataset.manifest.seasons.join('–')} DATA · {dataset.manifest.provider.name.toUpperCase()}</span>
        <p>Width = peer-relative volume. Height = transition efficiency. <a href="https://nflverse.nflverse.com/" target="_blank" rel="noreferrer">Data via nflverse ↗</a></p>
      </footer>

      {guideOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setGuideOpen(false)}>
          <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" aria-label="Close guide" onClick={() => setGuideOpen(false)}>×</button>
            <p className="eyebrow">THE VISUAL GRAMMAR</p><h2 id="guide-title">Read the shape,<br />not just the total.</h2>
            <div className="guide-grid">
              <div><strong>WIDTH</strong><p>How much volume a player produced compared with the currently qualified peer group.</p></div>
              <div><strong>HEIGHT</strong><p>How efficiently one stage converted into the next. Taller layers indicate a stronger rate.</p></div>
              <div><strong>BULGES</strong><p>Useful signal, not a flaw. A wide yardage tier above modest catches identifies explosive production.</p></div>
              <div><strong>RB COLOR</strong><p>Team color shows rushing touches and production. The highlight color shows targets and receiving production.</p></div>
              <div><strong>QB COLOR</strong><p>The split loss layer separates sacks in team color from interceptions in the highlight color. Its height rewards clean dropbacks.</p></div>
              <div><strong>FP ECR RANGE</strong><p>Limits the field to the current FantasyPros redraft consensus range. The upper NR endpoint retains players without a current ranking.</p></div>
              <div><strong>NORMALIZE</strong><p>Total compares accumulated volume. Per game normalizes layer values, widths, PPR, and volume sorting for every selected time window.</p></div>
              <div><strong>LABELS</strong><p>The unnormalized truth: raw totals and the exact rate that controls each layer’s height.</p></div>
            </div>
            <button className="modal-done" onClick={() => setGuideOpen(false)}>Explore the stacks</button>
          </section>
        </div>
      )}
    </main>
  );
}
