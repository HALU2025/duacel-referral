// app/manifest.ts
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Duacel - 美容師報酬管理',
    short_name: 'Duacel',
    description: '美容師さんのための紹介報酬管理ツール',
    start_url: '/dashboard', // ホーム画面から起動した時のページ
    display: 'standalone',   // URLバーを隠す設定
    background_color: '#ffffff',
    theme_color: '#4338ca',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}