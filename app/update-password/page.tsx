'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, KeyRound } from 'lucide-react'

export default function UpdatePasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword.length < 6) {
      alert('パスワードは6文字以上で入力してください。')
      return
    }
    if (newPassword !== confirmPassword) {
      alert('入力されたパスワードが一致しません。もう一度確認してください。')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    setLoading(false)

    if (error) {
      alert(`エラーが発生しました: ${error.message}`)
    } else {
      alert('パスワードの再設定が完了しました。\nご本人確認画面へ移動します。')
      router.replace('/verify')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fffef2] font-sans text-[#333333] selection:bg-[#e6e2d3] selection:text-[#333333]">
      <div className="w-full max-w-md bg-[#fffef2] min-h-screen sm:min-h-[500px] sm:h-auto relative shadow-none sm:shadow-sm sm:border border-[#e6e2d3] flex flex-col overflow-hidden p-8 pt-16">
        
        <div className="text-center mb-10">
          <h1 className="text-2xl font-serif tracking-[0.2em] text-[#1a1a1a] mb-8">Duacel.</h1>
          <h2 className="text-sm font-bold text-[#1a1a1a] mb-2">パスワードの再設定</h2>
          <p className="text-[11px] text-[#666666] leading-relaxed">
            新しいパスワードを入力してください。
          </p>
        </div>
        
        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" strokeWidth={1.5} />
              <input
                type="password"
                placeholder="新しいパスワード（6文字以上）"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-[#f5f2e6] border-none text-[#333333] text-sm outline-none focus:ring-1 focus:ring-[#333333] transition-all"
                required
                disabled={loading}
              />
            </div>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" strokeWidth={1.5} />
              <input
                type="password"
                placeholder="新しいパスワード（確認用）"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-[#f5f2e6] border-none text-[#333333] text-sm outline-none focus:ring-1 focus:ring-[#333333] transition-all"
                required
                disabled={loading}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'パスワードを変更する'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            type="button" 
            onClick={() => router.push('/verify')}
            disabled={loading}
            className="text-[11px] text-[#666666] hover:text-[#1a1a1a] transition-colors underline underline-offset-4"
          >
            ご本人確認画面へ戻る
          </button>
        </div>
      </div>
    </div>
  )
}