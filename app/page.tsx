'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [referralId, setReferralId] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const id = document.cookie
      .split('; ')
      .find(row => row.startsWith('referral_id='))
      ?.split('=')[1]
    
    if (id) setReferralId(id)
  }, [])

  const handlePurchase = async () => {
    if (!referralId) {
      alert('リファラルID（クッキー）が見つかりません')
      return
    }

    setStatus('Supabaseに保存中...')

    // 「S001_ST001」から「ST001」の部分だけを取り出す
    const staffId = referralId.split('_')[1] 

    // 本番テーブル「referrals」に合わせてデータを挿入
    const { error } = await supabase
      .from('referrals')
      .insert([
        { 
          staff_id: staffId,           // 'ST001'
          order_number: `ORD-${Date.now()}`, // テスト用にユニークな注文番号を生成
          status: 'pending',           // デフォルト値
          incentive_status: 'unpaid'   // デフォルト値
        }
      ])

    if (error) {
      console.error('保存エラー詳細:', error)
      setStatus('エラー発生: ' + error.message)
    } else {
      setStatus('✅ referralsテーブルに保存成功！')
    }
  }

  return (
    <main style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Duacel リファラルシステム本番テスト</h1>
      
      <div style={{ marginTop: '30px', padding: '30px', border: '2px solid #10b981', borderRadius: '10px', backgroundColor: '#f0fdf4' }}>
        <p>保持しているコード: <strong style={{ fontSize: '24px', color: '#059669' }}>{referralId || "なし"}</strong></p>
        <p>保存されるスタッフID: <strong style={{ fontSize: '24px', color: '#059669' }}>{referralId?.split('_')[1] || "なし"}</strong></p>
      </div>

      <button 
        onClick={handlePurchase}
        style={{ marginTop: '30px', padding: '15px 40px', fontSize: '18px', cursor: 'pointer', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}
      >
        テスト注文を実行（保存）
      </button>

      <div style={{ marginTop: '20px', fontSize: '18px', fontWeight: 'bold' }}>{status}</div>
    </main>
  )
}