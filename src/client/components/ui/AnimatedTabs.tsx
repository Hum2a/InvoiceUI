import { motion } from 'motion/react'
import { cn } from '../ui'

/**
 * Animate UI - Animated Tabs
 * Source: https://animate-ui.com/docs/components/animated-tabs
 * License: MIT
 */
export function AnimatedTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
}: {
  tabs: string[]
  activeTab: string
  onTabChange: (tab: string) => void
  className?: string
}) {
  return (
    <nav
      role="tablist"
      aria-label="Main navigation"
      className={cn('relative flex items-center gap-1', className)}
    >
      {tabs.map(tab => {
        const isActive = activeTab === tab
        return (
          <button
            key={tab}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onTabChange(tab)}
            className={cn(
              'relative px-3 py-1.5 text-sm font-medium transition-colors rounded-lg z-10',
              isActive
                ? 'text-[var(--text)] font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-[var(--text)]'
            )}
          >
            {isActive && (
              <motion.span
                layoutId="active-tab-indicator"
                className="absolute inset-0 bg-[var(--soft)] rounded-lg -z-10 shadow-sm border border-black/5 dark:border-white/10"
                transition={{
                  type: 'spring',
                  bounce: 0.15,
                  duration: 0.4,
                }}
              />
            )}
            {tab}
          </button>
        )
      })}
    </nav>
  )
}
