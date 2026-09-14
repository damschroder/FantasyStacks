import { readFileSync } from 'node:fs';
import { aggregateProfiles, parseDataset } from '../lib/data-contract.ts';
const read = name => JSON.parse(readFileSync(new URL(`../public/data/v1/${name}`, import.meta.url), 'utf8'));
const dataset = parseDataset(...['manifest.json','players.json','player-games.json','team-games.json'].map(read));
for (const position of ['ALL','RECEIVERS','QB','RB','WR','TE']) {
 const profiles=aggregateProfiles(dataset,'thisYear',position,'ALL',1,0,1,10000,true,'total','full','ppr');
 if(!profiles.length) throw Error(`Empty ${position}`);
 if(profiles.some(p=>p.games!==1||p.snaps<=0||[...p.widths,...p.heights,...p.blockWidths].some(v=>!Number.isFinite(v)))) throw Error(`Invalid ${position} geometry`);
 if(position==='ALL'&&profiles.length!==316) throw Error(`Unexpected count ${profiles.length}`);
 console.log(`${position}: ${profiles.length} valid Week 1 stacks`);
}
