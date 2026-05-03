import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SiteSync — On-site project workflows",
  description:
    "Mobile-first site management: QR-coded drawings, voice notes with AI transcription, and team updates.",
  authors: [{ name: "SiteSync" }],
  openGraph: {
    title: "SiteSync — On-site project workflows",
    description:
      "QR-coded drawings, voice notes, AI transcription. Built for contractors on-site.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#142440",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
