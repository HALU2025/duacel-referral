import type { Metadata, Viewport } from "next";
// ★ Roboto_Mono を含めてインポート
import { Inter, Noto_Sans_JP, Roboto_Mono } from "next/font/google";
import "./globals.css";

// ★ 英数字用：洗練されたメインフォント
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// ★ 日本語用：標準的で美しいゴシック体
const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  display: "swap",
});

// ★ 数字・等幅用：クセがなく読みやすい王道フォント
const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  display: "swap",
});

// スマホのステータスバーを背景色（イソップ風）に合わせる
export const viewport: Viewport = {
  themeColor: '#fffef2',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'Duacel',
  description: 'Duacel 紹介プログラム',
  manifest: '/manifest.webmanifest',
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
      lang="ja"
      // ★ 3つのフォント変数をすべて適用
      className={`${inter.variable} ${notoSansJP.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#fffef2] text-[#333333] font-sans">
        {children}
      </body>
    </html>
  );
}