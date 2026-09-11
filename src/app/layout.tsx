import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { AppProviders } from '@/components/AppProviders';
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: `${SITE_NAME} | KMB Bus ETA & Nearby Stops in Hong Kong`,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | KMB Bus ETA & Nearby Stops in Hong Kong`,
    description: SITE_DESCRIPTION,
    locale: "zh_HK",
    alternateLocale: "en_HK",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | KMB Bus ETA & Nearby Stops in Hong Kong`,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4ed8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className="h-full antialiased dark"
      suppressHydrationWarning
    >
      <body className="min-h-full"><AppProviders>{children}</AppProviders></body>
    </html>
  );
}
