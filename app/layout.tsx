import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope, DM_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import "./globals.css";

const manropeHeading = Manrope({
  subsets: ["latin"],
  variable: "--font-heading",
});

const dmSans = DM_Sans({subsets:['latin'],variable:'--font-sans'});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
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
      className={cn("font-sans", dmSans.variable, manropeHeading.variable)}
      lang="en"
      suppressHydrationWarning
    >
      <body className={cn(manrope.variable, geistMono.variable, "antialiased")}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
