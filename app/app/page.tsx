import TrainingApp from '../../components/training-app';
import {getChatGPTUser} from '../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {isSiteAdmin} from '../../lib/server/admin-auth';

export const dynamic='force-dynamic';
export default async function AppPage() {
  const user=await getChatGPTUser();
  return <TrainingApp viewer={user?{name:user.displayName,isAdmin:isSiteAdmin(user,env as {ITERALPHA_ADMIN_USER_ID?:string;ITERALPHA_ADMIN_EMAIL?:string})}:null}/>;
}
