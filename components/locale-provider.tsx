'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {LOCALES,localeNames,resolveLocale,translate,type Locale,type TranslationKey} from '../lib/locale-copy';

type LocaleContextValue={locale:Locale;setLocale:(value:Locale)=>void;t:(key:TranslationKey)=>string};
const LocaleContext=createContext<LocaleContextValue|null>(null);

export function LocaleProvider({children}:{children:React.ReactNode}){
  const [locale,setLocale]=useState<Locale>('en');
  const pending=useRef<number|null>(null);
  useEffect(()=>{let saved:string|null=null;try{saved=localStorage.getItem('iteralpha_locale');}catch{}const next=resolveLocale(saved??navigator.language);pending.current=requestAnimationFrame(()=>{setLocale(next);pending.current=null;});return()=>{if(pending.current!==null)cancelAnimationFrame(pending.current);};},[]);
  useEffect(()=>{document.documentElement.lang=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr';try{localStorage.setItem('iteralpha_locale',locale);}catch{}},[locale]);
  const chooseLocale=useCallback((next:Locale)=>{if(pending.current!==null){cancelAnimationFrame(pending.current);pending.current=null;}setLocale(next);},[]);
  const value=useMemo(()=>({locale,setLocale:chooseLocale,t:(key:TranslationKey)=>translate(locale,key)}),[locale,chooseLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(){const context=useContext(LocaleContext);if(!context)throw new Error('LocaleProvider is required.');return context;}

export function LanguageSwitcher({className=''}:{className?:string}){
  const {locale,setLocale,t}=useLocale();
  return <label className={`language-switcher ${className}`}><span className="sr-only">{t('language')}</span><select aria-label={t('language')} value={locale} onChange={event=>setLocale(event.target.value as Locale)}>{LOCALES.map(option=><option key={option} value={option}>{localeNames[option]}</option>)}</select></label>;
}
