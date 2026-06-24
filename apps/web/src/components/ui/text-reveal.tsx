'use client'

import { useRef, type ReactNode } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { cn } from '@/lib/utils'

/** Testo che si rivela parola per parola allo scroll (adattato da magicui/text-reveal). */
export function TextReveal({ text, className }: { text: string; className?: string }) {
  const targetRef = useRef<HTMLDivElement | null>(null)
  const { scrollYProgress } = useScroll({ target: targetRef })
  const words = text.split(' ')

  return (
    <div ref={targetRef} className={cn('relative z-0 h-[180vh]', className)}>
      <div className="sticky top-0 mx-auto flex h-screen max-w-4xl items-center px-6">
        <p className="flex flex-wrap font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {words.map((w, i) => {
            const start = i / words.length
            const end = start + 1 / words.length
            return <Word key={i} progress={scrollYProgress} range={[start, end]}>{w}</Word>
          })}
        </p>
      </div>
    </div>
  )
}

function Word({ children, progress, range }: { children: ReactNode; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0, 1])
  return (
    <span className="relative mx-1.5 lg:mx-2">
      <span className="absolute opacity-15">{children}</span>
      <motion.span style={{ opacity }} className="text-text">{children}</motion.span>
    </span>
  )
}
