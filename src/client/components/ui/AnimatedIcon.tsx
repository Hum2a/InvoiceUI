import * as React from 'react'
import {
  motion,
  useAnimation,
  useInView,
  type Variants,
  type UseInViewOptions,
  type SVGMotionProps,
  type HTMLMotionProps,
} from 'motion/react'
import { cn } from '../../lib/utils'

/**
 * Animate UI - Animated Lucide Icons
 * Source: https://animate-ui.com/docs/icons
 * License: MIT
 */

const staticAnimations = {
  path: {
    initial: { pathLength: 1 },
    animate: {
      pathLength: [0.05, 1],
      transition: {
        duration: 0.8,
        ease: 'easeInOut',
      },
    },
  } as Variants,
  'path-loop': {
    initial: { pathLength: 1 },
    animate: {
      pathLength: [1, 0.05, 1],
      transition: {
        duration: 1.6,
        ease: 'easeInOut',
      },
    },
  } as Variants,
} as const

type StaticAnimations = keyof typeof staticAnimations
type TriggerProp<T = string> = boolean | StaticAnimations | T
type Trigger = TriggerProp<string>

type AnimateIconContextValue = {
  controls: ReturnType<typeof useAnimation> | undefined
  animation: StaticAnimations | string
  loop?: boolean
  loopDelay?: number
  active?: boolean
  animate?: Trigger
  initialOnAnimateEnd?: boolean
  completeOnStop?: boolean
  persistOnAnimateEnd?: boolean
  delay?: number
}

type DefaultIconProps<T = string> = {
  animate?: TriggerProp<T>
  animateOnHover?: TriggerProp<T>
  animateOnTap?: TriggerProp<T>
  animateOnView?: TriggerProp<T>
  animateOnViewMargin?: UseInViewOptions['margin']
  animateOnViewOnce?: boolean
  animation?: T | StaticAnimations
  loop?: boolean
  loopDelay?: number
  initialOnAnimateEnd?: boolean
  completeOnStop?: boolean
  persistOnAnimateEnd?: boolean
  delay?: number
}

export type IconProps<T = string> = DefaultIconProps<T> &
  Omit<SVGMotionProps<SVGSVGElement>, 'animate'> & {
    size?: number | string
  }

type IconWrapperProps<T = string> = IconProps<T> & {
  icon: React.ComponentType<IconProps<T>>
}

const AnimateIconContext = React.createContext<AnimateIconContextValue | null>(null)

export function useAnimateIconContext() {
  const context = React.useContext(AnimateIconContext)
  if (!context) {
    return {
      controls: undefined,
      animation: 'default',
      loop: undefined,
      loopDelay: undefined,
      active: undefined,
      animate: undefined,
      initialOnAnimateEnd: undefined,
      completeOnStop: undefined,
      persistOnAnimateEnd: undefined,
      delay: undefined,
    }
  }
  return context
}

export interface AnimateIconProps<T = string>
  extends Omit<HTMLMotionProps<'span'>, 'animate'>,
    DefaultIconProps<T> {
  children: React.ReactNode
}

export function AnimateIcon({
  animate = false,
  animateOnHover = false,
  animateOnTap = false,
  animateOnView = false,
  animateOnViewMargin = '0px',
  animateOnViewOnce = true,
  animation = 'default',
  loop = false,
  loopDelay = 0,
  initialOnAnimateEnd = false,
  completeOnStop = false,
  persistOnAnimateEnd = false,
  delay = 0,
  children,
  className,
  ...props
}: AnimateIconProps) {
  const controls = useAnimation()
  const [localAnimate, setLocalAnimate] = React.useState<boolean>(Boolean(animate))
  const [currentAnimation, setCurrentAnimation] = React.useState<string>(
    typeof animate === 'string' ? animate : String(animation)
  )

  const inViewRef = React.useRef<HTMLSpanElement>(null)
  const isInView = useInView(inViewRef, {
    once: animateOnViewOnce,
    margin: animateOnViewMargin,
  })

  React.useEffect(() => {
    if (animateOnView && isInView) {
      setLocalAnimate(true)
      if (typeof animateOnView === 'string') setCurrentAnimation(animateOnView)
    }
  }, [animateOnView, isInView])

  React.useEffect(() => {
    if (animate) {
      setLocalAnimate(true)
      if (typeof animate === 'string') setCurrentAnimation(animate)
    } else if (!animateOnHover && !animateOnTap) {
      setLocalAnimate(false)
    }
  }, [animate, animateOnHover, animateOnTap])

  React.useEffect(() => {
    let active = true
    const trigger = async () => {
      if (localAnimate) {
        if (delay > 0) await new Promise(r => setTimeout(r, delay * 1000))
        if (!active) return
        await controls.start('animate')
        if (loop) {
          if (loopDelay > 0) await new Promise(r => setTimeout(r, loopDelay * 1000))
          if (active && localAnimate) void trigger()
        } else if (initialOnAnimateEnd) {
          await controls.start('initial')
        }
      } else if (!persistOnAnimateEnd) {
        await controls.start('initial')
      }
    }
    void trigger()
    return () => {
      active = false
    }
  }, [localAnimate, loop, loopDelay, delay, initialOnAnimateEnd, persistOnAnimateEnd, controls])

  return (
    <AnimateIconContext.Provider
      value={{
        controls,
        animation: currentAnimation,
        loop,
        loopDelay,
        active: localAnimate,
        animate: animate as Trigger,
        initialOnAnimateEnd,
        completeOnStop,
        delay,
      }}
    >
      <motion.span
        ref={inViewRef}
        className={cn('inline-flex items-center justify-center', className)}
        onMouseEnter={() => {
          if (animateOnHover) {
            setLocalAnimate(true)
            if (typeof animateOnHover === 'string') setCurrentAnimation(animateOnHover)
          }
        }}
        onMouseLeave={() => {
          if (animateOnHover || animateOnTap) setLocalAnimate(false)
        }}
        onPointerDown={() => {
          if (animateOnTap) {
            setLocalAnimate(true)
            if (typeof animateOnTap === 'string') setCurrentAnimation(animateOnTap)
          }
        }}
        onPointerUp={() => {
          if (animateOnTap) setLocalAnimate(false)
        }}
        {...props}
      >
        {children}
      </motion.span>
    </AnimateIconContext.Provider>
  )
}

