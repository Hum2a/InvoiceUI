import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from './ui'
import { X, Trash2, Check } from './ui/AnimatedIcon'

export interface ConfirmOptions {
  title?: string
  description: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

export interface AlertOptions {
  title?: string
  description: string
  buttonText?: string
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  alert: (options: AlertOptions) => Promise<void>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function useConfirm(): ConfirmContextType {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return ctx
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  isAlert?: boolean
  resolve: (value: boolean) => void
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({
        open: true,
        isAlert: false,
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        confirmVariant: 'danger',
        ...options,
        resolve,
      })
    })
  }, [])

  const alert = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise<void>((resolve) => {
      setState({
        open: true,
        isAlert: true,
        title: options.title || 'Notice',
        description: options.description,
        confirmText: options.buttonText || 'OK',
        confirmVariant: 'primary',
        resolve: () => resolve(),
      })
    })
  }, [])

  const handleClose = () => {
    if (state) {
      state.resolve(false)
      setState(null)
    }
  }

  const handleConfirm = () => {
    if (state) {
      state.resolve(true)
      setState(null)
    }
  }

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}
      {state && (
        <Dialog.Root open={state.open} onOpenChange={(v) => { if (!v) handleClose() }}>
          <Dialog.Portal>
            <Dialog.Overlay className="confirm-modal-overlay" />
            <Dialog.Content className="confirm-modal-content">
              <div className="section-heading">
                <div>
                  <Dialog.Title className="modal-title">
                    {state.title || (state.isAlert ? 'Notice' : 'Are you sure?')}
                  </Dialog.Title>
                  <Dialog.Description className="muted">
                    {state.description}
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <Button variant="ghost" aria-label="Close dialog" className="p-1.5" onClick={handleClose}>
                    <X size={16} animateOnHover />
                  </Button>
                </Dialog.Close>
              </div>

              <div className="modal-actions">
                {!state.isAlert && (
                  <Button variant="secondary" onClick={handleClose}>
                    {state.cancelText || 'Cancel'}
                  </Button>
                )}
                <Button
                  variant={state.confirmVariant || 'danger'}
                  onClick={handleConfirm}
                  autoFocus
                >
                  {state.confirmVariant === 'danger' && (
                    <Trash2 size={13} animateOnHover className="mr-1 inline" />
                  )}
                  {state.confirmVariant === 'primary' && !state.isAlert && (
                    <Check size={14} animateOnHover className="mr-1 inline" />
                  )}
                  {state.confirmText || (state.isAlert ? 'OK' : 'Confirm')}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </ConfirmContext.Provider>
  )
}

export interface StandaloneConfirmModalProps {
  open: boolean
  title?: string
  description: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  onConfirm: () => void | Promise<void>
  onClose: () => void
}

export function ConfirmModal({
  open,
  title = 'Are you sure?',
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  onConfirm,
  onClose,
}: StandaloneConfirmModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="confirm-modal-overlay" />
        <Dialog.Content className="confirm-modal-content">
          <div className="section-heading">
            <div>
              <Dialog.Title className="modal-title">
                {title}
              </Dialog.Title>
              <Dialog.Description className="muted">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" aria-label="Close dialog" className="p-1.5" onClick={onClose}>
                <X size={16} animateOnHover />
              </Button>
            </Dialog.Close>
          </div>

          <div className="modal-actions">
            <Button variant="secondary" onClick={onClose}>
              {cancelText}
            </Button>
            <Button
              variant={confirmVariant}
              onClick={async () => {
                await onConfirm()
              }}
              autoFocus
            >
              {confirmVariant === 'danger' && (
                <Trash2 size={13} animateOnHover className="mr-1 inline" />
              )}
              {confirmVariant === 'primary' && (
                <Check size={14} animateOnHover className="mr-1 inline" />
              )}
              {confirmText}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
