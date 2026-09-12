import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type ButtonHTMLAttributes,
  type MouseEvent,
} from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '../../lib/utils'
import { RefreshCw, Check } from './AnimatedIcon'
import { cva } from 'class-variance-authority'

/**
 * Magic UI - Animated Subscribe Button / Interactive State Button
 * Source: https://magicui.design/docs/components/animated-subscribe-button
 * Integrates Motion transitions and Animate UI icons (RefreshCw, Check).
 * License: MIT
 */

const buttonStyles = cva('button', {
  variants: {
    variant: {
      primary: 'primary',
      secondary: 'secondary',
      ghost: 'ghost',
      danger: 'danger',
    },
  },
  defaultVariants: {
    variant: 'secondary',
  },
})

export type ButtonStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface StateButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  status?: ButtonStatus
  saving?: boolean
  idleText?: ReactNode
  savingText?: ReactNode
  savedText?: ReactNode
  errorText?: ReactNode
  idleIcon?: ReactNode
  savingIcon?: ReactNode
  savedIcon?: ReactNode
  iconSize?: number
  successDuration?: number
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void | Promise<unknown>
}

export function StateButton({
  variant = 'secondary',
  status: controlledStatus,
  saving: savingProp,
  idleText,
  savingText = 'Saving...',
  savedText = 'Saved!',
  errorText = 'Save failed',
  idleIcon,
  savingIcon,
  savedIcon,
  iconSize = 13,
  successDuration = 1800,
  className,
  children,
  disabled,
  onClick,
  type = 'button',
  ...props
}: StateButtonProps) {
  const [internalStatus, setInternalStatus] = useState<ButtonStatus>('idle')
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevSavingPropRef = useRef(Boolean(savingProp))

  // Handle external saving boolean transition
  useEffect(() => {
    const isCurrentlySaving = Boolean(savingProp)
    if (prevSavingPropRef.current && !isCurrentlySaving && !disabled) {
      // Completed saving externally: show saved state
      setInternalStatus('saved')
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => {
        setInternalStatus('idle')
      }, successDuration)
    } else if (isCurrentlySaving) {
      setInternalStatus('saving')
    }
    prevSavingPropRef.current = isCurrentlySaving
  }, [savingProp, successDuration, disabled])

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  // Resolve current active status
  let currentStatus: ButtonStatus = internalStatus
  if (controlledStatus !== undefined) {
    currentStatus = controlledStatus
  } else if (savingProp !== undefined) {
    currentStatus = savingProp ? 'saving' : internalStatus
  }

  const isSaving = currentStatus === 'saving'
  const isSaved = currentStatus === 'saved'
  const isError = currentStatus === 'error'

  const handleClick = async (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled || isSaving) {
      e.preventDefault()
      return
    }

    if (!onClick) return

    try {
      const result = onClick(e)
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        setInternalStatus('saving')
        await result
        setInternalStatus('saved')
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
        resetTimerRef.current = setTimeout(() => {
          setInternalStatus('idle')
        }, successDuration)
      }
    } catch (err) {
      setInternalStatus('error')
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => {
        setInternalStatus('idle')
      }, 2000)
      throw err
    }
  }

  const effectiveDisabled = disabled || isSaving

  return (
    <button
      type={type}
      className={cn(
        buttonStyles({ variant }),
        'relative inline-flex items-center justify-center transition-all select-none',
        isSaved && 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
        className
      )}
      disabled={effectiveDisabled}
      onClick={handleClick}
      aria-live="polite"
      aria-busy={isSaving}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isSaving ? (
          <motion.span
            key="saving"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-1.5"
          >
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.85, ease: 'linear' }}
              className="inline-flex items-center justify-center"
            >
              {savingIcon ?? <RefreshCw size={iconSize} />}
            </motion.span>
            <span>{savingText}</span>
          </motion.span>
        ) : isSaved ? (
          <motion.span
            key="saved"
            initial={{ opacity: 0, y: 5, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ type: 'spring', stiffness: 450, damping: 24 }}
            className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium"
          >
            <motion.span
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              className="inline-flex items-center justify-center"
            >
              {savedIcon ?? <Check size={iconSize} />}
            </motion.span>
            <span>{savedText}</span>
          </motion.span>
        ) : isError ? (
          <motion.span
            key="error"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.16 }}
            className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium"
          >
            <span>{errorText}</span>
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-1.5"
          >
            {idleIcon}
            {idleText ?? children ?? 'Save'}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}
