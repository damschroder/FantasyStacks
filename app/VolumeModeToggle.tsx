'use client';

import type { VolumeMode } from '@/lib/data-contract';

export default function VolumeModeToggle({
  value,
  onChange,
}: {
  value: VolumeMode;
  onChange: (value: VolumeMode) => void;
}) {
  const perGame = value === 'perGame';

  return (
    <div className="volume-mode-toggle">
      <span className={perGame ? '' : 'active'}>Total</span>
      <label className="volume-mode-switch">
        <input
          type="checkbox"
          role="switch"
          checked={perGame}
          aria-label="View stack data per game"
          onChange={(event) => onChange(event.target.checked ? 'perGame' : 'total')}
        />
        <span className="volume-mode-track" aria-hidden="true"><span /></span>
      </label>
      <span className={perGame ? 'active' : ''}>Per game</span>
    </div>
  );
}
