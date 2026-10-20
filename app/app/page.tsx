import TrainingApp from '../../components/training-app';
import {getChatGPTUser} from '../chatgpt-auth';
import {env} from 'cloudflare:workers';

export const dynamic='force-dynamic';
export default async function AppPage() {
  const user=await getChatGPTUser();
  const adminId=(env as {ITERALPHA_ADMIN_USER_ID?:string}).ITERALPHA_ADMIN_USER_ID;
  return <TrainingApp viewer={user?{name:user.displayName,isAdmin:!!adminId&&user.userId===adminId}:null}/>;
}
