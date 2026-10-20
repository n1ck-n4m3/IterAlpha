import Link from 'next/link';
import {notFound} from 'next/navigation';
import {env} from 'cloudflare:workers';
import {requireChatGPTUser} from '../chatgpt-auth';
import {Repository} from '../../lib/server/repository';
import {ACCOUNT_COPY as C} from '../../lib/account-copy';
import styles from './page.module.css';

export const dynamic='force-dynamic';

export default async function AdminPage(){
  const user=await requireChatGPTUser('/admin');
  const runtime=env as {ITERALPHA_ADMIN_USER_ID?:string;DB?:D1Database};
  if(!runtime.ITERALPHA_ADMIN_USER_ID||user.userId!==runtime.ITERALPHA_ADMIN_USER_ID)notFound();
  if(!runtime.DB)return <main className={styles.root}><p>Visitor storage is unavailable.</p></main>;
  const report=await new Repository(runtime.DB).visitReport(new Date().toISOString());
  return <main className={styles.root}>
    <header className={styles.header}><Link className={styles.brand} href="/">IterAlpha<span>.</span></Link><div><span>{user.displayName}</span><Link href="/">{C.back}</Link></div></header>
    <div className={styles.content}>
      <div className={styles.heading}><div><small>ITERALPHA / ADMIN</small><h1>{C.adminTitle}</h1><p>{C.adminIntro}</p></div><a href="/admin" className={styles.refresh}>{C.refresh}</a></div>
      <div className={styles.metrics}>
        <article><span>{C.views}</span><strong>{report.summary.views}</strong></article>
        <article><span>{C.visitors}</span><strong>{report.summary.visitors}</strong></article>
        <article><span>{C.accounts}</span><strong>{report.summary.accounts}</strong></article>
        <article><span>{C.leads}</span><strong>{report.leads}</strong></article>
      </div>
      <section className={styles.panel}><h2>{C.pages}</h2><div className={styles.pageBars}>{report.pages.length?report.pages.map(item=><div className={styles.pageRow} key={item.page}><span>{C.pagesByName[item.page as keyof typeof C.pagesByName]??item.page}</span><div><i style={{width:`${Math.max(4,100*item.views/Math.max(1,report.summary.views))}%`}}/></div><strong>{item.views}</strong></div>):<p className={styles.empty}>{C.empty}</p>}</div></section>
      <section className={styles.panel}><h2>{C.recent}</h2><div className={styles.tableWrap}><table><thead><tr><th>{C.time}</th><th>{C.page}</th><th>{C.visitor}</th></tr></thead><tbody>{report.visits.map((visit,index)=><tr key={`${visit.occurred_at}-${index}`}><td>{visit.occurred_at.replace('T',' ').replace(/\.\d{3}Z$/,' UTC')}</td><td>{C.pagesByName[visit.page as keyof typeof C.pagesByName]??visit.page}</td><td>{visit.email??`${C.guestLabel} · ${visit.visitor}`}</td></tr>)}</tbody></table>{!report.visits.length&&<p className={styles.empty}>{C.empty}</p>}</div></section>
    </div>
  </main>;
}
