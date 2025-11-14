'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DeleteButtonProps {
  type: 'job' | 'draft'
  id: string
  onDeleted?: () => void
}

export function DeleteButton({ type, id, onDeleted }: DeleteButtonProps) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm(`Tem certeza que deseja deletar este ${type === 'job' ? 'job' : 'draft'}? Esta ação não pode ser desfeita.`)) {
      return
    }

    setDeleting(true)

    try {
      console.log(`[DELETE] Deletando ${type}:`, id)
      const response = await fetch(`/api/ingest/delete?type=${type}&id=${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || result.error || 'Erro ao deletar')
      }

      console.log(`[DELETE] ✅ ${type} deletado com sucesso`)
      
      if (onDeleted) {
        onDeleted()
      } else {
        // Recarregar a página se não houver callback
        window.location.reload()
      }
    } catch (error: any) {
      console.error(`[DELETE] ❌ Erro ao deletar ${type}:`, error)
      alert(`Erro ao deletar: ${error.message || 'Erro desconhecido'}`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={deleting}
      className="inline-flex items-center justify-center h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
      title={`Deletar ${type === 'job' ? 'job' : 'draft'}`}
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  )
}

