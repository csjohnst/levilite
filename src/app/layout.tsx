import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LevyLite — Strata management software that doesn't cost the earth",
  description: "Affordable strata management software for small Australian operators. $6/lot/month. No minimums. No sales calls. Built for sole practitioners and small agencies.",
  keywords: ["strata management", "strata software", "levy management", "WA strata", "small strata operator", "affordable strata", "owner portal", "AGM management"],
  openGraph: {
    title: "LevyLite — Strata management software that doesn't cost the earth",
    description: "Affordable strata management software for small Australian operators. $6/lot/month. No minimums.",
    url: "https://levylite.com.au",
    siteName: "LevyLite",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
