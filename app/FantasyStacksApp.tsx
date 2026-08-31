'use client';

import { useMemo, useState } from 'react';
import {
  aggregateProfiles,
  Dataset,
  Position,
  Profile,
  SortKey,
  TEAM_COLORS,
  WindowKey,
} from '@/lib/data-contract';

const WINDOW_LABELS: Record<WindowKey, string> = {
  week18: 'Week 18', last3: 'Last 3', last5: 'Last 5', season: 'Full season',
};
const SORT_LABELS: Record<SortKey, string> = {
  ppr: 'PPR points',
  stackScore: 'Stack score',
  possessions: 'Team possessions',
  teamPlays: 'Team plays',
  snaps: 'Offensive snaps',
  targets: 'Targets',
  receptions: 'Catches',
  yards: 'Receiving yards',
  touchdowns: 'Receiving TDs',
  possessionPerGame: 'Possessions / game',
  playsPerPossession: 'Plays / possession',
  snapShare: 'Snap share',
  targetsPerSnap: 'Targets / snap',
  catchRate: 'Catch rate',
  yardsPerCatch: 'Yards / catch',
  touchdownsPerCatch: 'TDs / catch',
};
const SORT_GROUPS: Array<{ label: string; keys: SortKey[] }> = [
  { label: 'Overview', keys: ['ppr', 'stackScore'] },
  { label: 'Stack layers · volume', keys: ['possessions', 'teamPlays', 'snaps', 'targets', 'receptions', 'yards', 'touchdowns'] },
  { label: 'Transitions · efficiency', keys: ['possessionPerGame', 'playsPerPossession', 'snapShare', 'targetsPerSnap', 'catchRate', 'yardsPerCatch', 'touchdownsPerCatch'] },
];

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = (value: number) => `${decimal.format(value * 100)}%`;

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>;
}

