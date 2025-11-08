import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPanel } from '@/components/admin/admin-panel'
import { Shield } from 'lucide-react'

export default async function AdminPage() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mb-8 md:mb-12 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Shield className="w-8 h-8 md:w-10 md:h-10 text-blue-400" />
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-extrabold text-white">
            Painel Administrativo
          </h1>
        </div>
        <p className="text-lg md:text-xl text-neutral-300">
          Gerencie séries, partidas e jogadores do campeonato
        </p>
      </div>
      <AdminPanel />
    </div>
  )
}

