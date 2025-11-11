'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface AnimatedScoreProps {
  score: number
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-4xl sm:text-5xl md:text-6xl lg:text-8xl xl:text-9xl font-extrabold'
}

export function AnimatedScore({ score, className = '', size = 'lg' }: AnimatedScoreProps) {
  return (
    <motion.span
      key={score}
      initial={{ y: -20, opacity: 0, scale: 0.5 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
        mass: 0.8
      }}
      className={`${sizeClasses[size]} ${className}`}
    >
      {score}
    </motion.span>
  )
}