function PlayerStack({
  profile,
  rank,
  pinned,
  onTogglePin,
}: {
  profile: Profile;
  rank: number;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const layers = [
    { label: 'Possessions', value: integer.format(profile.possessions), rate: `${decimal.format(profile.possessionPerGame)} / game` },
    { label: 'Team plays', value: integer.format(profile.teamPlays), rate: `${decimal.format(profile.playsPerPossession)} / possession` },
    { label: 'Snaps', value: integer.format(profile.snaps), rate: `${percent(profile.snapShare)} snap share` },
    { label: 'Targets', value: integer.format(profile.targets), rate: `${percent(profile.targetsPerSnap)} / snap` },
    { label: 'Catches', value: integer.format(profile.receptions), rate: `${percent(profile.catchRate)} caught` },
    { label: 'Yards', value: integer.format(profile.yards), rate: `${decimal.format(profile.yardsPerCatch)} / catch` },
    { label: 'TD', value: integer.format(profile.touchdowns), rate: `${percent(profile.touchdownsPerCatch)} / catch` },
  ];
  const color = TEAM_COLORS[profile.team] ?? '#6e777a';
  return (
    <article className={`player-card${pinned ? ' pinned' : ''}`}>
      <div className="player-heading">
        <div>
          <p className="player-meta">{profile.team} &nbsp;·&nbsp; {profile.position} &nbsp;·&nbsp; {profile.games} GAMES</p>
          <h2>{profile.name}</h2>
          <p className="ppr-line"><strong>{decimal.format(profile.ppr)}</strong> PPR &nbsp; <span>{decimal.format(profile.ppr / profile.games)} / game</span></p>
        </div>
        <span className="rank">{String(rank).padStart(2, '0')}</span>
      </div>
      <div className="stack" style={{ '--accent': color } as React.CSSProperties}>
        {[...layers].reverse().map((layer, reverseIndex) => {
          const index = layers.length - 1 - reverseIndex;
          const width = 34 + profile.widths[index] * 0.66;
          const height = 39 + profile.heights[index] * 0.23;
          return (
            <div className="tier-wrap" key={layer.label}>
              <span className="rate-label">{layer.rate}</span>
              <div className={`tier tier-${reverseIndex}`} style={{ width: `${width}%`, height: `${height}px` }}>
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
  const [windowKey, setWindowKey] = useState<WindowKey>('season');
  const [position, setPosition] = useState<'ALL' | Position>('ALL');
  const [team, setTeam] = useState('ALL');
  const [minGames, setMinGames] = useState(6);
  const [minTargets, setMinTargets] = useState(2);
  const [sortKey, setSortKey] = useState<SortKey>('ppr');
  const [pinned, setPinned] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [shown, setShown] = useState(9);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const teams = useMemo(() => [...new Set(dataset.playerGames.map((game) => game.team))].sort(), [dataset]);
  const profiles = useMemo(
    () => aggregateProfiles(dataset, windowKey, position, team, minGames, minTargets, sortKey),
    [dataset, windowKey, position, team, minGames, minTargets, sortKey],
  );
  const comparisonProfiles = useMemo(
    () => profiles.filter((profile) => pinned.includes(profile.playerId)),
    [profiles, pinned],
  );
  const displayProfiles = compareMode ? comparisonProfiles : profiles;
  const visibleProfiles = compareMode ? displayProfiles : displayProfiles.slice(0, shown);

  const changeWindow = (next: WindowKey) => {
    setWindowKey(next);
    setMinGames(next === 'season' ? 6 : next === 'last5' ? 3 : next === 'last3' ? 2 : 1);
    setShown(9);
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
        <div className="season-label">{dataset.manifest.season} REGULAR SEASON</div>
        <button className="about-button" onClick={() => setGuideOpen(true)}>How to read this</button>
      </nav>

      <section className="hero" id="top">
        <div><p className="eyebrow">OPPORTUNITY → PRODUCTION</p><h1>See the whole<br />receiver.</h1></div>
        <p className="hero-copy">Every layer reveals where volume becomes value. Compare the complete path from team opportunity to the end zone.</p>
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
        <div className="control-group position-group">
          <span className="control-label">POSITION</span>
          <div className="segmented compact">
            {(['ALL', 'WR', 'TE'] as const).map((value) => (
              <button key={value} className={position === value ? 'active' : ''} onClick={() => { setPosition(value); setShown(9); }}>
                {value === 'ALL' ? 'WR + TE' : value}
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
          <label>MIN. TARGETS / GAME<select value={minTargets} onChange={(event) => setMinTargets(Number(event.target.value))}>{[0, 1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <button onClick={() => { setTeam('ALL'); setMinGames(windowKey === 'season' ? 6 : 1); setMinTargets(2); }}>Reset filters</button>
        </section>
      )}

      {pinned.length > 0 && (
        <section className="compare-bar">
          <div><span>COMPARISON SET</span><strong>{pinned.length} selected</strong></div>
          <div className="compare-names">{pinned.map((id) => dataset.players.find((player) => player.playerId === id)?.name).filter(Boolean).map((name) => <span key={name}>{name}</span>)}</div>
          <div className="compare-actions">
            <button className="compare-button" onClick={() => { setCompareMode((current) => !current); setShown(Math.max(9, pinned.length)); }}>
              {compareMode ? 'Show all stacks' : `Compare ${pinned.length}`}
            </button>
            <button onClick={() => { setPinned([]); setCompareMode(false); }}>Clear</button>
          </div>
        </section>
      )}

      <section className="results-head">
        <p>{compareMode ? `COMPARISON · ${displayProfiles.length} STACKS` : `PRODUCTION PROFILES · ${WINDOW_LABELS[windowKey].toUpperCase()}`}</p>
        <label className="sort-label">SORT
          <select value={sortKey} onChange={(event) => { setSortKey(event.target.value as SortKey); setShown(9); }}>
            {SORT_GROUPS.map((group) => (
              <optgroup label={group.label} key={group.label}>
                {group.keys.map((key) => <option value={key} key={key}>{SORT_LABELS[key]}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      </section>

      {displayProfiles.length ? (
        <>
          <section className="player-grid">
            {visibleProfiles.map((profile) => (
              <PlayerStack key={profile.playerId} profile={profile} rank={profiles.findIndex((item) => item.playerId === profile.playerId) + 1} pinned={pinned.includes(profile.playerId)} onTogglePin={() => togglePin(profile.playerId)} />
            ))}
          </section>
          {!compareMode && shown < displayProfiles.length && <button className="load-more" onClick={() => setShown((current) => current + 9)}>Show 9 more <span>↓</span></button>}
        </>
      ) : (
        <section className="empty-state"><strong>{compareMode ? 'No selected stacks in this view.' : 'No qualified receivers.'}</strong><p>{compareMode ? 'Show all stacks or loosen the filters to restore the comparison.' : 'Loosen the minimum games or targets filter to widen the field.'}</p></section>
      )}

      <footer>
        <span>ALPHA · {dataset.manifest.season} DATA · {dataset.manifest.provider.name.toUpperCase()}</span>
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
              <div><strong>LABELS</strong><p>The unnormalized truth: raw totals and the exact rate that controls each layer’s height.</p></div>
            </div>
            <button className="modal-done" onClick={() => setGuideOpen(false)}>Explore the stacks</button>
          </section>
        </div>
      )}
    </main>
  );
}
