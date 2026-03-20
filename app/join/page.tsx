'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ShopJoinPage() {
  const [shopName, setShopName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('') // パスワード用ステート追加
  const [status, setStatus] = useState('')
  const [generatedUrl, setGeneratedUrl] = useState('')
  
  const shareText = "Duacelパートナー登録が完了しました！スタッフの皆さんは、以下のURLから自分の専用ページを発行してください。";

  const handleRegisterShop = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('アカウントと店舗IDを作成中...')

    // 1. Supabase Auth でユーザーを作成（パスワード設定）
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      setStatus('アカウント作成エラー: ' + authError.message)
      return
    }

    const userId = authData.user?.id

    // 2. 現在の店舗数を取得して新しいIDを生成
    const { data: existingShops, error: countError } = await supabase
      .from('shops')
      .select('id')
    
    if (countError) {
      setStatus('エラー: データ取得に失敗しました')
      return
    }

    const nextNumber = (existingShops?.length || 0) + 1
    const newShopId = `S${nextNumber.toString().padStart(3, '0')}`

    // 3. 新しいIDと owner_id (作成したユーザーID) で登録
    const { error: insertError } = await supabase
      .from('shops')
      .insert([{ 
        id: newShopId, 
        name: shopName, 
        owner_email: email,
        owner_id: userId // ここでログインユーザーと店舗を紐付け
      }])

    if (insertError) {
      setStatus('店舗登録エラー: ' + insertError.message)
    } else {
      setStatus(`✅ 「${shopName}」のアカウント作成と店舗登録が完了しました！`)
      setGeneratedUrl(`${window.location.origin}/reg/${newShopId}`)
    }
  }

  // スマホ標準の共有メニュー（変更なし）
  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Duacelスタッフ登録用URL',
          text: shareText,
          url: generatedUrl,
        });
      } catch (error) {
        console.log('Error sharing', error);
      }
    } else {
      navigator.clipboard.writeText(`${shareText}\n${generatedUrl}`);
      alert('URLをコピーしました。');
    }
  };

  return (
    <main style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', color: '#334155' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#2563eb', margin: '0 0 10px 0' }}>Duacel パートナー登録</h1>
        <p style={{ color: '#64748b', margin: 0 }}>サロン情報を入力して、管理アカウントを作成します。</p>
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
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>ログイン用メールアドレス</label>
            <input 
              type="email" 
              placeholder="owner@example.com"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }}
            />
          </div>

          {/* --- パスワード入力欄を追加 --- */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>ログインパスワード設定</label>
            <input 
              type="password" 
              placeholder="6文字以上のパスワード"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              minLength={6}
              required 
              style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }}
            />
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '5px' }}>※登録後、この情報でダッシュボードにログインできます。</p>
          </div>

          <button type="submit" style={{ padding: '16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
            アカウントを作成して招待URLを発行
          </button>
          
          {status && <p style={{ textAlign: 'center', fontSize: '14px', color: '#ef4444', margin: 0 }}>{status}</p>}
        </form>
      ) : (
        // --- 登録完了画面（変更なし） ---
        <div style={{ padding: '30px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <div style={{ fontSize: '50px', marginBottom: '10px' }}>✨</div>
          <h2 style={{ color: '#166534', margin: '0 0 10px 0' }}>オーナー登録完了！</h2>
          <p style={{ color: '#64748b', margin: '0 0 20px 0', fontSize: '15px' }}>設定したメールアドレスとパスワードでログイン可能です。</p>
          
          <div style={{ margin: '0 0 20px 0', padding: '15px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', wordBreak: 'break-all', fontWeight: 'bold', color: '#0369a1', fontSize: '17px' }}>
             スタッフ用URL: {generatedUrl}
          </div>

          <div style={{ maxWidth: '400px', margin: '30px auto 0 auto', borderTop: '1px solid #e2e8f0', paddingTop: '30px' }}>
            <button 
              onClick={handleWebShare}
              style={{ width: '100%', padding: '16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              📲 スタッフに招待URLを送る
            </button>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              オーナー用ログインページ：<br/>
              <a href="/login" style={{ color: '#2563eb' }}>{window.location.origin}/login</a>
            </p>
          </div>
        </div>
      )}
    </main>
  )
}