'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { aggregateDefenses, DefenseProfile, DefenseSort } from '@/lib/defense-contract';
import { Dataset, TEAM_COLORS, TEAM_LOGOS, VolumeMode, WindowKey } from '@/lib/data-contract';

type GeometryMode = 'trapezoid' | 'block';
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
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

function label(key: WindowKey, season: number, throughWeek: number) {
  if (key === 'thisYear') return `${season} through W${throughWeek}`;
  if (key === 'lastYear') return `${season - 1} full season`;
  return `Week ${key.slice(5)}`;
}

function periodLabel(key: WindowKey, season: number, throughWeek: number) {
  if (key === 'thisYear') return `${season} REGULAR SEASON · THROUGH WEEK ${throughWeek}`;
  if (key === 'lastYear') return `${season - 1} REGULAR SEASON · FULL`;
  return `${season} REGULAR SEASON · WEEK ${key.slice(5)}`;
}

function DefenseCard({ profile, rank, volumeMode, geometry }: {
  profile: DefenseProfile;
  rank: number;
  volumeMode: VolumeMode;
  geometry: GeometryMode;
}) {
  const display = (value: number) => volumeMode === 'perGame' ? decimal.format(value / profile.games) : integer.format(value);
  const touchdownCount = profile.defensiveTouchdowns + profile.specialTeamsTouchdowns;
  const layers = [
    { name: 'Opponent offensive plays', value: display(profile.opponentPlays), note: 'Exposure · more is not better', tone: 'exposure' },
    { name: 'Opponent yards', value: display(profile.opponentYards), note: `${decimal.format(profile.yardsPerPlay)} yards / play · lower is better`, tone: 'suppression' },
    { name: 'Opponent points', value: display(profile.opponentPoints), note: `${decimal.format(profile.pointsPerGame)} points / game · lower is better`, tone: 'suppression' },
    { name: 'Impact plays', value: display(profile.impactPlays), note: `${profile.sacks} sacks · ${profile.interceptions} INT · ${profile.fumbleRecoveries} FR · ${touchdownCount} TD${volumeMode === 'perGame' ? ' (totals)' : ''}`, tone: 'impact' },
    { name: 'Fantasy points', value: display(profile.fantasyPoints), note: 'Transparent D/ST baseline', tone: 'fantasy' },
  ];
  const logo = TEAM_LOGOS[profile.team];
  return (
    <article className="def-card" style={{ '--def-accent': TEAM_COLORS[profile.team] ?? '#67777c' } as React.CSSProperties}>
      <header className="def-card-head">
        <div className="def-identity">
          {logo && <Image src={logo} alt="" width={45} height={45} unoptimized />}
          <div><span>{profile.team} · DEF · {profile.games} {profile.games === 1 ? 'GAME' : 'GAMES'}</span><h2>{profile.team} defense</h2></div>
        </div>
        <span className="def-rank">{String(rank).padStart(2, '0')}</span>
      </header>
      <div className={`def-stack def-${geometry}`}>
        {[...layers].reverse().map((layer, reverseIndex) => {
          const index = layers.length - 1 - reverseIndex;
          return (
            <div className="def-layer-wrap" key={layer.name}>
              <div className={`def-layer def-${layer.tone}`} style={{ width: `${profile.widths[index]}%` }} title={`${layer.name}: ${layer.value}. ${layer.note}. Rank ${profile.ranks[index].rank} of ${profile.ranks[index].total}`}>
                <span className="def-layer-rank">{profile.ranks[index].rank}/{profile.ranks[index].total}</span>
                <span className="def-layer-name">{layer.name}</span>
                <strong>{layer.value}</strong>
              </div>
              <p>{layer.note}</p>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default function DefenseView({ dataset, onExit }: { dataset: Dataset; onExit: () => void }) {
  const [windowKey, setWindowKey] = useState<WindowKey>('thisYear');
  const [volumeMode, setVolumeMode] = useState<VolumeMode>('total');
  const [geometry, setGeometry] = useState<GeometryMode>('trapezoid');
  const [team, setTeam] = useState('ALL');
  const [minGames, setMinGames] = useState(1);
  const [sort, setSort] = useState<DefenseSort>('fantasyPoints');
  const [descending, setDescending] = useState(true);
  const [shown, setShown] = useState(32);
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
  const changeWindow = (next: WindowKey) => { setWindowKey(next); setMinGames(1); setShown(32); };

  return (
    <main className="def-view">
      <nav className="def-nav"><a href="#top" className="brand">FANTASY<span>STACKS</span></a><span>{periodLabel(windowKey, dataset.manifest.season, dataset.manifest.currentSeasonThroughWeek)}</span><button onClick={onExit}>Back to offense ↗</button></nav>
      <section className="def-hero" id="top"><p className="eyebrow">DEFENSE / SPECIAL TEAMS</p><h1>See the pressure behind the points.</h1><p>Opponent exposure, suppression, impact plays, and a transparent fantasy result for each team defense.</p></section>
      <section className="def-controls" aria-label="Defense stack controls">
        <div className="def-control-wide"><span>WINDOW</span><div className="segmented">{options.map((key) => <button key={key} className={windowKey === key ? 'active' : ''} onClick={() => changeWindow(key)}>{label(key, dataset.manifest.season, dataset.manifest.currentSeasonThroughWeek)}</button>)}</div></div>
        <div><span>NORMALIZE</span><div className="segmented">{(['total', 'perGame'] as const).map((mode) => <button key={mode} className={volumeMode === mode ? 'active' : ''} onClick={() => setVolumeMode(mode)}>{mode === 'total' ? 'Total' : 'Per game'}</button>)}</div></div>
        <div><span>GEOMETRY</span><div className="segmented">{(['trapezoid', 'block'] as const).map((mode) => <button key={mode} className={geometry === mode ? 'active' : ''} onClick={() => setGeometry(mode)}>{mode === 'block' ? 'Blocks' : 'Trapezoid'}</button>)}</div></div>
      </section>
      <section className="def-toolbar" aria-label="Defense filters and sorting">
        <div className="def-position"><span>POSITION</span><button aria-pressed="true">DEF</button><button onClick={onExit}>OFFENSE</button></div>
        <label>TEAM<select value={team} onChange={(event) => setTeam(event.target.value)}><option value="ALL">All teams</option>{teams.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
        <label>MIN. GAMES<select value={minGames} onChange={(event) => setMinGames(Number(event.target.value))}>{[1, 2, 3, 4, 6, 8, 10, 12].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
        <label>SORT<select value={sort} onChange={(event) => setSort(event.target.value as DefenseSort)}>{sorts.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        <button className="def-direction" onClick={() => setDescending((current) => !current)} aria-label="Reverse sort direction">{descending ? '↓' : '↑'}</button>
        <strong>{ranked.length} DEFENSES</strong>
      </section>
      <aside className="def-explainer"><strong>HOW TO READ THIS</strong><p>Wider opponent yards and points layers mean better suppression: their ranks use yards per play and points per game. Opponent plays are exposure, not a quality score. Impact plays combine sacks, interceptions, opponent fumble recoveries, and defensive or return touchdowns.</p><details><summary>Fantasy scoring and data definitions</summary><p>Per game: 1 point per sack; 2 per interception or opponent fumble recovery; 6 per defensive or special teams TD; 2 per safety. Opponent scoreboard points add 10 for a shutout, 7 for 1–6, 4 for 7–13, 1 for 14–20, 0 for 21–27, −1 for 28–34, or −4 for 35+. Scores are summed across games. This is a comparison baseline, not an ESPN, Yahoo, or Sleeper league score. Opponent points are the final scoreboard total, including any score by the opposing defense or special teams. Yards are net offensive yards (pass + rush + signed sack yards); plays are opponent offensive snap estimates.</p></details></aside>
      {visible.length > 0 ? <section className="def-grid" aria-label="Defense stacks">{visible.map((profile, index) => <DefenseCard key={profile.team} profile={profile} rank={index + 1} volumeMode={volumeMode} geometry={geometry} />)}</section> : <section className="empty-state"><strong>No qualified defenses.</strong><p>Try a lower minimum games setting or another team.</p></section>}
      {shown < ranked.length && <button className="load-more" onClick={() => setShown((count) => count + 32)}>Show more defenses ↓</button>}
      <footer><span>FANTASYSTACKS · NFLVERSE TEAM STATS AND SCHEDULES</span><p>DEF scoring is an explicitly defined comparison baseline.</p></footer>
    </main>
  );
}
