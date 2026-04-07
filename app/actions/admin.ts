// app/actions/admin.ts
'use server'

import { createClient } from '@supabase/supabase-js'

export async function createAdminUserAction(email: string, password: string) {
  try {
    // ⚠️ Supabaseの「Service Role Key（全権限キー）」を使って接続します
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Auth（認証）に新しいユーザーを作成（メール確認はスキップ）
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) throw new Error(authError.message)
    if (!authData.user) throw new Error('ユーザーの作成に失敗しました。')

    // 2. VIPルーム（system_adminsテーブル）に追加
    const { error: dbError } = await supabaseAdmin
      .from('system_admins')
      .insert([{ id: authData.user.id, email: email }])

    if (dbError) throw new Error(dbError.message)

    return { success: true }
  } catch (error: any) {
    console.error('Admin creation error:', error)
    return { success: false, error: error.message }
  }
}