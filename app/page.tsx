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
      alert('リファラルID（クッキー）が見つかりません。紹介URLからアクセスしてください。')
      return
    }

    setStatus('Supabaseに成果を保存中...')

    const parts = referralId.split('_')
    const shopId = parts[0]
    const staffId = parts[1]

    // 1. Supabaseへ保存
    const { error } = await supabase
      .from('referrals')
      .insert([
        { 
          referral_code: referralId,
          shop_id: shopId,
          staff_id: staffId,
          order_number: `ORD-${Date.now()}`,
          status: 'pending',
          incentive_status: 'unpaid'
        }
      ])

    if (error) {
      console.error('保存エラー詳細:', error)
      setStatus('エラー発生: ' + error.message)
      return // エラー時はここで終了
    }

    // 2. ★ここで Make (Webhook) に通知を送る★
    try {
      setStatus('通知を送信中...')
      
      const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/1w9q1sb6qon2mzlbgx883b666535jfym'

      await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shopId,
          staff_id: staffId,
          referral_code: referralId,
          order_id: `ORD-${Date.now()}`,
          event: 'purchase_complete'
        })
      })

      setStatus('✅ 成果記録 ＆ 通知完了！')
    } catch (err) {
      console.error('通知エラー:', err)
      setStatus('✅ 成果記録完了（通知のみ失敗）')
    }
  }

  return (
    <main style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#1e293b' }}>Duacel プロダクトページ (テスト)</h1>
      
      <div style={{ marginTop: '30px', padding: '25px', border: '2px solid #10b981', borderRadius: '15px', backgroundColor: '#f0fdf4', textAlign: 'left' }}>
        <h2 style={{ fontSize: '16px', color: '#059669', marginTop: 0 }}>紹介セッション情報</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0 }}>現在の紹介コード: <strong style={{ color: '#059669' }}>{referralId || "なし"}</strong></p>
          <div style={{ fontSize: '14px', color: '#64748b', backgroundColor: '#fff', padding: '10px', borderRadius: '8px' }}>
            分析：店舗ID {referralId?.split('_')[0] || "---"} / スタッフID {referralId?.split('_')[1] || "---"}
          </div>
        </div>
      </div>

      <button 
        onClick={handlePurchase}
        style={{ 
          marginTop: '40px', 
          padding: '20px 50px', 
          fontSize: '20px', 
          cursor: 'pointer', 
          backgroundColor: '#2563eb', 
          color: 'white', 
          border: 'none', 
          borderRadius: '12px', 
          fontWeight: 'bold',
          boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)'
        }}
      >
        テスト注文を確定する
      </button>

      {status && (
        <div style={{ 
          marginTop: '30px', 
          padding: '15px', 
          fontSize: '16px', 
          fontWeight: 'bold', 
          borderRadius: '8px',
          backgroundColor: status.includes('✅') ? '#dcfce7' : '#fee2e2',
          color: status.includes('✅') ? '#166534' : '#991b1b'
        }}>
          {status}
        </div>
      )}


<br />
テスト用<br />
<a href="https://duacel-referral.vercel.app/admin" target="_blank"><u>システム管理画面</u></a>　|　<a href="https://duacel-referral.vercel.app/login" target="_blank"><u>ショップオーナー管理画面</u></a>



      <footer style={{ marginTop: '60px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
        <p style={{ fontSize: '12px', color: '#94a3b8' }}>
          ※このボタンを押すと、Supabaseへの記録と同時にMakeへ通知が飛びます。
        </p>
      </footer>
    </main>
  )
}