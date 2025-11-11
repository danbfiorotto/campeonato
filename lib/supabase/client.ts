import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Variáveis de ambiente do Supabase não configuradas!\n\n' +
      'Por favor, crie um arquivo .env.local na raiz do projeto com:\n' +
      'NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co\n' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-key\n\n' +
      'Você pode copiar o arquivo .env.local.example como referência.\n' +
      'Encontre essas credenciais em: https://supabase.com/dashboard/project/_/settings/api'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

