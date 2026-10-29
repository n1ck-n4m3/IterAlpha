import TrainingApp from '../../components/training-app';
import {getChatGPTUser} from '../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {isSiteAdmin} from '../../lib/server/admin-auth';
import {readAppRoute} from '../../lib/app-navigation';

export const dynamic='force-dynamic';
export default async function AppPage({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const user=await getChatGPTUser();
  const params=await searchParams, candidate=params.view;
  const initialView=readAppRoute(new URLSearchParams(typeof candidate==='string'?{view:candidate}:{}).toString()).view;
  return <TrainingApp initialView={initialView} viewer={user?{name:user.displayName,isAdmin:isSiteAdmin(user,env as {ITERALPHA_ADMIN_USER_ID?:string;ITERALPHA_ADMIN_EMAIL?:string})}:null}/>;
}
