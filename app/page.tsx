import FantasyStacksApp from './FantasyStacksApp';
import { parseDataset } from '@/lib/data-contract';
import manifest from '@/public/data/v1/manifest.json';
import players from '@/public/data/v1/players.json';
import playerGames from '@/public/data/v1/player-games.json';
import teamGames from '@/public/data/v1/team-games.json';

export default function Home() {
  const dataset = parseDataset(manifest, players, playerGames, teamGames);
  return <FantasyStacksApp dataset={dataset} />;
}
