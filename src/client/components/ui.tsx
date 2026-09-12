import type { ReactNode, ButtonHTMLAttributes } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { cva } from 'class-variance-authority'
import { cn } from '../lib/utils'
import { X } from './ui/AnimatedIcon'
export { cn }
const button=cva('button',{variants:{variant:{primary:'primary',secondary:'secondary',ghost:'ghost',danger:'danger'}},defaultVariants:{variant:'secondary'}})
export function Button({variant='secondary',className,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'|'danger'}){return <button type="button" className={cn(button({variant}),className)} {...props}/>}
export function Field({label,children,hint}: {label:string;children:ReactNode;hint?:string}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
export function Modal({open,onClose,title,description,children}:{open:boolean;onClose:()=>void;title:string;description?:string;children:ReactNode}){return <Dialog.Root open={open} onOpenChange={v=>{if(!v)onClose()}}><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content className="modal-content"><div className="section-heading"><div><Dialog.Title className="modal-title">{title}</Dialog.Title><Dialog.Description className="muted">{description||'Review your changes below.'}</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" aria-label="Close dialog" className="p-1.5"><X size={16} animateOnHover /></Button></Dialog.Close></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>}
export function Badge({children,className}: {children:ReactNode;className?:string}){return <span className={cn('badge',String(children).replaceAll(' ','-'),className)}>{children}</span>}
export function Empty({title,detail,action}:{title:string;detail:string;action?:ReactNode}){return <div className="empty"><div className="empty-icon">▤</div><h2>{title}</h2><p className="muted">{detail}</p>{action}</div>}
export { ConfirmModal, ConfirmProvider, useConfirm, type ConfirmOptions, type AlertOptions } from './ConfirmModal'
