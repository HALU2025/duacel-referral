'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ShopJoinPage() {
  const [shopName, setShopName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [generatedUrl, setGeneratedUrl] = useState('')

  const handleRegisterShop = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('店舗IDを発行中...')

    // 1. 現在の店舗数を取得して新しいIDを生成 (例: S001, S002...)
    const { data: existingShops, error: countError } = await supabase
      .from('shops')
      .select('id')
    
    if (countError) {
      setStatus('エラー: データ取得に失敗しました')
      return
    }

    // 次のIDを決定 (S + 3桁の連番)
    const nextNumber = (existingShops?.length || 0) + 1
    const newShopId = `S${nextNumber.toString().padStart(3, '0')}` // S001, S002...

    // 2. 新しいIDで登録
    const { error: insertError } = await supabase
      .from('shops')
      .insert([{ 
        id: newShopId, 
        name: shopName, 
        owner_email: email 
      }])

    if (insertError) {
      setStatus('登録エラー: ' + insertError.message)
    } else {
      setStatus(`✅ 「${shopName}」の登録が完了しました！ (店舗ID: ${newShopId})`)
      setGeneratedUrl(`${window.location.origin}/reg/${newShopId}`)
    }
  }

  return (
    <main style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#2563eb' }}>Duacel パートナー登録</h1>
        <p style={{ color: '#64748b' }}>サロン情報を入力して、スタッフ専用ページを発行します。</p>
      </header>

      {!generatedUrl ? (
        <form onSubmit={handleRegisterShop} style={{ display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>店舗名</label>
            <input 
              placeholder="例: サロン・ド・デュアセル 渋谷店"
              value={shopName} 
              onChange={(e) => setShopName(e.target.value)} 
              required 
              style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>オーナー連絡先メールアドレス</label>
            <input 
              type="email" 
              placeholder="owner@example.com"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }}
            />
          </div>

          <button type="submit" style={{ padding: '16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
            登録してスタッフ招待URLを発行
          </button>
          
          {status && <p style={{ textAlign: 'center', fontSize: '14px', color: '#ef4444' }}>{status}</p>}
        </form>
      ) : (
        <div style={{ padding: '30px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', textAlign: 'center' }}>
          <h2 style={{ color: '#166534' }}>登録完了！</h2>
          <p>以下のURLをスタッフの皆さんに共有してください：</p>
          <div style={{ margin: '20px 0', padding: '15px', backgroundColor: 'white', border: '1px solid #dcfce7', borderRadius: '8px', wordBreak: 'break-all', fontWeight: 'bold', color: '#2563eb' }}>
            {generatedUrl}
          </div>
          <button 
            onClick={() => { navigator.clipboard.writeText(generatedUrl); alert('コピーしました！'); }}
            style={{ padding: '12px 24px', backgroundColor: '#166534', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            URLをコピーする
          </button>
        </div>
      )}
    </main>
  )
}