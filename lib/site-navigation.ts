export type LinkIntent={href:string;currentUrl:string;button?:number;metaKey?:boolean;ctrlKey?:boolean;shiftKey?:boolean;altKey?:boolean;target?:string;download?:unknown;defaultPrevented?:boolean};
/** Preserve native new-tab, download, external, and same-document anchor behavior. */
export function clientNavigationTarget(intent:LinkIntent):string|null{
  if(intent.defaultPrevented||(intent.button??0)!==0||intent.metaKey||intent.ctrlKey||intent.shiftKey||intent.altKey)return null;
  if(intent.target&&intent.target.toLowerCase()!=='_self'||intent.download!==undefined&&intent.download!==false)return null;
  try{
    const current=new URL(intent.currentUrl),next=new URL(intent.href,current);
    if(!['http:','https:'].includes(next.protocol)||next.origin!==current.origin)return null;
    if(next.pathname===current.pathname&&next.search===current.search&&next.hash)return null;
    return next.pathname+next.search+next.hash;
  }catch{return null;}
}
