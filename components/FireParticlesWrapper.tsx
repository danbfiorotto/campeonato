'use client'

import dynamic from 'next/dynamic'

const FireParticles = dynamic(() => import('@/components/FireParticles'), {
  ssr: false
})

export default function FireParticlesWrapper() {
  return (
    <div className="absolute inset-0 w-full h-full bg-transparent">
      <FireParticles />
    </div>
  )
}

