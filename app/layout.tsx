import type { Metadata, Viewport } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const publicUrl = (path: string) => `${basePath}${path}`;

export const metadata: Metadata = {
  title: "Mom Home",
  description: "A simple household command center for inventory, tasks, orders, and reminders.",
  manifest: publicUrl("/manifest.webmanifest"),
  appleWebApp: {
    capable: true,
    title: "Mom Home",
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: publicUrl("/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: publicUrl("/icon-512.png"), sizes: "512x512", type: "image/png" },
      { url: publicUrl("/icon.svg"), type: "image/svg+xml" }
    ],
    apple: [{ url: publicUrl("/apple-touch-icon.png"), sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#37685f"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
