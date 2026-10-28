import type { Metadata } from "next";
import { Geist, Shippori_Mincho } from "next/font/google";
import { CookieNotice } from "@/components/cookie-notice";
import { ToastProvider } from "@/components/ui/toast";
import { themeBootScript } from "@/lib/theme-script";
import "./globals.css";

const ui = Geist({
  variable: "--font-ui",
  subsets: ["latin"],
});

const title = Shippori_Mincho({
  variable: "--font-title",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Shobukan Dojo",
    template: "%s | Shobukan Dojo",
  },
  description: "Espace membres du Shobukan Hombu Dojo, Paris 12e : iaido, kendo, battodo, jojutsu, fuzokubudo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme is set by the boot script before React hydrates.
    <html lang="fr" className={`${ui.variable} ${title.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Runs before the first paint: no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-paper font-sans text-ink">
        <ToastProvider>
          {children}
          <CookieNotice />
        </ToastProvider>
      </body>
    </html>
  );
}
