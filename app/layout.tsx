import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JARVIS — The AI That Has Attitude",
  description:
    "مساعدك الذكي... بس عنده شخصية. A holographic voice-and-text AI assistant by Mulk Allah.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar">
      <body>{children}</body>
    </html>
  );
}
