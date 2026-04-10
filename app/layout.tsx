import type { Metadata, Viewport } from "next";
// ★ Inter と Noto Sans JP をインポート
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

// ★ 英数字用フォント（SF Proの代わりとなる洗練されたフォント）
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// ★ 日本語用フォント
const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  display: "swap",
});

// ★ スマホでの表示領域とステータスバーの色を設定
export const viewport: Viewport = {
  themeColor: '#fffef2', // イソップ風の背景色に合わせて変更
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // ユーザーの誤タップによる拡大縮小を防ぐ
}

// ★ アプリ化のための必須設定
export const metadata: Metadata = {
  title: 'Duacel',
  description: 'Duacel 紹介プログラム',
  manifest: '/manifest.webmanifest', // ★ PWA用にマニフェストを追加
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Duacel',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja" // ★ en から ja に変更
      className={`${inter.variable} ${notoSansJP.variable} h-full antialiased`}
    >
      {/* ★ デフォルトの背景色と文字色、フォントを指定 */}
      <body className="min-h-full flex flex-col bg-[#fffef2] text-[#333333] font-sans">
        {children}
      </body>
    </html>
  );
}