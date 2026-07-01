import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://driveruncleleague.vercel.app/"; 
const title = "Drive Uncle FIFA League — Fantasy World Cup 2026";
const description =
  "Track live standings for the Drive Uncle Fantasy FIFA World Cup 2026 league. See manager rankings, squad points, match results, and progress charts updated in real time.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | Drive Uncle FIFA League",
  },
  description,
  keywords: [
    "FIFA World Cup 2026",
    "Fantasy Football",
    "Fantasy League",
    "World Cup Fantasy",
    "Drive Uncle",
    "Football Standings",
    "Fantasy Sports",
  ],
  applicationName: "Drive Uncle FIFA League",
  authors: [{ name: "Drive Uncle FIFA League" }],
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  creator: "Drive Uncle FIFA League",
  publisher: "Drive Uncle FIFA League",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Drive Uncle FIFA League",
    title,
    description,
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Drive Uncle FIFA League Standings",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png", 
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><Analytics />{children}</body>
    </html>
  );
}