import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const BASE_URL = "https://levylite.com.au";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "LevyLite — Affordable Strata Management Software for Small Operators",
    template: "%s | LevyLite",
  },
  description:
    "LevyLite is affordable strata management software built for small Australian operators. Levy tracking, AGM management, owner portal, and trust accounting — from $6/lot/month. No minimums. No sales calls.",
  keywords: [
    "strata management software",
    "strata software australia",
    "affordable strata software",
    "small strata operator",
    "levy management software",
    "strata manager software",
    "WA strata software",
    "body corporate software",
    "strata accounting software",
    "AGM management software",
    "owner portal strata",
    "strata software perth",
  ],
  authors: [{ name: "LevyLite", url: BASE_URL }],
  openGraph: {
    title: "LevyLite — Affordable Strata Management Software",
    description:
      "Strata management software built for small Australian operators. Levy tracking, AGM management, owner portal — from $6/lot/month.",
    url: BASE_URL,
    siteName: "LevyLite",
    locale: "en_AU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LevyLite — Affordable Strata Management Software",
    description:
      "Built for small Australian strata operators. From $6/lot/month.",
  },
  alternates: {
    canonical: BASE_URL,
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
        <Script
          id="schema-org"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "LevyLite",
                url: BASE_URL,
                logo: `${BASE_URL}/kokoro-logo.png`,
                description:
                  "Affordable strata management software for small Australian operators.",
                foundingDate: "2026",
                address: {
                  "@type": "PostalAddress",
                  addressLocality: "Perth",
                  addressRegion: "WA",
                  addressCountry: "AU",
                },
              },
              {
                "@context": "https://schema.org",
                "@type": "SoftwareApplication",
                name: "LevyLite",
                applicationCategory: "BusinessApplication",
                operatingSystem: "Web",
                url: BASE_URL,
                description:
                  "Strata management software for small Australian operators — levy tracking, AGM management, owner portal.",
                offers: {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "AUD",
                  description: "Free tier: up to 5 lots, 1 scheme",
                },
              },
            ]),
          }}
        />
        {children}
      </body>
    </html>
  );
}
