import {cookies,headers} from 'next/headers';
import {resolveLocale} from '../locale-copy';
export async function requestLocale(){const [jar,requestHeaders]=await Promise.all([cookies(),headers()]);const saved=jar.get('iteralpha_locale')?.value;return {locale:resolveLocale(saved??requestHeaders.get('accept-language')?.split(',')[0]??'en'),hasPreference:!!saved};}
