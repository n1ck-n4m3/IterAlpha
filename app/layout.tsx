import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
