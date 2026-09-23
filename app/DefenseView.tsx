'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { APP_BUILD } from '@/lib/app-config';
import { aggregateDefenses, DefenseProfile, DefenseSort } from '@/lib/defense-contract';
import { Dataset, PositionFilter, TEAM_COLORS, TEAM_LOGOS, VolumeMode, WindowKey } from '@/lib/data-contract';
import { BrandMark, periodLabel, PositionToggle, TeamPicker, windowLabel } from './StackChrome';
import VolumeModeToggle from './VolumeModeToggle';

type GeometryMode = 'trapezoid' | 'block';
type ColorMode = 'origional' | 'flow';
type ThemeMode = 'light' | 'dark';
type DefenseLayer = { label: string; value: string; rate?: string; colorClass: string; detail?: string };

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const sorts: Array<{ key: DefenseSort; label: string }> = [
  { key: 'fantasyPoints', label: 'Fantasy points' },
  { key: 'opponentPoints', label: 'Fewest points / game' },
  { key: 'opponentYards', label: 'Fewest yards / play' },
  { key: 'opponentPlays', label: 'Opponent plays' },
  { key: 'sacks', label: 'Sacks' },
  { key: 'interceptions', label: 'Interceptions' },
  { key: 'fumbleRecoveries', label: 'Fumble recoveries' },
  { key: 'touchdowns', label: 'Defensive + return TDs' },
];

