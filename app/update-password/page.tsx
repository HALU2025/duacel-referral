'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    // 1. パスワードの入力チェック
    if (newPassword.length < 6) {
      alert('パスワードは6文字以上で入力してください。')
      return
    }
    if (newPassword !== confirmPassword) {
      alert('入力されたパスワードが一致しません。もう一度確認してください。')
      return
    }

    setLoading(true)

    // 2. Supabaseでパスワードを上書き更新
    // ※ メールのリンクを踏んだ時点で一時的に認証されているため、このメソッドが通ります
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    setLoading(false)

    if (error) {
      alert(`エラーが発生しました: ${error.message}`)
    } else {
      alert('パスワードの再設定が完了しました！\n新しいパスワードでログインしてください。')
      // 完了したらログイン画面へ飛ばす
      router.push('/login')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">パスワードの再設定</h1>
        <p className="text-sm text-gray-600 mb-6 text-center">
          新しいパスワードを入力してください。
        </p>
        
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          
          {/* 新しいパスワード入力 */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="新しいパスワード（6文字以上）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16"
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

          {/* 確認用パスワード入力 */}
          <div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="新しいパスワード（確認用）"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
            />
          </div>

          {/* 更新ボタン */}
          <button 
            type="submit" 
            disabled={loading}
            className={`w-full text-white p-3 rounded font-bold transition-colors mt-2 ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? '更新中...' : 'パスワードを変更する'}
          </button>
        </form>

        {/* ログイン画面へ戻るリンク */}
        <div className="mt-6 text-center">
          <button 
            type="button" 
            onClick={() => router.push('/login')}
            disabled={loading}
            className="text-sm text-gray-500 hover:underline hover:text-gray-800 bg-transparent border-none cursor-pointer"
          >
            ログイン画面に戻る
          </button>
        </div>
      </div>
    </div>
  )
}