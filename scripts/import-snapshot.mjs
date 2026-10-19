import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {HistoricalSnapshotAdapter} from '../lib/server/market-data.ts';

const path=process.argv[2];
if(!path)throw new Error('Usage: node scripts/import-snapshot.mjs /absolute/path/to/reviewed-snapshot.json');
const input=JSON.parse(await readFile(path,'utf8'));
input.source.hash=createHash('sha256').update(JSON.stringify(input.candles)).digest('hex');
const snapshot=new HistoricalSnapshotAdapter().read(input);
const acceptedIds=['btc-pullback','eth-boundary','btc-announcement','eth-pullback','btc-boundary','eth-announcement'];
if(!acceptedIds.includes(snapshot.sceneId))throw new Error('Unknown scene ID.');
if(!snapshot.source.symbol.startsWith(snapshot.sceneId.startsWith('btc')?'BTC':'ETH'))throw new Error('Scene and symbol do not match.');
const registry=JSON.parse(await readFile('data/historical-snapshots.json','utf8'));
if(registry.some(s=>s.sceneId===snapshot.sceneId&&s.source.version===snapshot.source.version))throw new Error('Use a new immutable data version when replacing a snapshot.');
await writeFile('data/historical-snapshots.json',JSON.stringify([...registry.filter(s=>s.sceneId!==snapshot.sceneId),snapshot],null,2)+'\n');
console.log('Validated snapshot imported into server-only source. Rebuild, test and deploy before use.');
