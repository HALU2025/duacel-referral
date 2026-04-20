'use client'

import { useEffect, useState } from 'react'
import liff from '@line/liff'
import { Loader2, LogOut } from 'lucide-react'

export default function StaffMiniApp() {
  const [isLiffInitialized, setIsLiffInitialized] = useState(false)
  const [liffError, setLiffError] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID
        if (!liffId) throw new Error('LIFF IDが設定されていません')

        // 1. LIFFの初期化
        await liff.init({ liffId })
        setIsLiffInitialized(true)

        // 2. ログインチェック
        if (!liff.isLoggedIn()) {
          // ログインしていなければ、自動的にLINEのログイン画面へ
          liff.login()
          return
        }

        // 3. ログイン済みならプロフィールを取得
        const userProfile = await liff.getProfile()
        setProfile(userProfile)

        // ※ ここで、取得した line_user_id を使って Supabase の staffs テーブルを検索し、
        // いなければ新規作成、いればデータ取得…という処理を後ほど追加します。

      } catch (err: any) {
        console.error('LIFF Init Error:', err)
        setLiffError(err.message || 'LINEログインの初期化に失敗しました')
      }
    }

    initLiff()
  }, [])

  const handleLogout = () => {
    liff.logout()
    window.location.reload()
  }

  // --- ローディング中・エラー時の表示 ---
  if (liffError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-red-50 text-red-600 text-center">
        <AlertTriangle className="w-12 h-12 mb-4 text-red-500" />
        <p className="font-bold mb-2">エラーが発生しました</p>
        <p className="text-sm">{liffError}</p>
      </div>
    )
  }

  if (!isLiffInitialized || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-500 text-sm font-bold animate-pulse">LINEで認証中...</p>
      </div>
    )
  }

  // --- ログイン成功時の表示（テスト用UI） ---
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <header className="bg-white px-5 py-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {profile.pictureUrl ? (
            <img src={profile.pictureUrl} alt="Profile" className="w-10 h-10 rounded-full border border-gray-200" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              {profile.displayName.charAt(0)}
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 font-bold">ようこそ</p>
            <p className="text-sm font-bold text-gray-900">{profile.displayName} さん</p>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="p-5 space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
          <p className="text-green-600 font-bold mb-2">✅ LINE連携 成功！</p>
          <p className="text-xs text-gray-500 mb-4">
            あなたのLINE ID: <br/>
            <span className="font-mono bg-gray-100 px-2 py-1 rounded mt-1 inline-block">{profile.userId}</span>
          </p>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-3 rounded-xl font-bold text-sm hover:bg-gray-50"
        >
          <LogOut className="w-4 h-4" /> ログアウトしてやり直す
        </button>
      </main>
    </div>
  )
}

function AlertTriangle(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
    </svg>
  )
}