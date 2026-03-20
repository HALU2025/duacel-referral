import { createClient } from '@supabase/supabase-js'

// .env.local に書いた情報を読み込む
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// これが「Supabase操作用リモコン」の実体です
export const supabase = createClient(supabaseUrl, supabaseAnonKey)