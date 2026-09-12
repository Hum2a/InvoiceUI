import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { renderToString } from 'react-dom/server'
import {
  getClipKeyframes,
  getSystemEffective,
} from '../src/client/components/ui/ThemeToggler'
import {
  ThemeTogglerButton,
  getNextTheme,
  themeTogglerButtonVariants,
} from '../src/client/components/ui/ThemeTogglerButton'
import { ThemeProvider } from '../src/client/context/ThemeContext'

describe('Animate UI Theme Toggler Button & Primitive', () => {
  describe('getClipKeyframes', () => {
    it('returns accurate clip-path keyframes for left-to-right (ltr)', () => {
      const [from, to] = getClipKeyframes('ltr')
      expect(from).toBe('inset(0 100% 0 0)')
      expect(to).toBe('inset(0 0 0 0)')
    })

    it('returns accurate clip-path keyframes for right-to-left (rtl)', () => {
      const [from, to] = getClipKeyframes('rtl')
      expect(from).toBe('inset(0 0 0 100%)')
      expect(to).toBe('inset(0 0 0 0)')
    })

    it('returns accurate clip-path keyframes for top-to-bottom (ttb)', () => {
      const [from, to] = getClipKeyframes('ttb')
      expect(from).toBe('inset(0 0 100% 0)')
      expect(to).toBe('inset(0 0 0 0)')
    })

    it('returns accurate clip-path keyframes for bottom-to-top (btt)', () => {
      const [from, to] = getClipKeyframes('btt')
      expect(from).toBe('inset(100% 0 0 0)')
      expect(to).toBe('inset(0 0 0 0)')
    })
  })

  describe('getNextTheme', () => {
    it('cycles between light and dark when modes are default [light, dark]', () => {
      const modes: ('light' | 'dark')[] = ['light', 'dark']
      expect(getNextTheme('light', modes)).toBe('dark')
      expect(getNextTheme('dark', modes)).toBe('light')
      // If current effective is unknown or system, falls back to first mode
      expect(getNextTheme('system', modes)).toBe('light')
    })

    it('cycles light -> dark -> system -> light when modes includes system', () => {
      const modes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system']
      expect(getNextTheme('light', modes)).toBe('dark')
      expect(getNextTheme('dark', modes)).toBe('system')
      expect(getNextTheme('system', modes)).toBe('light')
    })
  })

  describe('themeTogglerButtonVariants', () => {
    it('includes tactile press feedback scale(0.98) in base classes', () => {
      const classes = themeTogglerButtonVariants()
      expect(classes).toContain('active:scale-[0.98]')
      expect(classes).toContain('active:translate-y-[1px]')
      expect(classes).toContain('transition-')
    })

    it('applies variant classes correctly', () => {
      expect(themeTogglerButtonVariants({ variant: 'default' })).toContain('bg-[var(--ink)]')
      expect(themeTogglerButtonVariants({ variant: 'accent' })).toContain('bg-[var(--lime)]')
      expect(themeTogglerButtonVariants({ variant: 'ghost' })).toContain('bg-transparent')
      expect(themeTogglerButtonVariants({ variant: 'outline' })).toContain('border')
      expect(themeTogglerButtonVariants({ variant: 'secondary' })).toContain('bg-[var(--card)]')
      expect(themeTogglerButtonVariants({ variant: 'destructive' })).toContain('bg-rose-50')
    })

    it('applies size classes correctly', () => {
      expect(themeTogglerButtonVariants({ size: 'default' })).toContain('h-9 w-9')
      expect(themeTogglerButtonVariants({ size: 'sm' })).toContain('h-8 w-8')
      expect(themeTogglerButtonVariants({ size: 'xs' })).toContain('h-7 w-7')
      expect(themeTogglerButtonVariants({ size: 'lg' })).toContain('h-10 w-10')
    })
  })

  describe('getSystemEffective', () => {
    it('returns light or dark without throwing in node environment', () => {
      const effective = getSystemEffective()
      expect(['light', 'dark']).toContain(effective)
    })
  })

  describe('ThemeTogglerButton HTML Rendering', () => {
    it('renders button with data-slot="theme-toggler-button"', () => {
      const html = renderToString(
        <ThemeProvider defaultTheme="light">
          <ThemeTogglerButton />
        </ThemeProvider>,
      )

      expect(html).toContain('data-slot="theme-toggler-button"')
      expect(html).toContain('type="button"')
      expect(html).toContain('Switch theme:')
      expect(html).toContain('Toggle theme')
    })

    it('renders with ghost variant and sm size for app header', () => {
      const html = renderToString(
        <ThemeProvider defaultTheme="dark">
          <ThemeTogglerButton
            variant="ghost"
            size="sm"
            modes={['light', 'dark', 'system']}
            title="Toggle light, dark, or system theme"
            aria-label="Toggle editor theme"
          />
        </ThemeProvider>,
      )

      expect(html).toContain('h-8 w-8')
      expect(html).toContain('bg-transparent')
      expect(html).toContain('title="Toggle light, dark, or system theme"')
      expect(html).toContain('aria-label="Toggle editor theme"')
    })

    it('renders SVG icon markup for theme state', () => {
      const htmlLight = renderToString(
        <ThemeProvider defaultTheme="light">
          <ThemeTogglerButton modes={['light', 'dark']} />
        </ThemeProvider>,
      )
      expect(htmlLight).toContain('<svg')

      const htmlDark = renderToString(
        <ThemeProvider defaultTheme="dark">
          <ThemeTogglerButton modes={['light', 'dark']} />
        </ThemeProvider>,
      )
      expect(htmlDark).toContain('<svg')
    })

    it('renders style tag for view-transition overrides', () => {
      const html = renderToString(
        <ThemeProvider defaultTheme="light">
          <ThemeTogglerButton />
        </ThemeProvider>,
      )

      expect(html).toContain('::view-transition-old(root), ::view-transition-new(root)')
    })

    it('strictly satisfies Rule 12 with regular dashes only', () => {
      const html = renderToString(
        <ThemeProvider defaultTheme="system">
          <ThemeTogglerButton modes={['light', 'dark', 'system']} />
        </ThemeProvider>,
      )

      expect(html).not.toMatch(/[\u2013\u2014]/)
    })
  })
})
