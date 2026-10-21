import type { Metadata } from "next";
import { Geist, Shippori_Mincho } from "next/font/google";
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
  description: "Espace membres du Shobukan Dojo, club de kendo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${ui.variable} ${title.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-paper font-sans text-ink">{children}</body>
    </html>
  );
}
