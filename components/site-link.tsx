'use client';
import {forwardRef,type AnchorHTMLAttributes} from 'react';
import {useRouter} from 'next/navigation';
import {clientNavigationTarget} from '../lib/site-navigation';

type Props=Omit<AnchorHTMLAttributes<HTMLAnchorElement>,'href'>&{href:string;scroll?:boolean};
/** Use the public router directly; the current Vinext Link shim loses dynamic exports in production. */
const SiteLink=forwardRef<HTMLAnchorElement,Props>(function SiteLink({href,scroll=true,onClick,target,download,children,...attributes},ref){
  const router=useRouter();
  return <a {...attributes} ref={ref} href={href} target={target} download={download} onClick={event=>{
    onClick?.(event);
    const destination=clientNavigationTarget({href,currentUrl:window.location.href,button:event.button,metaKey:event.metaKey,ctrlKey:event.ctrlKey,shiftKey:event.shiftKey,altKey:event.altKey,target,download,defaultPrevented:event.defaultPrevented});
    if(destination===null)return;
    event.preventDefault();router.push(destination,{scroll});
  }}>{children}</a>;
});
export default SiteLink;
