import { execFileSync } from 'node:child_process';

/** Keep the displayed build tied to the source revision, not a hand-edited constant. */
export function resolveBuildNumber(): number {
  const supplied = process.env.FANTASY_STACKS_BUILD_NUMBER;
  if (supplied && /^[1-9]\d*$/.test(supplied) && Number.isSafeInteger(Number(supplied))) {
    return Number(supplied);
  }

  try {
    const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (shallow !== 'true') {
      const count = execFileSync('git', ['rev-list', '--count', 'HEAD'], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (/^[1-9]\d*$/.test(count) && Number.isSafeInteger(Number(count))) return Number(count);
    }
  } catch {
    // Source archives and some remote builders do not include Git metadata.
  }

  return Date.now();
}
