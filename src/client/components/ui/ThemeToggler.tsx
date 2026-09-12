import * as React from 'react'
import { flushSync } from 'react-dom'

/**
 * Animate UI - Theme Toggler Primitive
 * Source: https://animate-ui.com/docs/primitives/effects/theme-toggler
 * Licence: MIT
 */

export type ThemeSelection = 'light' | 'dark' | 'system'
export type Resolved = 'light' | 'dark'
export type Direction = 'btt' | 'ttb' | 'ltr' | 'rtl'

export type ChildrenRender =
  | React.ReactNode
  | ((state: {
      resolved: Resolved
      effective: ThemeSelection
      toggleTheme: (theme: ThemeSelection) => void
    }) => React.ReactNode)

export function getSystemEffective(): Resolved {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function getClipKeyframes(direction: Direction): [string, string] {
  switch (direction) {
    case 'ltr':
      return ['inset(0 100% 0 0)', 'inset(0 0 0 0)']
    case 'rtl':
      return ['inset(0 0 0 100%)', 'inset(0 0 0 0)']
    case 'ttb':
      return ['inset(0 0 100% 0)', 'inset(0 0 0 0)']
    case 'btt':
      return ['inset(100% 0 0 0)', 'inset(0 0 0 0)']
    default:
      return ['inset(0 100% 0 0)', 'inset(0 0 0 0)']
  }
}

export interface ThemeTogglerProps {
  theme: ThemeSelection
  resolvedTheme: Resolved
  setTheme: (theme: ThemeSelection) => void
  direction?: Direction
  onImmediateChange?: (theme: ThemeSelection) => void
  children?: ChildrenRender
}

export function ThemeToggler({
  theme,
  resolvedTheme,
  setTheme,
  onImmediateChange,
  direction = 'ltr',
  children,
  ...props
}: ThemeTogglerProps) {
  const [preview, setPreview] = React.useState<null | {
    effective: ThemeSelection
    resolved: Resolved
  }>(null)

  const [current, setCurrent] = React.useState<{
    effective: ThemeSelection
    resolved: Resolved
  }>({
    effective: theme,
    resolved: resolvedTheme,
  })

  React.useEffect(() => {
    setCurrent({
      effective: theme,
      resolved: resolvedTheme,
    })
  }, [theme, resolvedTheme])

  React.useEffect(() => {
    if (
      preview &&
      theme === preview.effective &&
      resolvedTheme === preview.resolved
    ) {
      setPreview(null)
    }
  }, [theme, resolvedTheme, preview])

  const [fromClip, toClip] = getClipKeyframes(direction)

  const toggleTheme = React.useCallback(
    async (nextTheme: ThemeSelection) => {
      const resolved = nextTheme === 'system' ? getSystemEffective() : nextTheme

      setCurrent({ effective: nextTheme, resolved })
      onImmediateChange?.(nextTheme)

      if (nextTheme === 'system' && resolved === resolvedTheme) {
        setTheme(nextTheme)
        return
      }

      // Check for reduced motion preference (Rule 13)
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

      // If document.startViewTransition is not supported or reduced motion is active, update directly
      const doc = typeof document !== 'undefined' ? (document as Document & {
        startViewTransition?: (updateCallback: () => Promise<void> | void) => {
          ready: Promise<void>
          finished: Promise<void>
        }
      }) : null

      if (!doc?.startViewTransition || prefersReducedMotion) {
        flushSync(() => {
          setPreview({ effective: nextTheme, resolved })
          if (typeof document !== 'undefined') {
            document.documentElement.dataset.theme = resolved
            document.documentElement.classList.toggle('dark', resolved === 'dark')
          }
        })
        setTheme(nextTheme)
        return
      }

      try {
        const transition = doc.startViewTransition(() => {
          flushSync(() => {
            setPreview({ effective: nextTheme, resolved })
            document.documentElement.dataset.theme = resolved
            document.documentElement.classList.toggle(
              'dark',
              resolved === 'dark',
            )
          })
        })

        await transition.ready

        const animation = document.documentElement.animate(
          { clipPath: [fromClip, toClip] },
          {
            duration: 700,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        )

        await animation.finished
      } catch {
        // Fall back gracefully if animation or transition throws
      } finally {
        setTheme(nextTheme)
      }
    },
    [onImmediateChange, resolvedTheme, fromClip, toClip, setTheme],
  )

  return (
    <React.Fragment {...props}>
      {typeof children === 'function'
        ? children({
            effective: current.effective,
            resolved: current.resolved,
            toggleTheme,
          })
        : children}
      <style>{`::view-transition-old(root), ::view-transition-new(root){animation:none;mix-blend-mode:normal;}`}</style>
    </React.Fragment>
  )
}
