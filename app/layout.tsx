import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const REVEAL_STUDIO = `
(() => {
  const tauri = window.__TAURI_INTERNALS__;
  if (!tauri) return;

  const reveal = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tauri.invoke("reveal_studio").catch(() => undefined);
      });
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reveal, { once: true });
  } else {
    reveal();
  }
})();
`;

export const metadata: Metadata = {
  description:
    "Build Remotion videos with your coding agent, without touching a terminal.",
  title: "Remocn Studio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `suppressHydrationWarning` is required by next-themes: it writes the
    // theme class onto <html> before React hydrates.
    <html
      className={cn("font-sans", inter.variable, geistMono.variable)}
      lang="en"
      suppressHydrationWarning
    >
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <Script id="reveal-studio" strategy="beforeInteractive">
          {REVEAL_STUDIO}
        </Script>
      </body>
    </html>
  );
}
