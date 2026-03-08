import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BackgroundAudio } from "@/components/release/BackgroundAudio";
import { Analytics } from "@vercel/analytics/next";
import { LanguageProvider } from "@/lib/LanguageProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Inner Tools · 内在工具箱",
  description: "通过圣多纳释放法，温和地释放卡住的情绪。",
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
        <LanguageProvider>
          {children}
          <BackgroundAudio />
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
