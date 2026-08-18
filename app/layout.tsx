import type { Metadata } from "next";
import { DM_Sans, Geist_Mono, Golos_Text } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

// DM Sans ships no Cyrillic at all, so without this every Russian sentence
// falls to the Arial-based fallback next/font fabricates. Golos sits after
// DM Sans in the stack: Latin never reaches it, Cyrillic lands in a sturdy
// UI grotesque whose regular matches DM Sans's stroke weight — Manrope was
// tried first and its 400 reads a full step thinner.
const golos = Golos_Text({
  subsets: ["cyrillic", "cyrillic-ext"],
  variable: "--font-cyrillic",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  description:
    "Build Remotion videos with Claude, without touching a terminal.",
  title: "remocn studio",
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
      className={cn("font-sans", dmSans.variable, golos.variable)}
      lang="en"
      suppressHydrationWarning
    >
      <body className={cn(geistMono.variable, "antialiased")}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
