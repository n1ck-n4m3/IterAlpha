import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./visual-system.css";
import "./experience.css";
import "./learning.css";
import "./cockpit.css";
import "./orbit.css";
import VisitTracker from '../components/visit-tracker';
import InteractionEffects from '../components/interaction-effects';
import {LocaleProvider} from '../components/locale-provider';
import {AudioProvider} from '../components/audio-provider';

export const metadata: Metadata = {
  title: "IterAlpha — Your strategy, in motion",
  description: "Choose a crypto strategy. Watch your agent work. Inspect paper trading results after costs.",
  icons: {
    icon: "/assets/iteralpha-logo.png",
    shortcut: "/assets/iteralpha-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><LocaleProvider><AudioProvider>{children}<VisitTracker/><InteractionEffects/></AudioProvider></LocaleProvider></body>
    </html>
  );
}
