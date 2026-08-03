import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { SoundProvider } from "@/context/SoundContext";
import { ToastProvider } from "@/context/ToastContext";
import { CUSTOM_ACCENT_KEY, DEFAULT_ACCENT } from "@/lib/theme";
import AnimatedBackground from "@/components/AnimatedBackground";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Game Hub",
  description: "Your entire game library, unified across every platform.",
};

// Runs before paint so the stored accent is already in place, rather than the
// page rendering in the default colour and correcting itself once React
// hydrates. This used to restore a data-theme attribute instead — guarding a
// value nothing in the app could write, while leaving the accent, which anyone
// could set, to flash orange on every launch.
//
// The palette maths is inlined rather than imported because this string is
// executed before any bundle loads; it must stay in step with
// deriveAccentPalette in lib/theme.ts.
const accentInitScript = `
(function() {
  try {
    var hex = window.localStorage.getItem(${JSON.stringify(CUSTOM_ACCENT_KEY)}) || ${JSON.stringify(DEFAULT_ACCENT)};
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var hx = function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); };
    var lighten = function (a) { return '#' + hx(r + (255 - r) * a) + hx(g + (255 - g) * a) + hx(b + (255 - b) * a); };
    var darken = function (a) { return '#' + hx(r * (1 - a)) + hx(g * (1 - a)) + hx(b * (1 - a)); };
    var s = document.documentElement.style;
    s.setProperty('--accent', hex);
    s.setProperty('--accent-bright', lighten(0.12));
    s.setProperty('--accent-dim', darken(0.35));
    s.setProperty('--accent-rgb', r + ', ' + g + ', ' + b);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="accent-init" strategy="beforeInteractive">
          {accentInitScript}
        </Script>
        <AnimatedBackground />
        <ThemeProvider>
          <SoundProvider>
            <ToastProvider>{children}</ToastProvider>
          </SoundProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
