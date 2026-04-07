import type { Metadata, Viewport } from "next"; // ← ★Viewportを追加！

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

// ★ スマホでの表示領域とステータスバーの色を設定
export const viewport: Viewport = {
  themeColor: '#111827', // ダークテーマ風のステータスバー
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // ユーザーの誤タップによる拡大縮小を防ぐ
}

// ★ アプリ化のための必須設定を追加
export const metadata: Metadata = {
  title: 'Duacel',
  description: 'Duacel 紹介プログラム',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Duacel',
  },
  icons: {
    apple: '/apple-touch-icon.png', // iOS用アイコンの指定
  },
}

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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}