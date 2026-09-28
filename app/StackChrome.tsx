'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { PositionFilter, TEAM_LOGOS, WindowKey } from '@/lib/data-contract';

export const windowLabel = (windowKey: WindowKey, season: number, throughWeek: number) => {
  if (windowKey === 'thisYear') return `${season} through W${throughWeek}`;
  if (windowKey === 'lastYear') return `${season - 1} full season`;
  return `Week ${windowKey.slice('week:'.length)}`;
};

export const periodLabel = (
  windowKey: WindowKey,
  season: number,
  throughWeek: number,
  currentWeekGamesIncluded?: number,
  currentWeekGamesScheduled?: number,
) => {
  if (windowKey === 'thisYear') {
    const weekStatus = currentWeekGamesIncluded !== undefined && currentWeekGamesScheduled !== undefined
      ? ` · ${currentWeekGamesIncluded} OF ${currentWeekGamesScheduled} GAMES`
      : '';
    return `${season} REGULAR SEASON · THROUGH WEEK ${throughWeek}${weekStatus}`;
  }
  if (windowKey === 'lastYear') return `${season - 1} REGULAR SEASON · FULL`;
  return `${season} REGULAR SEASON · WEEK ${windowKey.slice('week:'.length)}`;
};

export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>;
}

export function PositionToggle({
  position,
  onChange,
}: {
  position: PositionFilter;
  onChange: (position: PositionFilter) => void;
}) {
  return (
    <div className="segmented position-toggle">
      {(['ALL', 'FLEX', 'RECEIVERS', 'WR', 'TE', 'RB', 'QB', 'DEF'] as const).map((value) => (
        <button
          type="button"
          key={value}
          className={position === value ? 'active' : ''}
          aria-pressed={position === value}
          onClick={() => onChange(value)}
          title={value === 'ALL' ? 'Quarterbacks, running backs, wide receivers, and tight ends' : value === 'FLEX' ? 'Running backs, wide receivers, and tight ends' : undefined}
        >
          {value === 'RECEIVERS' ? 'WR + TE' : value}
        </button>
      ))}
    </div>
  );
}

export function TeamPicker({
  team,
  teams,
  onChange,
}: {
  team: string;
  teams: string[];
  onChange: (team: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedLogo = TEAM_LOGOS[team];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const selectTeam = (nextTeam: string) => {
    onChange(nextTeam);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const teamIcon = (teamCode: string) => {
    const logo = TEAM_LOGOS[teamCode];
    return logo
      ? <Image className="team-picker-logo" src={logo} alt="" width={26} height={26} loading="lazy" unoptimized />
      : <span className="all-team-icon" aria-hidden="true">32</span>;
  };

  return (
    <div className="team-picker" ref={pickerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="team-picker-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="team-filter-menu"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="team-picker-value">
          {selectedLogo
            ? <Image className="team-picker-logo" src={selectedLogo} alt="" width={26} height={26} loading="lazy" unoptimized />
            : <span className="all-team-icon" aria-hidden="true">32</span>}
          <strong>{team}</strong>
        </span>
        <span className="team-picker-caret" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="team-picker-menu" id="team-filter-menu" role="menu" aria-label="Select an NFL team">
          <button type="button" role="menuitemradio" aria-checked={team === 'ALL'} className={team === 'ALL' ? 'selected' : ''} onClick={() => selectTeam('ALL')}>
            {teamIcon('ALL')}<strong>ALL</strong>
          </button>
          {teams.map((teamCode) => (
            <button type="button" role="menuitemradio" aria-checked={team === teamCode} className={team === teamCode ? 'selected' : ''} key={teamCode} onClick={() => selectTeam(teamCode)}>
              {teamIcon(teamCode)}<strong>{teamCode}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
