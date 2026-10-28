/** Run on an always-on CPU host. No exchange credentials or model are needed. */
const origin = new URL(process.env.ITERALPHA_SITE_URL || 'http://localhost:5173');
const secret = process.env.SPIDER_RUNNER_KEY || '';
if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname)) throw new Error('A secure site URL is required.');
if (secret.length < 32) throw new Error('SPIDER_RUNNER_KEY must contain at least 32 characters.');
const endpoint = new URL('/api/spider/run', origin);
let stopping = false;
process.on('SIGINT', () => {stopping = true;});
process.on('SIGTERM', () => {stopping = true;});
while (!stopping) {
  const started = Date.now();
  try {
    const response = await fetch(endpoint, {method: 'POST', redirect: 'error', headers: {Authorization: `Bearer ${secret}`}, signal: AbortSignal.timeout(20000)});
    if (!response.ok) console.error(`Spider update failed with status ${response.status}.`);
    else {const result = await response.json(); if (result.checked > 0) console.info(`Spider update: ${result.checked} checked, ${result.saved} saved.`);}
  } catch {console.error('Spider update could not reach the site.');}
  await new Promise(resolve => setTimeout(resolve, Math.max(1000, 5000 - (Date.now() - started))));
}
