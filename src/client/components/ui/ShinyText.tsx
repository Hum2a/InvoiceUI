import type { ReactNode } from 'react'
import { cn } from '../ui'

/**
 * React Bits - Shiny Text
 * Source: https://reactbits.dev/text-animations/shiny-text
 * License: MIT
 */
export function ShinyText({
  children,
  className,
  shimmerWidth = 100,
}: {
  children: ReactNode
  className?: string
  shimmerWidth?: number
}) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center text-transparent bg-clip-text',
        'bg-gradient-to-r from-lime-600 via-lime-400 to-lime-600 dark:from-lime-400 dark:via-lime-200 dark:to-lime-400',
        'animate-[shimmer_2.5s_infinite]',
        className
      )}
      style={{
        backgroundSize: `${shimmerWidth}% 100%`,
      }}
    >
      {children}
    </span>
  )
}