export function IconWrapper<T extends string>({
  size = 16,
  animation: animationProp,
  animate,
  animateOnHover,
  animateOnTap,
  animateOnView,
  icon: IconComponent,
  loop,
  loopDelay,
  persistOnAnimateEnd,
  initialOnAnimateEnd,
  delay,
  completeOnStop,
  className,
  ...props
}: IconWrapperProps<T>) {
  const context = React.useContext(AnimateIconContext)

  if (context) {
    return (
      <IconComponent
        size={size}
        className={className}
        {...props}
      />
    )
  }

  if (
    animate !== undefined ||
    animateOnHover !== undefined ||
    animateOnTap !== undefined ||
    animateOnView !== undefined
  ) {
    return (
      <AnimateIcon
        animate={animate}
        animateOnHover={animateOnHover}
        animateOnTap={animateOnTap}
        animateOnView={animateOnView}
        animation={animationProp}
        loop={loop}
        loopDelay={loopDelay}
        delay={delay}
        completeOnStop={completeOnStop}
        persistOnAnimateEnd={persistOnAnimateEnd}
        initialOnAnimateEnd={initialOnAnimateEnd}
      >
        <IconComponent size={size} className={className} {...props} />
      </AnimateIcon>
    )
  }

  return (
    <AnimateIcon animateOnHover={true}>
      <IconComponent size={size} className={className} {...props} />
    </AnimateIcon>
  )
}

export function getVariants<
  V extends { default: T; [key: string]: T },
  T extends Record<string, Variants>,
>(animations: V): T {
  const { animation: animationType } = useAnimateIconContext()
  let result: T

  if (animationType in staticAnimations) {
    const variant = staticAnimations[animationType as StaticAnimations]
    result = {} as T
    for (const key in animations.default) {
      if (
        (animationType === 'path' || animationType === 'path-loop') &&
        key.includes('group')
      )
        continue
      result[key] = variant as T[Extract<keyof T, string>]
    }
  } else {
    result = (animations[animationType as keyof V] as T) ?? animations.default
  }
  return result
}

// ==========================================
// ANIMATED ICONS
// ==========================================

// 1. ArrowRight
const arrowRightAnimations = {
  default: {
    group: {
      initial: { x: 0, transition: { ease: 'easeInOut', duration: 0.3 } },
      animate: { x: 4, transition: { ease: 'easeInOut', duration: 0.3 } },
    },
    path1: {},
    path2: {},
  } satisfies Record<string, Variants>,
} as const

function ArrowRightComponent({ size = 16, ...props }: IconProps<keyof typeof arrowRightAnimations>) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(arrowRightAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <motion.path d="M5 12h14" variants={variants.path1} initial="initial" animate={controls} />
        <motion.path d="m12 5 7 7-7 7" variants={variants.path2} initial="initial" animate={controls} />
      </motion.g>
    </motion.svg>
  )
}
export function ArrowRight(props: IconProps<keyof typeof arrowRightAnimations>) {
  return <IconWrapper icon={ArrowRightComponent} {...props} />
}

