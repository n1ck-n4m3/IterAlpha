import {createHash} from 'node:crypto';
import {appendFile, mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {researchConfigSchema, researchDataSchema} from '../lib/research/schema.ts';
import {walkForward} from '../lib/research/walk-forward.ts';

const [dataPath, configPath, outputDirectory = '.research/runs'] = process.argv.slice(2);
if (!dataPath || !configPath) throw new Error('Usage: npm run research -- <data.json> <config.json> [output-directory]');
async function load(path: string, maximumBytes: number) {
  if ((await stat(path)).size > maximumBytes) throw new Error('Research input exceeds the size limit.');
  return JSON.parse(await readFile(path, 'utf8'));
}
const data = researchDataSchema.parse(await load(dataPath, 50_000_000));
const config = researchConfigSchema.parse(await load(configPath, 16_384));
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const datasetHash = hash(data), configHash = hash(config);
const result = walkForward(data, config);
// Bind results to the actual research and signal source, not just a manually named revision.
const engineHash = hash(await Promise.all(['lib/research/backtest.ts', 'lib/research/walk-forward.ts', 'lib/research/schema.ts', 'lib/spider/strategy.ts', 'lib/training/indicators.ts'].map(path => readFile(new URL(`../${path}`, import.meta.url), 'utf8'))));
const startedAt = new Date().toISOString(), experimentId = hash({datasetHash, configHash, engineHash}).slice(0, 24);
const report = {experimentId, startedAt, datasetHash, configHash, engineHash,
  venue: data.venue, symbol: data.symbol, base: data.base, quote: data.quote, interval: data.interval,
  source: data.source, rules: data.rules, config, ...result};
const directory = resolve(outputDirectory); await mkdir(directory, {recursive: true});
const reportPath = resolve(directory, `${experimentId}.json`);
// Do not overwrite a previous experiment. All attempts remain in the local ledger.
await appendFile(resolve(directory, 'experiments.jsonl'), JSON.stringify({experimentId, startedAt, datasetHash, configHash, engineHash, venue: data.venue, symbol: data.symbol, summary: result.summary}) + '\n', {mode: 0o600});
try {await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', {flag: 'wx', mode: 0o600});}
catch (error) {if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;}
console.log(JSON.stringify({report: reportPath, status: report.status, sourceKind: data.source.kind, quote: data.quote, ...result.summary}, null, 2));
