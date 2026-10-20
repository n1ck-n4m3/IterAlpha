import LandingPage from '../components/landing-page';
import {getChatGPTUser} from './chatgpt-auth';
import {env} from 'cloudflare:workers';
import {isSiteAdmin} from '../lib/server/admin-auth';

export const dynamic='force-dynamic';
export default async function Home() {
  const user=await getChatGPTUser();
  return <LandingPage viewer={user?{name:user.displayName,isAdmin:isSiteAdmin(user,env as {ITERALPHA_ADMIN_USER_ID?:string;ITERALPHA_ADMIN_EMAIL?:string})}:null}/>;
}
