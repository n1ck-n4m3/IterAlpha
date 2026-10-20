import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./visual-system.css";
import "./experience.css";
import VisitTracker from '../components/visit-tracker';
import InteractionEffects from '../components/interaction-effects';

export const metadata: Metadata = {
  title: "IterAlpha — Train your judgment",
  description: "Short trading scenes. Deliberate decisions. A clearer view of your judgment.",
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
      <body className="antialiased">{children}<VisitTracker/><InteractionEffects/></body>
    </html>
  );
}
