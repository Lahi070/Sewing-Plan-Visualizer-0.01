import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sewing Module Readiness Tracker | Operations Floor",
  description: "Cross-references Sewing Pre-Work Plan, Knitting WIP, and Trims Readiness to detect at-risk modules 3 days prior to production.",
  keywords: ["garment manufacturing", "sewing readiness", "knitting WIP", "trims warehouse", "operations dashboard"],
  authors: [{ name: "Operations Team" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-slate-950/5 font-sans">
        {children}
      </body>
    </html>
  );
}
