import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LevyLite",
  description: "Strata management for small operators",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
