
import LocalizedContent from './localized-content';


import {chatGPTSignInPath,chatGPTSignOutPath} from '../lib/auth-paths';
import {ACCOUNT_COPY} from '../lib/account-copy';

export type Viewer = {name:string;isAdmin:boolean}|null;

export default function AccountLinks({viewer,returnTo,className=''}:{viewer:Viewer;returnTo:string;className?:string}){
  return <LocalizedContent>{<div className={`account-links ${className}`}>
    {viewer?<><span data-i18n="source" className="account-name" title={`${ACCOUNT_COPY.account}: ${viewer.name}`}>{viewer.name}</span>{viewer.isAdmin&&<a href="/admin">{ACCOUNT_COPY.admin}</a>}<a href={chatGPTSignOutPath('/')} target="_top">{ACCOUNT_COPY.signOut}</a></>
      :<a className="account-sign-in" href={chatGPTSignInPath(returnTo)} target="_top">{ACCOUNT_COPY.signIn}</a>}
  </div>}</LocalizedContent>;
}