// 2. ArrowLeft
const arrowLeftAnimations = {
  default: {
    group: {
      initial: { x: 0, transition: { ease: 'easeInOut', duration: 0.3 } },
      animate: { x: -4, transition: { ease: 'easeInOut', duration: 0.3 } },
    },
    path1: {},
    path2: {},
  } satisfies Record<string, Variants>,
} as const

function ArrowLeftComponent({ size = 16, ...props }: IconProps<keyof typeof arrowLeftAnimations>) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(arrowLeftAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <motion.path d="M19 12H5" variants={variants.path1} initial="initial" animate={controls} />
        <motion.path d="m12 19-7-7 7-7" variants={variants.path2} initial="initial" animate={controls} />
      </motion.g>
    </motion.svg>
  )
}
export function ArrowLeft(props: IconProps<keyof typeof arrowLeftAnimations>) {
  return <IconWrapper icon={ArrowLeftComponent} {...props} />
}

// 3. Check
const checkAnimations = {
  default: {
    path: {
      initial: { pathLength: 1, opacity: 1, scale: 1 },
      animate: {
        pathLength: [0, 1],
        opacity: [0, 1],
        scale: [0.8, 1.1, 1],
        transition: { duration: 0.45, ease: 'easeOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function CheckComponent({ size = 16, ...props }: IconProps<keyof typeof checkAnimations>) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(checkAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.path
        d="M20 6 9 17l-5-5"
        variants={variants.path}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  )
}
export function Check(props: IconProps<keyof typeof checkAnimations>) {
  return <IconWrapper icon={CheckComponent} {...props} />
}

// 4. Download
const downloadAnimations = {
  default: {
    group: {
      initial: { y: 0, transition: { duration: 0.3, ease: 'easeInOut' } },
      animate: { y: 2, transition: { duration: 0.3, ease: 'easeInOut' } },
    },
    path1: {
      initial: { y: 0 },
      animate: {
        y: [0, 3, 0],
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    },
    path2: {},
  } satisfies Record<string, Variants>,
} as const

function DownloadComponent({ size = 16, ...props }: IconProps<keyof typeof downloadAnimations>) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(downloadAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.path1} initial="initial" animate={controls}>
        <path d="M12 15V3" />
        <path d="m7 10 5 5 5-5" />
      </motion.g>
      <motion.path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  )
}
export function Download(props: IconProps<keyof typeof downloadAnimations>) {
  return <IconWrapper icon={DownloadComponent} {...props} />
}

// 5. Trash2
const trash2Animations = {
  default: {
    lid: {
      initial: { rotate: 0, y: 0 },
      animate: {
        rotate: -14,
        y: -2,
        transformOrigin: 'top left',
        transition: { duration: 0.3, ease: 'easeInOut' },
      },
    },
    can: {},
  } satisfies Record<string, Variants>,
} as const

function Trash2Component({ size = 16, ...props }: IconProps<keyof typeof trash2Animations>) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(trash2Animations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.lid} initial="initial" animate={controls}>
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </motion.g>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </motion.svg>
  )
}
export function Trash2(props: IconProps<keyof typeof trash2Animations>) {
  return <IconWrapper icon={Trash2Component} {...props} />
}