function DefenseCard({ profile, rank, volumeMode, geometry }: {
  profile: DefenseProfile;
  rank: number;
  volumeMode: VolumeMode;
  geometry: GeometryMode;
}) {
  const stackRef = useRef<HTMLDivElement>(null);
  const perGame = volumeMode === 'perGame';
  const display = (value: number) => perGame ? decimal.format(value / profile.games) : integer.format(value);
  const touchdownCount = profile.defensiveTouchdowns + profile.specialTeamsTouchdowns;
  const impactDetail = `${profile.sacks} sacks · ${profile.interceptions} INT · ${profile.fumbleRecoveries} FR · ${touchdownCount} TD`;
  const layers: DefenseLayer[] = [
    { label: 'Opponent plays', value: display(profile.opponentPlays), colorClass: 'flow-team', detail: 'Exposure; more is not necessarily better' },
    { label: 'Opponent yards', value: display(profile.opponentYards), rate: `${decimal.format(profile.yardsPerPlay)} yards / play`, colorClass: 'flow-yards', detail: 'Lower is better' },
    { label: 'Opponent points', value: display(profile.opponentPoints), rate: `${decimal.format(profile.pointsPerGame)} points / game`, colorClass: 'flow-td', detail: 'Lower is better' },
    { label: 'Impact plays', value: display(profile.impactPlays), rate: `${decimal.format(profile.impactPlays / profile.games)} impact / game`, colorClass: 'flow-negative', detail: impactDetail },
    { label: 'Fantasy pts', value: display(profile.fantasyPoints), colorClass: 'flow-fantasy', detail: 'Transparent D/ST baseline' },
  ];
  const color = TEAM_COLORS[profile.team] ?? '#6e777a';
  const logo = TEAM_LOGOS[profile.team];

  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;
    let active = true;
    const fit = () => {
      if (!active) return;
      for (const rate of stack.querySelectorAll<HTMLElement>('.rate-label')) {
        rate.dataset.compact = 'false';
        rate.dataset.compact = String(rate.getBoundingClientRect().width > stack.clientWidth - 4);
      }
      for (const tier of stack.querySelectorAll<HTMLElement>('.tier')) {
        const tierLabel = tier.querySelector<HTMLElement>('.tier-label')!;
        const tierRank = tier.querySelector<HTMLElement>('.tier-rank')!;
        const value = tier.querySelector<HTMLElement>('strong')!;
        tier.dataset.fit = 'full';
        tier.style.removeProperty('--fitted-value-size');
        const style = getComputedStyle(tier);
        const room = tier.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const gap = parseFloat(style.columnGap) || 0;
        const valueWidth = value.getBoundingClientRect().width;
        if (tierRank.scrollWidth + tierLabel.scrollWidth + valueWidth + gap * 2 + 4 > room) {
          tier.dataset.fit = tierRank.scrollWidth + valueWidth + gap + 4 <= room ? 'compact' : 'value';
        }
        if (tier.dataset.fit === 'value' && valueWidth > room) {
          tier.style.setProperty('--fitted-value-size', `${Math.max(1, parseFloat(getComputedStyle(value).fontSize) * Math.max(1, room) / valueWidth)}px`);
        }
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(stack);
    stack.querySelectorAll('.tier').forEach((tier) => observer.observe(tier));
    fit();
    void document.fonts.ready.then(fit);
    return () => { active = false; observer.disconnect(); };
  }, [profile, volumeMode, geometry]);

  return (
    <article className="player-card defense-card" style={{ '--accent': color } as React.CSSProperties}>
      <div className="player-heading">
        <div className="player-details">
          <p className="player-meta">
            <span className="team-identity">
              {logo && <Image className="team-logo" src={logo} alt="" width={28} height={28} loading="lazy" unoptimized />}
              <strong>{profile.team}</strong>
            </span>
            <span aria-hidden="true">·</span><span>DEF</span><span aria-hidden="true">·</span><span>{profile.games} {profile.games === 1 ? 'GAME' : 'GAMES'}</span>
          </p>
          <div className="player-name-row"><h2 title={`${profile.team} defense`}>{profile.team} defense</h2></div>
          <p className="role-legend"><span className="def-pressure-key">PRESSURE</span><span className="def-takeaway-key">TAKEAWAYS</span><span className="def-score-key">SCORES</span></p>
        </div>
        <span className="rank">{String(rank).padStart(2, '0')}</span>
      </div>
      <div className="stack" ref={stackRef}>
        {[...layers].reverse().map((layer, reverseIndex) => {
          const index = layers.length - 1 - reverseIndex;
          const width = geometry === 'block' ? profile.widths[index] : 17 + profile.widths[index] * 0.83;
          const layerRank = profile.ranks[index];
          const efficiency = layerRank.total < 2 ? 100 : (layerRank.total - layerRank.rank) / (layerRank.total - 1) * 100;
          const height = layer.rate ? 39 + efficiency * 0.23 : 46;
          const title = `${layer.label}: ${layer.value} · Rank ${layerRank.rank}/${layerRank.total}${layer.rate ? ` · ${layer.rate}` : ''}${layer.detail ? ` · ${layer.detail}` : ''}`;
          return (
            <div className="tier-wrap" key={layer.label}>
              {layer.rate && <span className="rate-label" title={layer.rate} aria-label={layer.rate}><span>{layer.rate.split(' ')[0]}</span><span className="rate-description"> {layer.rate.split(' ').slice(1).join(' ')}</span></span>}
              <div
                className={`tier tier-${reverseIndex} ${layer.colorClass}`}
                title={title}
                aria-label={`${layer.label}: ${layer.value}, rank ${layerRank.rank} out of ${layerRank.total}`}
                style={{ width: `${width}%`, height: `${height}px`, paddingInline: `max(2px, ${width * 0.06}%)` }}
              >
                <span className="tier-rank" aria-label={`Rank ${layerRank.rank} out of ${layerRank.total}`}>{layerRank.rank}/{layerRank.total}</span>
                <span className="tier-label">{layer.label}</span>
                <strong>{layer.value}</strong>
              </div>
            </div>
          );
        })}
      </div>
      <div className="card-footer defense-card-footer"><span>{impactDetail}</span></div>
    </article>
  );
}

