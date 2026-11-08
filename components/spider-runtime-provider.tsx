'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {BotView,EvaluationSeconds,Interval,Market,Snapshot,Strategy} from '../lib/spider/types';
import {SPIDER as C} from '../lib/spider/copy';
import {EXECUTION,stats} from '../lib/spider/engine';
import {browserDirectory,browserSnapshot} from '../lib/spider/browser-feed';
import {MANDATES,matchingMandate,type MandateId} from '../lib/spider/mandates';
import {COCKPIT as V} from '../lib/spider/cockpit';
import {isNewerVersion,SpiderQueue,SpiderRequestError,spiderRequest as api} from '../lib/spider/client';

type Catalog={direct?:boolean;markets:Market[];venues:{venue:string;status:string;count:number}[]};
/** Own execution above route content so presentation changes cannot stop the paper account. */
function useSpiderController(){
  const [catalog, setCatalog] = useState<Catalog | null>(null), [bots, setBots] = useState<BotView[]>([]), [bot, setBot] = useState<BotView | null>(null);
  const [marketId, setMarketId] = useState('binance:BTCUSDT'), [interval, setIntervalValue] = useState<Interval>(300), [strategy, setStrategy] = useState<Strategy>('trend');
  const [evaluationSeconds, setEvaluationSeconds] = useState<EvaluationSeconds>(15), [cooldown, setCooldown] = useState(30), [feeBps, setFeeBps] = useState(10), [slippageBps, setSlippageBps] = useState(5);
  const [capital, setCapital] = useState('10000'), [allocation, setAllocation] = useState(20), [stop, setStop] = useState(1), [target, setTarget] = useState(2);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [feedError, setFeedError] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [runner,setRunner]=useState(false),[clockNow,setClockNow]=useState(0),[observing,setObserving]=useState(false);
  const [enabled,setEnabled]=useState(false),[workspaceVisible,setWorkspaceVisible]=useState(false),[mandate,setMandate]=useState<MandateId>('trend');
  const [workspaceMode,setWorkspaceMode]=useState<'easy'|'pro'>('easy');
  const attachWorkspace=useCallback(()=>{setEnabled(true);setWorkspaceVisible(true);},[]);
  const detachWorkspace=useCallback(()=>setWorkspaceVisible(false),[]);
  const lastCue = useRef(''), queue = useRef(new SpiderQueue()), mounted = useRef(true);
  const [accountsLoading, setAccountsLoading] = useState(true), [pendingAction, setPendingAction] = useState(''), [controlNotice, setControlNotice] = useState(''), [retryKey, setRetryKey] = useState(0);
  useEffect(() => {if (!controlNotice) return; const timer=setTimeout(()=>setControlNotice(''),5500);return()=>clearTimeout(timer);}, [controlNotice]);
  useEffect(() => {if(!enabled)return;const timer = window.setInterval(() => {if (!document.hidden) setClockNow(Date.now());}, 1000); return () => clearInterval(timer);}, [enabled]);
  const directMode = bot ? bot.config.feedMode === 'browser' : !!catalog?.direct && marketId.startsWith('binance:');
  const botRef = useRef(bot), pendingStart = useRef<{signature: string; id: string} | null>(null), commandBusy = useRef(false);
  const accept = useCallback((next: BotView) => {if (!isNewerVersion(botRef.current, next)) return; botRef.current = next; if (!mounted.current) return; setBot(next); setBots(old => [next, ...old.filter(b => b.id !== next.id)].sort((a, b) => b.updatedAt - a.updatedAt));}, []);
  const openBot = useCallback((next: BotView) => {accept(next); setMandate(next.config.mandate??matchingMandate(next.config)??'trend'); setMarketId(next.config.market.id); setIntervalValue(next.config.interval); setControlNotice(''); setStrategy(next.config.strategy); setCapital(String(next.config.initialCash)); setAllocation(next.config.allocationPercent); setStop(next.config.stopPercent); setTarget(next.config.targetPercent); setEvaluationSeconds(next.config.evaluationSeconds ?? 5); setCooldown(next.config.cooldownSeconds ?? 0); setFeeBps(next.config.feeBps ?? 10); setSlippageBps(next.config.slippageBps ?? 5);}, [accept]);
  const loadCatalog = useCallback(async () => {try {
    const server=await api<Catalog>('/api/spider/markets');
    if(new URLSearchParams(window.location.search).get('feed')==='browser'||!server.markets.some(m=>m.venue==='binance')){
      try {const markets=await browserDirectory();setCatalog({...server,direct:true,markets:[...markets,...server.markets.filter(m=>m.venue!=='binance')]});return;}catch {if(!server.markets.length){setCatalog(server);setError(C.browserUnavailable);return;}}
    }
    setCatalog(server);
  } catch (e) {setError((e as Error).message);}}, []);
  useEffect(() => {if(!enabled)return; mounted.current = true; let active = true; void loadCatalog(); void api<{bots: BotView[]; runnerConfigured: boolean}>('/api/spiders').then(result => {if (!active) return; setBots(result.bots); setRunner(result.runnerConfigured); const latest = result.bots.find(b => b.status === 'running') ?? result.bots[0]; if (latest) openBot(latest);}).catch(e => {if (active) setError(e.message);}).finally(() => {if (active) setAccountsLoading(false);}); return () => {active = false; mounted.current = false;};}, [enabled,loadCatalog, openBot]);
  useEffect(() => {
    if(!enabled||(!workspaceVisible&&botRef.current?.status!=='running'))return;
    let disposed = false, timeout: ReturnType<typeof setTimeout>;
    async function poll() {
      if (disposed) return;
      const cycleStarted = Date.now();
      if (!document.hidden && catalog) {
        setObserving(true);
        let snapshotForTick:Snapshot|null=null;
        try {const selected = (catalog?.markets??[]).find(m=>m.id===marketId)??botRef.current?.config.market;
          const next = directMode && selected ? await browserSnapshot(selected,interval) : await api<Snapshot>(`/api/spider/market?market=${encodeURIComponent(marketId)}&interval=${interval}`); if (disposed) return; snapshotForTick=next; setSnapshot(next); setClockNow(Date.now()); setFeedError('');}
        catch (e) {if (!disposed) {setFeedError((e as Error).message); setClockNow(Date.now());}}
        if (!disposed && !commandBusy.current) {
          await queue.current.run(async () => {
            const current = botRef.current;
            if (disposed || commandBusy.current || current?.status !== 'running' || current.config.market.id !== marketId) return;
            try {const next = await api<BotView>(`/api/spiders/${current.id}/tick`, {version: current.version, ...(directMode && snapshotForTick ? {browserSnapshot: snapshotForTick} : {})}); if (botRef.current?.id === next.id) accept(next);}
            catch (e) {if (!disposed) setError((e as Error).message);}
          });
        }
      }
      if (!disposed) setObserving(false);
      if (!disposed) timeout = setTimeout(() => void poll(), Math.max(250, 5000 - (Date.now() - cycleStarted)));
    }
    void poll(); return () => {disposed = true; clearTimeout(timeout);setObserving(false);};
  }, [enabled,workspaceVisible,bot?.status,marketId, interval, accept, directMode, catalog, retryKey]);
  useEffect(() => {
    if(!enabled)return;
    const pauseOnLeave = () => {
      const current = botRef.current; if ((runner && current?.config.feedMode !== 'browser') || current?.status !== 'running') return;
      void fetch(`/api/spiders/${current.id}/pause`, {method: 'POST', credentials: 'same-origin', keepalive: true, headers: {'Content-Type': 'application/json', 'X-IterAlpha-Request': '1'}, body: JSON.stringify({version: current.version})}).then(async response => {if (response.ok) {const next = await response.json() as BotView; if (botRef.current?.id === next.id) accept(next);}}).catch(() => {});
    };
    const onVisibility = () => {if (document.hidden) pauseOnLeave();};
    document.addEventListener('visibilitychange', onVisibility); window.addEventListener('pagehide', pauseOnLeave);
    return () => {document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', pauseOnLeave);};
  }, [enabled,runner, accept]);
  useEffect(() => {const event = bot?.events.at(-1); if (!bot || !event) return; const key = `${bot.id}:${event.time}:${event.action}`; if (lastCue.current && lastCue.current !== key && event.action!=='hold') window.dispatchEvent(new CustomEvent('iteralpha:audio', {detail: event.action})); lastCue.current = key;}, [bot]);
  const market = catalog?.markets.find(m => m.id === marketId) ?? bot?.config.market ?? snapshot?.market;
  const quote = market?.quote ?? 'USDT', base = market?.base ?? 'BTC';
  const currentSnapshot = snapshot?.market.id === marketId && snapshot.interval === interval ? snapshot : null;
  const fresh = !!currentSnapshot && !feedError && clockNow - currentSnapshot.quoteTime < EXECUTION.maxSnapshotAge;
  const metrics = bot ? stats(bot, currentSnapshot?.bid ?? bot.lastMark) : null, locked = !!bot;
  const settingsError = !Number.isFinite(stop) || stop < .2 || stop > 10 || !Number.isFinite(target) || target < .4 || target > 20 ? V.invalidExits : !Number.isFinite(Number(capital)) || Number(capital) <= 0 || Number(capital) > 1_000_000_000 ? C.invalidCapital : !Number.isFinite(feeBps) || feeBps < 0 || feeBps > 200 || !Number.isFinite(slippageBps) || slippageBps < 0 || slippageBps > 100 ? C.invalidCosts : market && Number(capital) * allocation / 100 < market.minNotional * 1.01 ? `${C.minimumOrder} ${market.minNotional} ${quote}` : '';
  async function command(action: 'pause' | 'resume' | 'close' | 'browser-feed') {
    const selected = botRef.current; if (!selected || commandBusy.current) return;
    commandBusy.current = true; setBusy(true); setPendingAction(action); setError(''); setControlNotice('');
    try {
      await queue.current.run(async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          const current = botRef.current; if (!current || current.id !== selected.id) return;
          try {
            const direct = (current.config.feedMode === 'browser' && action !== 'pause' || action === 'browser-feed') ? await browserSnapshot(current.config.market, current.config.interval) : null;
            const saved = await api<BotView>(`/api/spiders/${current.id}/${action}`, {version: current.version, ...(direct ? {browserSnapshot: direct} : {})}); accept(saved);
            if (action === 'close' && saved.quantity > 0) {setError(`${C.closeBlocked} ${C.reasons[saved.events.at(-1)?.reason ?? 'liquidity']}`); return;}
            setControlNotice(action === 'resume' && saved.status !== 'running' ? C.reasons[saved.events.at(-1)?.reason ?? 'paused'] : C.confirmed[action]); return;
          } catch (e) {
            const result = await api<{bots: BotView[]}>('/api/spiders').catch(() => null), latest = result?.bots.find(b => b.id === selected.id);
            if (latest) accept(latest);
            if (latest && (action === 'pause' && latest.status === 'paused' || action === 'close' && latest.quantity === 0 && latest.status === 'paused')) {setControlNotice(C.confirmed[action]); return;}
            if (!(e instanceof SpiderRequestError) || e.status !== 409 || !latest || attempt > 0) throw e;
          }
        }
      });
    } catch (e) {setError((e as Error).message);} finally {commandBusy.current = false; setBusy(false); setPendingAction('');}
  }
  async function start() {
    if (commandBusy.current) return; commandBusy.current = true; setBusy(true); setPendingAction('start'); setControlNotice(''); setError('');
    try {const configuration={strategy,interval,evaluationSeconds,cooldownSeconds:cooldown,allocationPercent:allocation,stopPercent:stop,targetPercent:target}; const selectedMandate=matchingMandate(configuration); const body = {...(selectedMandate?{mandate:selectedMandate}:{}),feedMode:directMode?'browser':'server',marketId, strategy, interval, initialCash: Number(capital), allocationPercent: allocation, stopPercent: stop, targetPercent: target, evaluationSeconds, cooldownSeconds: cooldown, feeBps, slippageBps}; const signature = JSON.stringify(body);
      const pending = pendingStart.current?.signature === signature ? pendingStart.current : {signature, id: crypto.randomUUID()}; pendingStart.current = pending;
      const direct=directMode&&market?await browserSnapshot(market,interval):null;
      const next = await api<BotView>('/api/spiders', {...body, requestId: pending.id,...(direct?{browserSnapshot:direct}:{})}); pendingStart.current = null; accept(next);
    } catch (e) {setError((e as Error).message);} finally {commandBusy.current = false; setBusy(false); setPendingAction('');}
  }
  function newSpider() {if (bots.some(b => b.status === 'running')) {setError(C.marketLocked); return;} botRef.current = null; setBot(null); setIntervalValue(interval); setError(''); setControlNotice(''); selectMandate(mandate); pendingStart.current = null;}
  function selectMandate(id:MandateId){const plan=MANDATES[id];setMandate(id);setStrategy(plan.strategy);setIntervalValue(plan.interval);setSnapshot(null);setAllocation(plan.allocationPercent);setStop(plan.stopPercent);setTarget(plan.targetPercent);setEvaluationSeconds(plan.evaluationSeconds);setCooldown(plan.cooldownSeconds);}
  function selectStrategy(next: Strategy) {setStrategy(next); setStop(next === 'tape' ? .3 : 1); setTarget(next === 'tape' ? .6 : 2);}
  function selectMarket(next: Market) {if (locked || accountsLoading) return false; setMarketId(next.id); setSnapshot(null); setFeedError(''); if(next.quote!==quote)setCapital(['BTC','ETH'].includes(next.quote)?'1':'10000'); setFeeBps(next.venue === 'coinbase' ? 60 : 10);return true;}
  return {workspaceMode,setWorkspaceMode,mandate,enabled,workspaceVisible,attachWorkspace,detachWorkspace,catalog,bots,bot,marketId,setMarketId,interval,setIntervalValue,strategy,setStrategy,evaluationSeconds,setEvaluationSeconds,cooldown,setCooldown,feeBps,setFeeBps,slippageBps,setSlippageBps,capital,setCapital,allocation,setAllocation,stop,setStop,target,setTarget,snapshot,setSnapshot,feedError,setFeedError,error,setError,busy,runner,clockNow,observing,mounted,botRef,accountsLoading,pendingAction,controlNotice,setControlNotice,retryKey,setRetryKey,directMode,openBot,loadCatalog,market,quote,base,currentSnapshot,fresh,metrics,locked,settingsError,command,start,newSpider,selectMandate,selectStrategy,selectMarket};
}

type SpiderController=ReturnType<typeof useSpiderController>;
const SpiderRuntimeContext=createContext<SpiderController|null>(null);
export function SpiderRuntimeProvider({children}:{children:ReactNode}){
  const controller=useSpiderController();
  return <SpiderRuntimeContext.Provider value={controller}>{children}</SpiderRuntimeContext.Provider>;
}
export function useSpiderRuntime(){const runtime=useContext(SpiderRuntimeContext);if(!runtime)throw new Error("SpiderRuntimeProvider is required.");return runtime;}
