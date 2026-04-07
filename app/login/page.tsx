'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, Phone, KeyRound, ArrowRight } from 'lucide-react'

export default function Login() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 日本の電話番号「090...」を、Twilio用の「+8190...」に変換する裏技
  const formatPhoneNumber = (num: string) => {
    const cleaned = num.replace(/[^0-9]/g, '') // ハイフン等を除去
    if (cleaned.startsWith('0')) {
      return '+81' + cleaned.slice(1)
    }
    return '+' + cleaned
  }

  // SMSを送信する処理
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const formattedPhone = formatPhoneNumber(phone)
      
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      })

      if (error) throw error

      // 成功したら認証コード入力画面へ切り替え
      setStep(2)
    } catch (err: any) {
      console.error(err)
      setError('SMSの送信に失敗しました。電話番号をご確認ください。')
    } finally {
      setLoading(false)
    }
  }

  // 認証コードを確認してログインする処理
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const formattedPhone = formatPhoneNumber(phone)
      
      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms'
      })

      if (error) throw error

      // ログイン成功後、ダッシュボードへ
      // ※今後、Admin権限等の振り分けもここで行います
      router.push('/dashboard')
    } catch (err: any) {
      console.error(err)
      setError('認証コードが間違っているか、有効期限が切れています。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* ヘッダー部分 */}
        <div className="bg-gray-900 px-6 py-8 text-center">
          <img src="/logo-duacel.svg" alt="Duacel" className="h-8 mx-auto mb-4 invert" onError={(e) => e.currentTarget.style.display = 'none'} />
          <h1 className="text-xl font-black text-white tracking-wider">メンバーログイン</h1>
          <p className="text-gray-400 text-xs mt-2 font-medium">ご登録の電話番号に認証コードを送信します</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-lg text-center">
              {error}
            </div>
          )}

          {/* STEP 1: 電話番号入力 */}
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">携帯電話番号</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="090-0000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-gray-900 focus:border-transparent font-mono text-lg transition-all"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || phone.length < 10}
                className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SMSに認証コードを送る'}
              </button>
            </form>
          )}

          {/* STEP 2: 認証コード入力 */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="text-center mb-6">
                <p className="text-sm font-bold text-gray-700">{phone}</p>
                <p className="text-xs text-gray-500 mt-1">宛に6桁のコードを送信しました</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">認証コード (6桁)</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-2xl tracking-widest text-center transition-all"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '認証してログイン'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep(1); setOtp(''); }}
                  className="w-full py-2 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors"
                >
                  電話番号を入力し直す
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}