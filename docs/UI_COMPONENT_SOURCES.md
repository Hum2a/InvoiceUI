# UI Component Sources & Provenance

This document tracks all vendor-derived and library UI components across InvoiceUI in accordance with Rule 02 (`02-mandatory-ui-stack.md`).

All five mandatory UI libraries are actively integrated and rendered in the application:
1. **shadcn/ui**
2. **Motion (motion.dev)**
3. **Magic UI**
4. **React Bits**
5. **Animate UI**

---

## Component Provenance Matrix

| Library | Component | Official Source URL | Licence | Local Path | Screens / Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **shadcn/ui** | `Button`, `Dialog` (Modal, ConfirmModal), `Field`, `Badge`, `Empty` | [ui.shadcn.com](https://ui.shadcn.com) | MIT | `src/client/components/ui.tsx`, `src/client/components/ConfirmModal.tsx` | All screens: Invoices, Editor, Records, Settings, Actions, Modals |
| **Motion** | `motion.div`, `MotionConfig`, `AnimatePresence` | [motion.dev](https://motion.dev) | MIT | `src/client/App.tsx`, `src/client/components/ui/*` | App shell, reduced motion enforcement, login entrance, toasts, transitions |
| **Magic UI** | `NumberTicker` | [magicui.design/docs/components/number-ticker](https://magicui.design/docs/components/number-ticker) | MIT | `src/client/components/ui/NumberTicker.tsx` | Invoices dashboard summary cards (Invoiced, Cash Received, Outstanding, Due Soon, Overdue, Ageing buckets 1-30, 31-60, 61-90, 91+), Client & Project detail financial summaries |
| **React Bits** | `ShinyText` | [reactbits.dev/text-animations/shiny-text](https://reactbits.dev/text-animations/shiny-text) | MIT | `src/client/components/ui/ShinyText.tsx` | Active dashboard filter indicator on metric and ageing cards, status pills, live preview highlights |
| **Animate UI** | `AnimatedTabs` | [animate-ui.com/docs/components/animated-tabs](https://animate-ui.com/docs/components/animated-tabs) | MIT | `src/client/components/ui/AnimatedTabs.tsx` | App header main navigation (`Invoices`, `Quotes`, `Attention`, `Clients`, `Projects`, `Services`, `Settings`) with spring layout transitions |
| **Animate UI** | Animated Lucide Icons (`Search`, `RefreshCw`, `Plus`, `Download`, `Trash2`, `Copy`, `Send`, `Check`, `ExternalLink`, `ArrowLeft`, `ArrowRight`, `X`, `Sparkles`, `Settings`, `Clock`) | [animate-ui.com/docs/icons](https://animate-ui.com/docs/icons) | MIT | `src/client/components/ui/AnimatedIcon.tsx` | Global command search, workspace refresh, New invoice creation, editor actions, modal controls, bulk operations, table row navigation, and PDF downloads |
| **Simple Icons** | `@icons-pack/react-simple-icons` (`SiMonzo`, `SiBarclays`, `SiHsbc`, `SiStarlingbank`, `SiRevolut`, `SiChase`, `SiWise`, `SiBankofamerica`, `SiDeutschebank`, `SiCaixabank`, `SiCommerzbank`) | [simpleicons.org](https://simpleicons.org) | CC0-1.0 | `src/client/components/ui/BankLogo.tsx` | Settings bank selector, live invoice preview, payment modal, client settlement portal |

---

## Verification & Accessibility Standards

- **Reduced Motion**: All animations wrap within `<MotionConfig reducedMotion="user">` or query `useReducedMotion()`. When reduced motion is preferred by the user, animations evaluate to immediate static state without spring transitions.
- **Keyboard Access & ARIA**:
  - Modals use `@radix-ui/react-dialog` with focus trapping, `aria-labelledby`, `aria-describedby`, and Escape-to-close.
  - Tabs implement `role="tablist"` and `role="tab"` with `aria-selected` attributes.
  - Number ticker uses `aria-label` with the full formatted currency amount for instant screen-reader readability.
- **Printed / Export Parity**:
  - All animated decorations and background effects are excluded from PDF generation and `@media print` stylesheets (`.invoice { color-scheme: light; background: white !important; }`).
