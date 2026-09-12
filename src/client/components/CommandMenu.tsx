import { useState, useEffect, useMemo, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { money, totals, type Workspace, type Invoice, type Client, type Project } from '../../shared/domain'
import { Badge, Button, Modal } from './ui'

export interface CommandItem {
  id: string
  title: string
  subtitle?: string
  badge?: string
  category: 'Actions' | 'Invoices' | 'Clients' | 'Projects' | 'Recent'
  shortcut?: string
  perform: () => void
}

export function CommandMenu({
  open,
  onClose,
  workspace: w,
  onSelectInvoice,
  onSelectClient,
  onSelectProject,
  onCreateInvoice,
  onNavigate,
  onExport,
  onToggleTheme,
  onOpenShortcuts,
}: {
  open: boolean
  onClose: () => void
  workspace: Workspace
  onSelectInvoice: (id: string) => void
  onSelectClient: (id: string) => void
  onSelectProject: (id: string) => void
  onCreateInvoice: () => void
  onNavigate: (view: string) => void
  onExport: (zip: boolean) => void
  onToggleTheme: () => void
  onOpenShortcuts: () => void
}) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const result: CommandItem[] = []

    // Built-in actions
    const allActions: CommandItem[] = [
      {
        id: 'act-new-invoice',
        title: 'Create new invoice draft',
        subtitle: 'Start a blank invoice',
        category: 'Actions',
        shortcut: 'Ctrl Alt N',
        perform: () => {
          onClose()
          onCreateInvoice()
        },
      },
      {
        id: 'act-nav-quotes',
        title: 'Open Quotes & Estimates',
        subtitle: 'Manage versioned quotes and acceptance',
        category: 'Actions',
        perform: () => {
          onClose()
          onNavigate('Quotes')
        },
      },
      {
        id: 'act-nav-clients',
        title: 'Open Clients directory',
        subtitle: 'Manage client accounts and rates',
        category: 'Actions',
        perform: () => {
          onClose()
          onNavigate('Clients')
        },
      },
      {
        id: 'act-nav-projects',
        title: 'Open Projects',
        subtitle: 'View client projects',
        category: 'Actions',
        perform: () => {
          onClose()
          onNavigate('Projects')
        },
      },
      {
        id: 'act-nav-services',
        title: 'Open Services & Starters',
        subtitle: 'Manage reusable rates and bundles',
        category: 'Actions',
        perform: () => {
          onClose()
          onNavigate('Services')
        },
      },
      {
        id: 'act-nav-settings',
        title: 'Open Settings',
        subtitle: 'Business identity, bank, and appearance',
        category: 'Actions',
        perform: () => {
          onClose()
          onNavigate('Settings')
        },
      },
      {
        id: 'act-shortcuts',
        title: 'Keyboard shortcuts reference',
        subtitle: 'Show all available keyboard shortcuts',
        category: 'Actions',
        shortcut: '?',
        perform: () => {
          onClose()
          onOpenShortcuts()
        },
      },
      {
        id: 'act-theme',
        title: 'Toggle light / dark theme',
        subtitle: 'Switch editor appearance',
        category: 'Actions',
        perform: () => {
          onClose()
          onToggleTheme()
        },
      },
      {
        id: 'act-export-json',
        title: 'Export JSON backup',
        subtitle: 'Download machine-readable workspace file',
        category: 'Actions',
        perform: () => {
          onClose()
          onExport(false)
        },
      },
      {
        id: 'act-export-zip',
        title: 'Export ZIP bundle with PDFs',
        subtitle: 'Download full workspace and all issued documents',
        category: 'Actions',
        perform: () => {
          onClose()
          onExport(true)
        },
      },
    ]

    if (!q) {
      // Show recent records first
      const recentInvoices = [...w.invoices]
        .sort((a, b) => b.updated.localeCompare(a.updated))
        .slice(0, 3)

      for (const inv of recentInvoices) {
        result.push({
          id: `recent-inv-${inv.id}`,
          title: inv.number || 'Draft invoice',
          subtitle: `${inv.client.name || 'No client'} - ${money(totals(inv).total, inv.currency)}`,
          badge: inv.lifecycle,
          category: 'Recent',
          perform: () => {
            onClose()
            onSelectInvoice(inv.id)
          },
        })
      }

      const recentClients = w.clients.slice(0, 2)

      for (const c of recentClients) {
        result.push({
          id: `recent-client-${c.id}`,
          title: c.name,
          subtitle: c.email || 'Client directory',
          category: 'Recent',
          perform: () => {
            onClose()
            onSelectClient(c.id)
          },
        })
      }

      // Add actions
      result.push(...allActions)
      return result
    }

    // Filter Invoices
    const matchingInvoices = w.invoices.filter(i => {
      const target = `${i.number} ${i.client.name} ${i.notes} ${money(totals(i).total, i.currency)}`.toLowerCase()
      return target.includes(q)
    })

    for (const inv of matchingInvoices.slice(0, 6)) {
      result.push({
        id: `inv-${inv.id}`,
        title: inv.number || 'Draft invoice',
        subtitle: `${inv.client.name || 'No client'} - ${money(totals(inv).total, inv.currency)} (Due ${inv.dueDate})`,
        badge: inv.lifecycle,
        category: 'Invoices',
        perform: () => {
          onClose()
          onSelectInvoice(inv.id)
        },
      })
    }

    // Filter Clients
    const matchingClients = w.clients.filter(c => {
      return `${c.name} ${c.contact || ''} ${c.phone || ''} ${c.email} ${c.city || ''} ${c.postalCode || ''} ${c.country || ''} ${c.taxId || ''} ${c.address}`.toLowerCase().includes(q)
    })

    for (const c of matchingClients.slice(0, 4)) {
      result.push({
        id: `client-${c.id}`,
        title: c.name,
        subtitle: c.email ? `${c.email} - ${c.terms} day terms` : `${c.terms} day terms`,
        category: 'Clients',
        perform: () => {
          onClose()
          onSelectClient(c.id)
        },
      })
    }

    // Filter Projects
    const matchingProjects = w.projects.filter(p => {
      return `${p.name} ${p.notes}`.toLowerCase().includes(q)
    })

    for (const p of matchingProjects.slice(0, 4)) {
      const clientName = w.clients.find(c => c.id === p.clientId)?.name || 'Client project'
      result.push({
        id: `project-${p.id}`,
        title: p.name,
        subtitle: clientName,
        category: 'Projects',
        perform: () => {
          onClose()
          onSelectProject(p.id)
        },
      })
    }

    // Filter Actions
    const matchingActions = allActions.filter(a => {
      return `${a.title} ${a.subtitle || ''}`.toLowerCase().includes(q)
    })
    result.push(...matchingActions)

    return result
  }, [query, w, onSelectInvoice, onSelectClient, onSelectProject, onCreateInvoice, onNavigate, onExport, onToggleTheme, onOpenShortcuts, onClose])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [items.length])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % Math.max(1, items.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + items.length) % Math.max(1, items.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[selectedIndex]) {
        items[selectedIndex].perform()
      }
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-content command-dialog" onKeyDown={handleKeyDown}>
          <div className="command-search-wrap">
            <span className="text-[var(--muted)] text-base">🔍</span>
            <input
              ref={inputRef}
              className="command-search-input"
              placeholder="Type a command or search invoices, clients, projects…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Command search"
            />
            <span className="command-shortcut">ESC</span>
          </div>

          <div className="command-list" role="listbox">
            {items.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--muted)]">
                No matching results found for "{query}".
              </div>
            ) : (
              items.map((item, idx) => {
                const isSelected = idx === selectedIndex
                const showCategory =
                  idx === 0 || items[idx - 1].category !== item.category

                return (
                  <div key={item.id}>
                    {showCategory && (
                      <div className="command-group-heading">
                        {item.category}
                      </div>
                    )}
                    <div
                      className="command-item"
                      data-selected={isSelected}
                      onClick={item.perform}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{item.title}</span>
                          {item.badge && <Badge>{item.badge}</Badge>}
                        </div>
                        {item.subtitle && (
                          <p className="text-xs text-[var(--muted)] mt-0.5">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                      {item.shortcut && (
                        <span className="command-shortcut">{item.shortcut}</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="p-3 bg-[var(--soft)] border-t border-[var(--line)] flex justify-between items-center text-[11px] text-[var(--muted)]">
            <div className="flex items-center gap-3">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>ESC Close</span>
            </div>
            <span>Press ? anytime for shortcut cheat sheet</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function ShortcutsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const shortcuts = [
    { key: 'Ctrl / Cmd + K', action: 'Open command menu and global search' },
    { key: 'Ctrl / Cmd + Alt + N', action: 'Create a new invoice draft' },
    { key: 'Ctrl / Cmd + S', action: 'Save current invoice draft' },
    { key: 'Ctrl / Cmd + Shift + D', action: 'Download active invoice PDF' },
    { key: 'Alt + Up', action: 'Move active line item up' },
    { key: 'Alt + Down', action: 'Move active line item down' },
    { key: 'Alt + D', action: 'Duplicate active line item below' },
    { key: 'Ctrl / Cmd + Z', action: 'Undo line item edits in composer' },
    { key: '?', action: 'Show this keyboard shortcuts guide' },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Quick shortcuts for rapid navigation and invoice composition."
    >
      <div className="space-y-2 mt-2">
        <div className="table-scroll">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Shortcut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {shortcuts.map(s => (
                <tr key={s.key}>
                  <td>
                    <span className="command-shortcut font-semibold">{s.key}</span>
                  </td>
                  <td className="text-sm">{s.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end pt-3">
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