export default function DefenseView({ dataset, themeMode, onToggleTheme, onPositionChange }: {
  dataset: Dataset;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onPositionChange: (position: PositionFilter) => void;
}) {
  const [windowKey, setWindowKey] = useState<WindowKey>('thisYear');
  const [volumeMode, setVolumeMode] = useState<VolumeMode>('total');
  const [geometry, setGeometry] = useState<GeometryMode>('trapezoid');
  const [colorMode, setColorMode] = useState<ColorMode>('origional');
  const [density, setDensity] = useState(8);
  const [team, setTeam] = useState('ALL');
  const [minGames, setMinGames] = useState(1);
  const [sort, setSort] = useState<DefenseSort>('fantasyPoints');
  const [descending, setDescending] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [shown, setShown] = useState(24);
  const weeks = useMemo(() => [...new Set(dataset.defenseGames
    .filter((game) => game.season === dataset.manifest.season)
    .map((game) => game.week))].sort((a, b) => a - b), [dataset]);
  const options: WindowKey[] = [...weeks.map((week): WindowKey => `week:${week}`), 'thisYear', 'lastYear'];
  const teams = useMemo(() => [...new Set(dataset.defenseGames.map((game) => game.team))].sort(), [dataset]);
  const ranked = useMemo(() => {
    const profiles = aggregateDefenses(dataset, windowKey, team, minGames, volumeMode, sort);
    return descending ? profiles : [...profiles].reverse();
  }, [dataset, windowKey, team, minGames, volumeMode, sort, descending]);
  const visible = ranked.slice(0, shown);
  const resetShown = () => setShown(density * 3);
  const changeWindow = (next: WindowKey) => { setWindowKey(next); setMinGames(1); resetShown(); };

  return (
    <main className="def-view">
      <nav className="topbar">
        <a className="brand" href="#top" aria-label="FantasyStacks home"><BrandMark /><span>FANTASY<span>STACKS</span></span></a>
        <div className="season-label">{periodLabel(windowKey, dataset.manifest.season, dataset.manifest.currentSeasonThroughWeek)}</div>
        <div className="topbar-actions">
          <button className="theme-button" type="button" aria-pressed={themeMode === 'dark'} onClick={onToggleTheme}>{themeMode === 'dark' ? 'Light mode' : 'Dark mode'}</button>
          <button className="about-button" type="button" onClick={() => setGuideOpen(true)}>How to read this</button>
        </div>
      </nav>

      <section className="hero" id="top">
        <div><p className="eyebrow">PRESSURE → PREVENTION → PRODUCTION</p><h1>See the pressure behind the points.</h1></div>
        <p className="hero-copy">Compare opponent exposure, suppression, impact plays, and the fantasy result for every team defense.</p>
      </section>

      <section className="control-deck defense-control-deck" aria-label="Defense stack view controls">
        <div className="control-group window-group"><span className="control-label">WINDOW</span><div className="segmented">{options.map((key) => <button type="button" key={key} className={windowKey === key ? 'active' : ''} onClick={() => changeWindow(key)}>{windowLabel(key, dataset.manifest.season, dataset.manifest.currentSeasonThroughWeek)}</button>)}</div></div>
        <div className="control-group normalization-group"><span className="control-label">NORMALIZE</span><VolumeModeToggle value={volumeMode} onChange={(value) => { setVolumeMode(value); resetShown(); }} /></div>
        <div className="control-group density-group"><label className="density-label" htmlFor="defense-density"><span>DENSITY <output htmlFor="defense-density">{density} / ROW</output></span><span className="density-input"><input id="defense-density" type="range" min="3" max="12" step="1" value={density} aria-valuetext={`${density} stacks per row`} onChange={(event) => { const next = Number(event.target.value); setDensity(next); setShown(next * 3); }} /></span></label></div>
        <div className="control-group geometry-group"><div className="geometry-label"><span>GEOMETRY</span><div className="segmented geometry-toggle">{(['trapezoid', 'block'] as const).map((value) => <button type="button" key={value} className={geometry === value ? 'active' : ''} aria-pressed={geometry === value} onClick={() => { setGeometry(value); resetShown(); }}>{value === 'trapezoid' ? 'Trapezoid' : 'Block'}</button>)}</div></div></div>
        <div className="control-group color-group"><div className="color-label"><span>COLOR</span><div className="segmented color-toggle">{(['origional', 'flow'] as const).map((value) => <button type="button" key={value} className={colorMode === value ? 'active' : ''} aria-pressed={colorMode === value} onClick={() => setColorMode(value)}>{value === 'origional' ? 'Origional' : 'Flow'}</button>)}</div></div></div>
      </section>

      <section className="results-head" aria-label="Defense filters and sorting">
        <div className="results-summary"><p>DEFENSIVE PROFILES · {windowLabel(windowKey, dataset.manifest.season, dataset.manifest.currentSeasonThroughWeek).toUpperCase()}</p><div className="results-count"><strong>{ranked.length}</strong><span>VISIBLE<br />DEFENSES</span></div></div>
        <div className="results-tools">
          <div className="team-label"><span>TEAM</span><TeamPicker team={team} teams={teams} onChange={(value) => { setTeam(value); resetShown(); }} /></div>
          <div className="position-label"><span>POSITION</span><PositionToggle position="DEF" onChange={onPositionChange} /></div>
          <div className="sort-label"><span>SORT</span><div className="sort-input"><select aria-label="Sort metric" value={sort} onChange={(event) => { setSort(event.target.value as DefenseSort); resetShown(); }}>{sorts.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select><button type="button" className="sort-direction" aria-label="Reverse sort order" title="Reverse sort order" onClick={() => { setDescending((current) => !current); resetShown(); }}><span aria-hidden="true">{descending ? '↓' : '↑'}</span></button></div></div>
          <button className={`filter-toggle${filtersOpen ? ' active' : ''}`} type="button" onClick={() => setFiltersOpen((current) => !current)}>Filters <span>{filtersOpen ? '−' : '+'}</span></button>
        </div>
      </section>

      {filtersOpen && <section className="filter-panel defense-filter-panel" aria-label="Minimum qualification filters"><label>MIN. GAMES<select value={minGames} onChange={(event) => { setMinGames(Number(event.target.value)); resetShown(); }}>{[1, 2, 3, 4, 6, 8, 10, 12].map((count) => <option key={count} value={count}>{count}</option>)}</select></label><button type="button" onClick={() => { setTeam('ALL'); setMinGames(1); setSort('fantasyPoints'); setDescending(true); resetShown(); }}>Reset filters</button></section>}

      {visible.length > 0 ? <section className="player-grid defense-grid" aria-label="Defense stacks" data-density={density} data-geometry={geometry} data-color={colorMode} style={{ '--density': density } as React.CSSProperties}>{visible.map((profile, index) => <DefenseCard key={profile.team} profile={profile} rank={index + 1} volumeMode={volumeMode} geometry={geometry} />)}</section> : <section className="empty-state"><strong>No qualified defenses.</strong><p>Try a lower minimum games setting or another team.</p></section>}
      {shown < ranked.length && <button className="load-more" type="button" onClick={() => setShown((count) => count + density * 3)}>Show 3 more rows <span>↓</span></button>}

      <footer><p className="footer-blurb">Get the fantasy football decision support data that you need without navigating across 20 pages and seven different websites.</p><span>ALPHA · BUILD {APP_BUILD} · {dataset.manifest.seasons.join('–')} DATA · {dataset.manifest.provider.name.toUpperCase()}</span><p>Width = peer-relative performance. Height and bubbles = transition efficiency. <a href="https://nflverse.nflverse.com/" target="_blank" rel="noreferrer">Data via nflverse ↗</a></p></footer>

      {guideOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setGuideOpen(false)}><section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="defense-guide-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" aria-label="Close guide" onClick={() => setGuideOpen(false)}>×</button><p className="eyebrow">THE VISUAL GRAMMAR</p><h2 id="defense-guide-title">Read the shape,<br />not just the total.</h2><div className="guide-grid"><div><strong>WIDTH</strong><p>How strongly each layer ranks against the currently qualified defenses. For opponent yards and points, lower rates rank wider.</p></div><div><strong>HEIGHT</strong><p>How efficiently a defense moves through rate-based transitions. Taller layers indicate a stronger peer-relative rate.</p></div><div><strong>BUBBLES</strong><p>The rate connecting one layer to the next: yards per play, points per game, and impact plays per game.</p></div><div><strong>IMPACT PLAYS</strong><p>Sacks, interceptions, fumble recoveries, and defensive or return touchdowns. Hover a layer for the exact breakdown.</p></div><div><strong>FANTASY POINTS</strong><p>A transparent comparison baseline, not an official ESPN, Yahoo, or Sleeper league score.</p></div><div><strong>SCORING</strong><p>1 per sack; 2 per interception, fumble recovery, or safety; 6 per defensive or special-teams TD; plus the standard points-allowed bracket.</p></div></div><button className="modal-done" type="button" onClick={() => setGuideOpen(false)}>Explore the stacks</button></section></div>}
    </main>
  );
}
