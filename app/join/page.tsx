'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ShopJoinPage() {
  const [shopName, setShopName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [generatedUrl, setGeneratedUrl] = useState('')
  // シェア用テキストの定義
  const shareText = "Duacelパートナー登録が完了しました！スタッフの皆さんは、以下のURLから自分の専用ページを発行してください。";

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
      // window.location.origin を使用して実環境のドメインに対応
      setGeneratedUrl(`${window.location.origin}/reg/${newShopId}`)
    }
  }

  // スマホ標準の共有メニューを呼び出す関数
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
      // 非対応ブラウザ用のフォールバック（コピー）
      navigator.clipboard.writeText(`${shareText}\n${generatedUrl}`);
      alert('URLをコピーしました。メッセージに貼り付けて共有してください。');
    }
  };

  return (
    <main style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif',color: '#334155' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#2563eb', margin: '0 0 10px 0' }}>Duacel パートナー登録</h1>
        <p style={{ color: '#64748b', margin: 0 }}>サロン情報を入力して、スタッフ専用ページを発行します。</p>
      </header>

      {!generatedUrl ? (
        // --- 登録フォーム（変更なし） ---
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
          
          {status && <p style={{ textAlign: 'center', fontSize: '14px', color: '#ef4444', margin: 0 }}>{status}</p>}
        </form>
      ) : (
        // --- 登録完了画面（ここを拡張） ---
        <div style={{ padding: '30px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <div style={{ fontSize: '50px', marginBottom: '10px' }}>✅</div>
          <h2 style={{ color: '#166534', margin: '0 0 10px 0' }}>登録完了！</h2>
          <p style={{ color: '#64748b', margin: '0 0 20px 0', fontSize: '15px' }}>以下のURLをスタッフの皆さんに共有してください：</p>
          
          {/* URL表示エリア */}
          <div style={{ margin: '0 0 20px 0', padding: '15px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', wordBreak: 'break-all', fontWeight: 'bold', color: '#2563eb', fontSize: '17px' }}>
            {generatedUrl}
          </div>

          {/* --- 共有セクション (ここを追加) --- */}
          <div style={{ maxWidth: '400px', margin: '30px auto 0 auto', borderTop: '1px solid #e2e8f0', paddingTop: '30px' }}>
            
            {/* メイン共有ボタン（Web Share API） */}
            <button 
              onClick={handleWebShare}
              style={{ width: '100%', padding: '16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}
            >
              📲 スマホで送る（LINE・DM・他）
            </button>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '25px', marginBottom: '30px' }}>
              {/* LINE専用ボタン */}
              <a 
                href={`https://line.me/R/msg/text/?${encodeURIComponent(shareText + "\n" + generatedUrl)}`} 
                target="_blank" 
                rel="noreferrer"
                style={{ textDecoration: 'none', textAlign: 'center' }}
              >
                <div style={{ width: '55px', height: '55px', backgroundColor: '#06C755', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px auto', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <span style={{ color: 'white', fontSize: '11px', fontWeight: 'bold' }}>LINE</span>
                </div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>LINE</span>
              </a>

              {/* インスタDM用（コピー誘導） */}
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(generatedUrl);
                  alert('URLをコピーしました。インスタのDMに貼り付けてください。');
                }}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'center' }}
              >
                <div style={{ width: '55px', height: '55px', background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px auto', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <span style={{ color: 'white', fontSize: '11px', fontWeight: 'bold' }}>DM</span>
                </div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Instagram</span>
              </button>
            </div>

            {/* QRコード（现场用） */}
            <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1', display: 'inline-block' }}>
               <img 
                src={`https://quickchart.io/qr?text=${encodeURIComponent(generatedUrl)}&size=150`} 
                alt="Registration QR"
                style={{ width: '130px', height: '130px', display: 'block' }}
               />
               <p style={{ fontSize: '12px', color: '#94a3b8', margin: '10px 0 0 0' }}>現場で読み取る用</p>
            </div>
          </div>
          {/* --- 共有セクション ここまで --- */}

        </div>
      )}
    </main>
  )
}