import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Duacel 紹介プログラム', // インストール時に表示される正式名称
    short_name: 'Duacel', // ホーム画面のアイコン下に表示される短い名前
    description: 'Duacelの紹介プログラム・メンバー用アプリです',
    start_url: '/', // アイコンをタップした時に最初に開くページ
    display: 'standalone', // ★ここが重要！URLバーを消して全画面アプリのように動かす設定
    background_color: '#ffffff',
    theme_color: '#111827', // ステータスバー（時計や電池マークの帯）の色
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