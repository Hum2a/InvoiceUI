import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Monitor, Moon, Sun } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ThemeToggler as ThemeTogglerPrimitive,
  type ThemeTogglerProps as ThemeTogglerPrimitiveProps,
  type ThemeSelection,
  type Resolved,
  type Direction,
} from './ThemeToggler'
import { useTheme } from '../../context/ThemeContext'
import { cn } from '../../lib/utils'

/**
 * Animate UI - Theme Toggler Button
 * Source: https://animate-ui.com/docs/components/buttons/theme-toggler
 * Author: imskyleen (https://github.com/imskyleen)
 * Licence: MIT
 * Credits: shadcn/ui for button styling, Magic UI for component inspiration
 */

export const themeTogglerButtonVariants = cva(
  'inline-flex items-center justify-center rounded-xl font-medium transition-[box-shadow,color,background-color,border-color,transform] duration-200 disabled:pointer-events-none disabled:opacity-50 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 select-none active:scale-[0.98] active:translate-y-[1px]',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--ink)] text-[var(--card)] hover:opacity-90 shadow-xs',
        accent:
          'bg-[var(--lime)] text-[var(--ink)] hover:opacity-90 shadow-xs',
        destructive:
          'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
        outline:
          'border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] hover:bg-[var(--soft)] hover:border-[#a1a1aa]',
        secondary:
          'bg-[var(--card)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--soft)] hover:border-[#a1a1aa] shadow-xs',
        ghost:
          'bg-transparent text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--ink)]',
        link:
          'text-[var(--ink)] underline-offset-4 hover:underline bg-transparent',
      },
      size: {
        default: 'h-9 w-9 p-0 [&_svg]:size-4',
        xs: 'h-7 w-7 p-0 [&_svg]:size-3.5 rounded-lg',
        sm: 'h-8 w-8 p-0 [&_svg]:size-4 rounded-lg',
        lg: 'h-10 w-10 p-0 [&_svg]:size-5 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export function getNextTheme(
  effective: ThemeSelection,
  modes: ThemeSelection[],
): ThemeSelection {
  const i = modes.indexOf(effective)
  if (i === -1) return modes[0] || 'light'
  return modes[(i + 1) % modes.length]
}

export function renderThemeIcon(
  effective: ThemeSelection,
  resolved: Resolved,
  modes: ThemeSelection[],
) {
  const activeIconKey = modes.includes('system') && effective === 'system' ? 'system' : resolved

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={activeIconKey}
        initial={{ opacity: 0, rotate: -30, scale: 0.8 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        exit={{ opacity: 0, rotate: 30, scale: 0.8 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="inline-flex items-center justify-center pointer-events-none"
      >
        {activeIconKey === 'system' ? (
          <Monitor aria-hidden="true" className="size-4 shrink-0" />
        ) : activeIconKey === 'dark' ? (
          <Moon aria-hidden="true" className="size-4 shrink-0" />
        ) : (
          <Sun aria-hidden="true" className="size-4 shrink-0" />
        )}
      </motion.span>
    </AnimatePresence>
  )
}

export interface ThemeTogglerButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof themeTogglerButtonVariants> {
  modes?: ThemeSelection[]
  direction?: Direction
  onImmediateChange?: ThemeTogglerPrimitiveProps['onImmediateChange']
}

export function ThemeTogglerButton({
  variant = 'default',
  size = 'default',
  modes = ['light', 'dark'],
  direction = 'ltr',
  onImmediateChange,
  onClick,
  className,
  title,
  'aria-label': ariaLabel,
  ...props
}: ThemeTogglerButtonProps) {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <ThemeTogglerPrimitive
      theme={theme}
      resolvedTheme={resolvedTheme}
      setTheme={setTheme}
      direction={direction}
      onImmediateChange={onImmediateChange}
    >
      {({ effective, resolved, toggleTheme }) => {
        const nextTheme = getNextTheme(effective, modes)
        const computedTitle =
          title || `Switch theme: currently ${effective} (click for ${nextTheme})`
        const computedAriaLabel =
          ariaLabel || `Toggle theme (currently ${effective}, next ${nextTheme})`

        return (
          <button
            type="button"
            data-slot="theme-toggler-button"
            data-theme-current={effective}
            data-theme-next={nextTheme}
            className={cn(
              themeTogglerButtonVariants({ variant, size }),
              className,
            )}
            onClick={(e) => {
              onClick?.(e)
              toggleTheme(nextTheme)
            }}
            title={computedTitle}
            aria-label={computedAriaLabel}
            {...props}
          >
            {renderThemeIcon(effective, resolved, modes)}
          </button>
        )
      }}
    </ThemeTogglerPrimitive>
  )
}

export {
  ThemeTogglerPrimitive,
  type ThemeTogglerPrimitiveProps,
  type ThemeSelection,
  type Resolved,
  type Direction,
}
