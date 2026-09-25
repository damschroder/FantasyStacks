'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { DefenseProfile, DefenseSort } from '@/lib/defense-contract';
import { TEAM_COLORS, TEAM_LOGOS, VolumeMode } from '@/lib/data-contract';

type GeometryMode = 'trapezoid' | 'block';
type ColorMode = 'origional' | 'flow';
type DefenseLayer = { label: string; value: string; rate?: string; colorClass: string; detail?: string };

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const DEFENSE_SORT_OPTIONS: Array<{ key: DefenseSort; label: string }> = [
  { key: 'fantasyPoints', label: 'Fantasy points' },
  { key: 'opponentPoints', label: 'Fewest points / game' },
  { key: 'opponentYards', label: 'Fewest yards / play' },
  { key: 'opponentPlays', label: 'Opponent plays' },
  { key: 'sacks', label: 'Sacks' },
  { key: 'interceptions', label: 'Interceptions' },
  { key: 'fumbleRecoveries', label: 'Fumble recoveries' },
  { key: 'touchdowns', label: 'Defensive + return TDs' },
];

const teamDefenseName = (team: string) => `${team} Def`;

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
  const defenseName = teamDefenseName(profile.team);

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
          <div className="player-name-row"><h2 title={defenseName}>{defenseName}</h2></div>
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

export default function DefenseView({ profiles, shown, density, volumeMode, geometry, colorMode, onShowMore }: {
  profiles: DefenseProfile[];
  shown: number;
  density: number;
  volumeMode: VolumeMode;
  geometry: GeometryMode;
  colorMode: ColorMode;
  onShowMore: () => void;
}) {
  const visible = profiles.slice(0, shown);

  return (
    <>
      {visible.length > 0 ? (
        <section className="player-grid defense-grid" aria-label="Defense stacks" data-density={density} data-geometry={geometry} data-color={colorMode} style={{ '--density': density } as React.CSSProperties}>
          {visible.map((profile, index) => <DefenseCard key={profile.team} profile={profile} rank={index + 1} volumeMode={volumeMode} geometry={geometry} />)}
        </section>
      ) : (
        <section className="empty-state"><strong>No qualified defenses.</strong><p>Try a lower minimum games setting or another team.</p></section>
      )}
      {shown < profiles.length && <button className="load-more" type="button" onClick={onShowMore}>Show 3 more rows <span>↓</span></button>}
    </>
  );
}
