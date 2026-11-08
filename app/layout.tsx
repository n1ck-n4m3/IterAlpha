import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./visual-system.css";
import "./experience.css";
import "./learning.css";
import "./cockpit.css";
import "./orbit.css";
import "./dark-spider.css";
import VisitTracker from '../components/visit-tracker';
import InteractionEffects from '../components/interaction-effects';
import {LocaleProvider} from '../components/locale-provider';
import LocalizedContent from '../components/localized-content';
import {requestLocale} from '../lib/i18n/request-locale';
import {localizeText} from '../lib/i18n/text';
import {AudioProvider} from '../components/audio-provider';
import {SpiderRuntimeProvider} from '../components/spider-runtime-provider';
import AgentStatusDock from '../components/agent-status-dock';
import './agent-runtime.css';

export async function generateMetadata():Promise<Metadata>{const {locale}=await requestLocale();return {title:localizeText(locale,'IterAlpha — Your strategy, in motion'),description:localizeText(locale,'Your goals and limits guide the strategy. Performance must be evaluated after costs on unseen data.'),icons:{icon:'/assets/iteralpha-logo.png',shortcut:'/assets/iteralpha-logo.png'}};}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const {locale,hasPreference}=await requestLocale();
  return (
    <html lang={locale} dir={locale==='ar'?'rtl':'ltr'}>
      <body className="antialiased"><LocaleProvider initialLocale={locale} hasPreference={hasPreference}><AudioProvider><SpiderRuntimeProvider><LocalizedContent>{children}</LocalizedContent><AgentStatusDock/><VisitTracker/><InteractionEffects/></SpiderRuntimeProvider></AudioProvider></LocaleProvider></body>
    </html>
  );
}
