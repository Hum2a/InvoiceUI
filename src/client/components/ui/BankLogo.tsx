import { useState } from 'react'
import {
  SiMonzo,
  SiBarclays,
  SiHsbc,
  SiStarlingbank,
  SiRevolut,
  SiChase,
  SiWise,
  SiBankofamerica,
  SiDeutschebank,
  SiCaixabank,
  SiCommerzbank,
} from '@icons-pack/react-simple-icons'
import { findBank, type BankOption } from '../../../shared/banks'

const VECTOR_ICONS: Record<string, React.ComponentType<{ size?: number | string; color?: string; className?: string }>> = {
  SiMonzo,
  SiBarclays,
  SiHsbc,
  SiStarlingbank,
  SiRevolut,
  SiChase,
  SiWise,
  SiBankofamerica,
  SiDeutschebank,
  SiCaixabank,
  SiCommerzbank,
}

interface BankLogoProps {
  bankId?: string
  bankName?: string
  bankLogo?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  showName?: boolean
}

const SIZE_MAP = {
  xs: { box: 'w-5 h-5 min-w-5', icon: 12, text: 'text-[10px]' },
  sm: { box: 'w-7 h-7 min-w-7', icon: 16, text: 'text-xs' },
  md: { box: 'w-9 h-9 min-w-9', icon: 20, text: 'text-sm' },
  lg: { box: 'w-12 h-12 min-w-12', icon: 26, text: 'text-base' },
}

export function BankLogo({
  bankId,
  bankName,
  bankLogo,
  size = 'md',
  className = '',
  showName = false,
}: BankLogoProps) {
  const [imgError, setImgError] = useState(false)
  const bank = findBank(bankId || bankName)
  const { box, icon, text } = SIZE_MAP[size]

  const displayName = bankName || bank?.name || 'Bank'
  const brandColor = bank?.brandColor || '#6366f1'
  const monogram = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || 'BK'

  // Custom provided logo URL / data URL takes precedence
  if (bankLogo && !imgError) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div
          className={`${box} rounded-lg bg-white dark:bg-zinc-900 border border-[var(--line)] shadow-xs flex items-center justify-center p-1 overflow-hidden transition-all duration-200 hover:scale-105`}
        >
          <img
            src={bankLogo}
            alt={`${displayName} logo`}
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          />
        </div>
        {showName && <span className="font-medium text-sm text-[var(--ink)]">{displayName}</span>}
      </div>
    )
  }

  // Vector icon from @icons-pack/react-simple-icons if available
  if (bank?.iconKey && VECTOR_ICONS[bank.iconKey]) {
    const IconComponent = VECTOR_ICONS[bank.iconKey]
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div
          className={`${box} rounded-lg border border-[var(--line)] flex items-center justify-center transition-all duration-200 shadow-xs hover:scale-105`}
          style={{
            backgroundColor: `${brandColor}15`,
            borderColor: `${brandColor}35`,
          }}
          title={displayName}
        >
          <IconComponent size={icon} color={brandColor} />
        </div>
        {showName && <span className="font-medium text-sm text-[var(--ink)]">{displayName}</span>}
      </div>
    )
  }

  // Domain-based remote logo via unavatar
  if (bank?.domain && !imgError) {
    const logoUrl = `https://unavatar.io/${encodeURIComponent(bank.domain)}?fallback=false`
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div
          className={`${box} rounded-lg bg-white dark:bg-zinc-900 border border-[var(--line)] shadow-xs flex items-center justify-center p-1 overflow-hidden transition-all duration-200 hover:scale-105`}
          title={displayName}
        >
          <img
            src={logoUrl}
            alt={`${displayName} logo`}
            className="w-full h-full object-contain"
            loading="lazy"
            crossOrigin="anonymous"
            onError={() => setImgError(true)}
          />
        </div>
        {showName && <span className="font-medium text-sm text-[var(--ink)]">{displayName}</span>}
      </div>
    )
  }

  // Fallback monogram badge with brand styling
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`${box} rounded-lg font-bold flex items-center justify-center border shadow-xs select-none transition-all duration-200 hover:scale-105`}
        style={{
          backgroundColor: `${brandColor}20`,
          borderColor: `${brandColor}40`,
          color: brandColor,
        }}
        title={displayName}
      >
        <span className={text}>{monogram}</span>
      </div>
      {showName && <span className="font-medium text-sm text-[var(--ink)]">{displayName}</span>}
    </div>
  )
}
