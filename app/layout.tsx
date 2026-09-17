import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mulkallah Jarvis — Holographic AI Assistant",
  description:
    "Custom holographic Jarvis UI built on the open APEX-UI framework, with an original particle humanoid face.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar">
      <body>{children}</body>
    </html>
  );
}
