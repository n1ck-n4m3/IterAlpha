const SIGN_IN_PATH = '/signin-with-chatgpt';
const SIGN_OUT_PATH = '/signout-with-chatgpt';
const CALLBACK_PATH = '/callback';

export function chatGPTSignInPath(returnTo:string):string{
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}
export function chatGPTSignOutPath(returnTo='/'):string{
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}
function safeRelativeReturnPath(value:string):string{
  if(!value.startsWith('/')||value.startsWith('//'))return '/';
  let url:URL;
  try{url=new URL(value,'https://app.local');}catch{return '/';}
  if(url.origin!=='https://app.local'||[SIGN_IN_PATH,SIGN_OUT_PATH,CALLBACK_PATH].includes(url.pathname))return '/';
  return `${url.pathname}${url.search}${url.hash}`;
}
