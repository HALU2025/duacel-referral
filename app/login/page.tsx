'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  // ログイン用のステート
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // パスワードリセット（モーダル）用のステート
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  
  const router = useRouter()

  // ==========================================
  // 通常のログイン処理
  // ==========================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      let msg = error.message
      if (msg.includes('Invalid login credentials')) msg = 'メールアドレスかパスワードが間違っています。'
      if (msg.includes('Email not confirmed')) msg = 'メールアドレスの認証が完了していません。'
      alert(`ログイン失敗: ${msg}`)
    } else {
      router.push('/owner/dashboard')
    }
  }

  // ==========================================
  // パスワードリセット（モーダル内）の処理
  // ==========================================
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault() // フォームのデフォルト送信を防ぐ

    if (!resetEmail) {
      alert('メールアドレスを入力してください。')
      return
    }

    setResetLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/update-password`, 
    })
    setResetLoading(false)

    if (error) {
      if (error.message.includes('User not found')) {
        alert('入力されたメールアドレスは登録されていません。確認してください。')
      } else {
        alert(`エラー: ${error.message}`)
      }
    } else {
      alert('パスワード再設定用のメールを送信しました！メールボックスをご確認ください。')
      setIsResetModalOpen(false) // 成功したらモーダルを閉じる
      setResetEmail('') // 入力欄をクリア
    }
  }

  // ==========================================
  // UIレンダリング
  // ==========================================
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 relative">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        
        {/* タイトル（文字を小さくし、2行に変更） */}
        <div className="mb-6 text-center text-gray-800">
          <p className="text-sm font-bold text-gray-500 mb-1">Duacel紹介プログラム</p>
          <h1 className="text-lg font-bold">ショップ管理者ログイン</h1>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          {/* メールアドレス入力 */}
          <div>
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
            />
          </div>

          {/* パスワード入力（表示切替付き） */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-sm text-gray-500 hover:text-gray-700 font-bold"
              tabIndex={-1}
            >
              {showPassword ? '隠す' : '表示'}
            </button>
          </div>

          {/* ログインボタン */}
          <button 
            type="submit" 
            disabled={loading}
            className={`w-full text-white p-3 rounded font-bold transition-colors ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? '処理中...' : 'ログイン'}
          </button>
        </form>

        {/* パスワードを忘れた場合のリンク */}
        <div className="mt-6 text-center">
          <button 
            type="button" 
            onClick={() => setIsResetModalOpen(true)}
            disabled={loading}
            className="text-sm text-blue-600 hover:underline hover:text-blue-800 bg-transparent border-none cursor-pointer"
          >
            パスワードを忘れた場合はこちら
          </button>
        </div>
      </div>

      {/* ==========================================
          パスワードリセット用モーダル
          ========================================== */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2 text-gray-800">パスワード再設定</h2>
            <p className="text-sm text-gray-600 mb-4">
              ご登録のメールアドレスを入力してください。再設定用のリンクをお送りします。
            </p>
            
            <form onSubmit={handleResetPassword}>
              <input
                type="email"
                placeholder="メールアドレス"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                required
                disabled={resetLoading}
              />
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  disabled={resetLoading}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 text-sm font-bold transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className={`px-4 py-2 text-white rounded text-sm font-bold transition-colors ${resetLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {resetLoading ? '送信中...' : 'メールを送信'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}