// 6. RefreshCw
const refreshCwAnimations = {
  default: {
    group: {
      initial: { rotate: 0 },
      animate: {
        rotate: 360,
        transition: { duration: 0.7, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function RefreshCwComponent({ size = 16, ...props }: IconProps<keyof typeof refreshCwAnimations>) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(refreshCwAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
      </motion.g>
    </motion.svg>
  )
}
export function RefreshCw(props: IconProps<keyof typeof refreshCwAnimations>) {
  return <IconWrapper icon={RefreshCwComponent} {...props} />
}

// 7. Search
const searchAnimations = {
  default: {
    group: {
      initial: { rotate: 0, scale: 1 },
      animate: {
        transformOrigin: 'bottom right',
        rotate: [0, 14, -8, 4, 0],
        scale: [1, 1.1, 1],
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function SearchComponent({ size = 16, ...props }: IconProps<keyof typeof searchAnimations>) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(searchAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </motion.g>
    </motion.svg>
  )
}
export function Search(props: IconProps<keyof typeof searchAnimations>) {
  return <IconWrapper icon={SearchComponent} {...props} />
}

// 8. Plus
const plusAnimations = {
  default: {
    group: {
      initial: { rotate: 0, scale: 1 },
      animate: {
        rotate: 90,
        scale: 1.15,
        transition: { duration: 0.35, ease: 'easeOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function PlusComponent({ size = 16, ...props }: IconProps<keyof typeof plusAnimations>) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(plusAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </motion.g>
    </motion.svg>
  )
}
export function Plus(props: IconProps<keyof typeof plusAnimations>) {
  return <IconWrapper icon={PlusComponent} {...props} />
}

// 9. Send
const sendAnimations = {
  default: {
    group: {
      initial: { x: 0, y: 0, scale: 1 },
      animate: {
        x: [0, 4, -1, 0],
        y: [0, -4, 1, 0],
        scale: [1, 1.1, 0.95, 1],
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function SendComponent({ size = 16, ...props }: IconProps<keyof typeof sendAnimations>) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(sendAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </motion.g>
    </motion.svg>
  )
}
export function Send(props: IconProps<keyof typeof sendAnimations>) {
  return <IconWrapper icon={SendComponent} {...props} />
}

// 10. Sparkles
const sparklesAnimations = {
  default: {
    group: {
      initial: { scale: 1, rotate: 0 },
      animate: {
        scale: [1, 0.85, 1.15, 1],
        rotate: [0, -10, 10, 0],
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function SparklesComponent({ size = 16, ...props }: IconProps<keyof typeof sparklesAnimations>) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(sparklesAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        <path d="M20 3v4" />
        <path d="M22 5h-4" />
      </motion.g>
    </motion.svg>
  )
}
export function Sparkles(props: IconProps<keyof typeof sparklesAnimations>) {
  return <IconWrapper icon={SparklesComponent} {...props} />
}

// 11. ExternalLink
const externalLinkAnimations = {
  default: {
    arrow: {
      initial: { x: 0, y: 0 },
      animate: {
        x: [0, 2, 0],
        y: [0, -2, 0],
        transition: { duration: 0.4, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function ExternalLinkComponent({ size = 16, ...props }: IconProps<keyof typeof externalLinkAnimations>) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(externalLinkAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M15 3h6v6" />
      <motion.path d="M10 14 21 3" variants={variants.arrow} initial="initial" animate={controls} />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </motion.svg>
  )
}
export function ExternalLink(props: IconProps<keyof typeof externalLinkAnimations>) {
  return <IconWrapper icon={ExternalLinkComponent} {...props} />
}

// 12. Settings
const settingsAnimations = {
  default: {
    group: {
      initial: { rotate: 0 },
      animate: {
        rotate: [0, 90, 180],
        transition: { duration: 1.25, ease: 'easeInOut' },
      },
    },
    path: {},
    circle: {},
  } satisfies Record<string, Variants>,
} as const

function SettingsComponent({ size = 16, ...props }: IconProps<keyof typeof settingsAnimations>) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(settingsAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <motion.path
          d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
          variants={variants.path}
          initial="initial"
          animate={controls}
        />
        <motion.circle
          cx={12}
          cy={12}
          r={3}
          variants={variants.circle}
          initial="initial"
          animate={controls}
        />
      </motion.g>
    </motion.svg>
  )
}
export function Settings(props: IconProps<keyof typeof settingsAnimations>) {
  return <IconWrapper icon={SettingsComponent} {...props} />
}

// 13. Clock
const clockAnimations = {
  default: {
    circle: {},
    hand: {
      initial: { rotate: 0 },
      animate: {
        transformOrigin: 'bottom left',
        rotate: 360,
        transition: { ease: 'easeInOut', duration: 0.8 },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function ClockComponent({ size = 16, ...props }: IconProps<keyof typeof clockAnimations>) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(clockAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx={12} cy={12} r={10} />
      <polyline points="12 6 12 12 16 14" />
    </motion.svg>
  )
}
export function Clock(props: IconProps<keyof typeof clockAnimations>) {
  return <IconWrapper icon={ClockComponent} {...props} />
}

// 14. X
const xAnimations = {
  default: {
    group: {
      initial: { rotate: 0, scale: 1 },
      animate: {
        rotate: 90,
        scale: 1.1,
        transition: { ease: 'easeInOut', duration: 0.3 },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function XComponent({ size = 16, ...props }: IconProps<keyof typeof xAnimations>) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(xAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </motion.g>
    </motion.svg>
  )
}
export function X(props: IconProps<keyof typeof xAnimations>) {
  return <IconWrapper icon={XComponent} {...props} />
}

// 15. Copy
const copyAnimations = {
  default: {
    rect: {
      initial: { y: 0, x: 0 },
      animate: {
        y: -2,
        x: -2,
        transition: { duration: 0.3, ease: 'easeInOut' },
      },
    },
    path: {
      initial: { y: 0, x: 0 },
      animate: {
        y: 2,
        x: 2,
        transition: { duration: 0.3, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const

function CopyComponent({ size = 16, ...props }: IconProps<keyof typeof copyAnimations>) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(copyAnimations)
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.rect
        width={14}
        height={14}
        x={8}
        y={8}
        rx={2}
        ry={2}
        variants={variants.rect}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
        variants={variants.path}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  )
}
export function Copy(props: IconProps<keyof typeof copyAnimations>) {
  return <IconWrapper icon={CopyComponent} {...props} />
}
