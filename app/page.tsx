import LandingPage from '../components/landing-page';
import {getChatGPTUser} from './chatgpt-auth';
import {env} from 'cloudflare:workers';

export const dynamic='force-dynamic';
export default async function Home() {
  const user=await getChatGPTUser();
  const adminId=(env as {ITERALPHA_ADMIN_USER_ID?:string}).ITERALPHA_ADMIN_USER_ID;
  return <LandingPage viewer={user?{name:user.displayName,isAdmin:!!adminId&&user.userId===adminId}:null}/>;
}
