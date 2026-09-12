import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useSpring, useReducedMotion } from 'motion/react'
import { cn } from '../ui'

/**
 * Magic UI - Number Ticker
 * Source: https://magicui.design/docs/components/number-ticker
 * License: MIT
 */
export function NumberTicker({
  value,
  currency,
  decimalPlaces = 2,
  className,
}: {
  value: number
  currency?: string
  decimalPlaces?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, {
    damping: 30,
    stiffness: 150,
  })
  const isInView = useInView(ref, { once: true, margin: '0px' })
  const shouldReduceMotion = useReducedMotion()

  const format = (val: number) => {
    if (currency) {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency,
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(val)
    }
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(val)
  }

  useEffect(() => {
    if (isInView) {
      motionValue.set(value)
    }
  }, [motionValue, isInView, value])

  useEffect(() => {
    if (shouldReduceMotion) {
      if (ref.current) {
        ref.current.textContent = format(value)
      }
      return
    }

    const unsubscribe = springValue.on('change', latest => {
      if (ref.current) {
        ref.current.textContent = format(latest)
      }
    })
    return () => unsubscribe()
  }, [springValue, value, currency, decimalPlaces, shouldReduceMotion])

  return (
    <span
      ref={ref}
      aria-label={format(value)}
      className={cn('inline-block tabular-nums tracking-tight', className)}
    >
      {format(value)}
    </span>
  )
}
