import { describe, it, expect } from 'vitest'
import {
  emptyWorkspace,
  newInvoice,
  applyCommand,
  totals,
  addDays,
  getCountryFieldLabels,
  formatClientAddress,
  formatClientAddressLines,
  formatAddress,
  blankClient,
  type Workspace,
  type Client,
  type Project,
  type Service,
} from '../src/shared/domain'

describe('Phase 2: Business, Clients, Projects, and Services (Section 2)', () => {
  it('updates business settings with validation for timezone and currency', () => {
    let w = emptyWorkspace()
    w = applyCommand(w, {
      type: 'business',
      value: {
        name: 'Humza Digital Studio',
        email: 'humza@example.com',
        address: '100 Piccadilly, London, W1J 7NE',
        bank: 'Bank: Barclays\nSort: 20-00-00\nAcc: 98765432',
        footer: 'Payment terms: 14 days net.',
        taxId: 'GB987654321',
        logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        currency: 'GBP',
        terms: 14,
        prefix: 'INV',
        accent: '#3b82f6',
        template: 'minimal',
        timezone: 'Europe/London',
      },
    })

    expect(w.business.name).toBe('Humza Digital Studio')
    expect(w.business.currency).toBe('GBP')
    expect(w.business.terms).toBe(14)
    expect(w.business.timezone).toBe('Europe/London')

    // Invalid timezone should be rejected by schema validation
    expect(() =>
      applyCommand(w, {
        type: 'business',
        value: {
          ...w.business,
          timezone: 'Invalid/NonExistent_Zone',
        },
      })
    ).toThrow()
  })

  it('manages client directory: create, update, and delete', () => {
    let w = emptyWorkspace()
    const client: Client = {
      id: crypto.randomUUID(),
      name: 'Mentage Global',
      email: 'accounts@mentage.com',
      address: 'Floor 12, 1 Canada Square, London',
      cc: ['finance@mentage.com', 'ops@mentage.com'],
      replyTo: 'humza@example.com',
      terms: 14,
      notes: 'Prefers electronic payments with PO references.',
    }

    // Create client
    w = applyCommand(w, { type: 'client', value: client })
    expect(w.clients).toHaveLength(1)
    expect(w.clients[0].name).toBe('Mentage Global')

    // Update client
    const updatedClient = { ...client, name: 'Mentage Global Ltd', terms: 30 }
    w = applyCommand(w, { type: 'client', value: updatedClient })
    expect(w.clients).toHaveLength(1)
    expect(w.clients[0].name).toBe('Mentage Global Ltd')
    expect(w.clients[0].terms).toBe(30)

    // Delete client
    w = applyCommand(w, { type: 'deleteClient', id: client.id })
    expect(w.clients).toHaveLength(0)
  })

  it('manages projects linked to clients: create, update, and delete', () => {
    let w = emptyWorkspace()
    const client: Client = {
      id: crypto.randomUUID(),
      name: 'Mentage Global',
      email: 'accounts@mentage.com',
      address: 'London',
      cc: [],
      replyTo: '',
      terms: 14,
      notes: '',
    }
    w = applyCommand(w, { type: 'client', value: client })

    // Create project associated with client
    const project: Project = {
      id: crypto.randomUUID(),
      name: 'Mentage - Sprint 2',
      clientId: client.id,
      notes: 'Frontend and API deliverable bundle',
    }
    w = applyCommand(w, { type: 'project', value: project })
    expect(w.projects).toHaveLength(1)
    expect(w.projects[0].name).toBe('Mentage - Sprint 2')
    expect(w.projects[0].clientId).toBe(client.id)

    // Attempt to link project to non-existent client fails
    expect(() =>
      applyCommand(w, {
        type: 'project',
        value: {
          id: crypto.randomUUID(),
          name: 'Orphan Project',
          clientId: crypto.randomUUID(),
          notes: '',
        },
      })
    ).toThrow('Client not found')

    // Deleting the client detaches the project gracefully (sets clientId to empty)
    w = applyCommand(w, { type: 'deleteClient', id: client.id })
    expect(w.clients).toHaveLength(0)
    expect(w.projects[0].clientId).toBe('')

    // Delete project
    w = applyCommand(w, { type: 'deleteProject', id: project.id })
    expect(w.projects).toHaveLength(0)
  })

  it('manages saved services supporting fixed, hourly, and unit pricing', () => {
    let w = emptyWorkspace()
    const designService: Service = {
      id: crypto.randomUUID(),
      name: 'Product Design Sprint',
      description: 'Full 5-day design sprint covering UX wireframes and prototypes',
      rate: '3500.00',
      unit: 'fixed',
    }
    const devService: Service = {
      id: crypto.randomUUID(),
      name: 'Senior Engineering',
      description: 'Full-stack development and architecture consulting',
      rate: '150.00',
      unit: 'hour',
    }
    const hostingService: Service = {
      id: crypto.randomUUID(),
      name: 'Cloud Compute Unit',
      description: 'Dedicated edge worker instance allocation',
      rate: '25.00',
      unit: 'unit',
    }

    w = applyCommand(w, { type: 'service', value: designService })
    w = applyCommand(w, { type: 'service', value: devService })
    w = applyCommand(w, { type: 'service', value: hostingService })
    expect(w.services).toHaveLength(3)

    // Update service
    w = applyCommand(w, {
      type: 'service',
      value: { ...devService, rate: '175.00' },
    })
    const dev = w.services.find(s => s.id === devService.id)!
    expect(dev.rate).toBe('175.00')

    // Delete service
    w = applyCommand(w, { type: 'deleteService', id: hostingService.id })
    expect(w.services).toHaveLength(2)
  })

  it('populates a complete draft from reusable client, project, and saved service copies', () => {
    let w = emptyWorkspace()
    w.business.name = 'Humza Studios Ltd'
    w.business.address = 'London, UK'
    w.business.bank = 'Sort 00-00-00 Acc 11223344'
    w.business.currency = 'GBP'
    w.business.terms = 30

    // Setup reusable records
    const client: Client = {
      id: crypto.randomUUID(),
      name: 'Mentage Global',
      email: 'billing@mentage.com',
      address: '1 Canada Square, Canary Wharf, London',
      cc: ['finance@mentage.com'],
      replyTo: 'humza@example.com',
      terms: 14,
      notes: 'Net 14 payment terms agreed in MSA',
    }
    w = applyCommand(w, { type: 'client', value: client })

    const project: Project = {
      id: crypto.randomUUID(),
      name: 'Mentage - Sprint 2',
      clientId: client.id,
      notes: 'Sprint 2 frontend architecture',
    }
    w = applyCommand(w, { type: 'project', value: project })

    const service: Service = {
      id: crypto.randomUUID(),
      name: 'Sprint Engineering',
      description: '50 hours of senior engineering and API integration',
      rate: '150.00',
      unit: 'hour',
    }
    w = applyCommand(w, { type: 'service', value: service })

    // Simulate composer behavior when choosing client, project, and service:
    // 1. Choosing client copies client details, sets terms and recalculates dueDate
    const draft = newInvoice(w)
    draft.clientId = client.id
    draft.client = structuredClone(client)
    draft.terms = client.terms
    draft.dueDate = addDays(draft.issueDate, client.terms)

    // 2. Choosing project
    draft.projectId = project.id

    // 3. Choosing service copies by value into line items
    draft.lines = [
      {
        id: crypto.randomUUID(),
        description: service.description || service.name,
        quantity: '50',
        rate: service.rate,
        unit: service.unit,
      },
    ]

    w = applyCommand(w, { type: 'draft', value: draft })
    expect(w.invoices).toHaveLength(1)

    // Verify calculated totals
    const t = totals(w.invoices[0])
    expect(t.subtotal).toBe('7500.00')
    expect(t.total).toBe('7500.00')
    expect(t.balance).toBe('7500.00')

    // Issue invoice to lock snapshot
    w = applyCommand(w, { type: 'issue', id: draft.id })
    const issuedInvoice = w.invoices.find(i => i.id === draft.id)!
    expect(issuedInvoice.lifecycle).toBe('issued')
    expect(issuedInvoice.number).toMatch(/^INV-\d{4}-0001$/)
    expect(issuedInvoice.business?.name).toBe('Humza Studios Ltd')
    expect(issuedInvoice.client.name).toBe('Mentage Global')
    expect(issuedInvoice.lines[0].rate).toBe('150.00')

    // 4. Edit reusable records afterwards:
    // Modify business
    w = applyCommand(w, {
      type: 'business',
      value: { ...w.business, name: 'Renamed Business Holdings' },
    })
    // Modify client
    w = applyCommand(w, {
      type: 'client',
      value: { ...client, name: 'Mentage Global Inc (Updated)', address: 'New Address, New York' },
    })
    // Modify service rate
    w = applyCommand(w, {
      type: 'service',
      value: { ...service, rate: '250.00', description: 'Updated service description' },
    })
    // Delete service and client
    w = applyCommand(w, { type: 'deleteService', id: service.id })
    w = applyCommand(w, { type: 'deleteClient', id: client.id })

    // 5. Verify the issued invoice snapshot is completely intact and unchanged!
    const historical = w.invoices.find(i => i.id === draft.id)!
    expect(historical.business?.name).toBe('Humza Studios Ltd')
    expect(historical.client.name).toBe('Mentage Global')
    expect(historical.client.address).toBe('1 Canada Square, Canary Wharf, London')
    expect(historical.lines[0].rate).toBe('150.00')
    expect(historical.lines[0].description).toBe('50 hours of senior engineering and API integration')
    expect(totals(historical).total).toBe('7500.00')
  })

  it('adapts postal code, state, tax ID labels and phone placeholders by country', () => {
    const uk = getCountryFieldLabels('GB')
    expect(uk.postalCodeLabel).toBe('Postcode')
    expect(uk.stateLabel).toBe('County / Region (optional)')
    expect(uk.taxIdLabel).toBe('VAT number / Company Reg (optional)')
    expect(uk.phonePlaceholder).toContain('+44')

    const us = getCountryFieldLabels('United States')
    expect(us.postalCodeLabel).toBe('ZIP code')
    expect(us.stateLabel).toBe('State')
    expect(us.taxIdLabel).toBe('EIN / Tax ID (optional)')
    expect(us.phonePlaceholder).toContain('+1')

    const ca = getCountryFieldLabels('CA')
    expect(ca.postalCodeLabel).toBe('Postal code')
    expect(ca.stateLabel).toBe('Province / Territory')
    expect(ca.taxIdLabel).toBe('BN / GST/HST number (optional)')

    const au = getCountryFieldLabels('Australia')
    expect(au.postalCodeLabel).toBe('Postcode')
    expect(au.stateLabel).toBe('State / Territory')
    expect(au.taxIdLabel).toBe('ABN / ACN (optional)')

    const de = getCountryFieldLabels('DE')
    expect(de.postalCodeLabel).toBe('Postleitzahl (PLZ)')
    expect(de.taxIdLabel).toBe('USt-IdNr. / Steuernummer (optional)')

    const fallback = getCountryFieldLabels('')
    expect(fallback.postalCodeLabel).toBe('Postal / ZIP code')
    expect(fallback.stateLabel).toBe('State / County / Province')
    expect(fallback.taxIdLabel).toBe('Tax ID / VAT number (optional)')
  })

  it('formats separated address fields into structured multiline text with fallback', () => {
    // Structured separated fields
    const separated = {
      addressLine1: 'Suite 400',
      addressLine2: '100 King Street West',
      city: 'Toronto',
      state: 'ON',
      postalCode: 'M5X 1A9',
      country: 'Canada',
    }
    const lines = formatClientAddressLines(separated)
    expect(lines).toEqual([
      'Suite 400',
      '100 King Street West',
      'Toronto, ON, M5X 1A9',
      'Canada',
    ])
    expect(formatClientAddress(separated)).toBe(
      'Suite 400\n100 King Street West\nToronto, ON, M5X 1A9\nCanada'
    )

    // Legacy unstructured address fallback
    const legacy = {
      address: '221B Baker Street\nMarylebone\nLondon NW1 6XE',
    }
    expect(formatClientAddressLines(legacy)).toEqual([
      '221B Baker Street',
      'Marylebone',
      'London NW1 6XE',
    ])
    expect(formatClientAddress(legacy)).toBe(
      '221B Baker Street\nMarylebone\nLondon NW1 6XE'
    )

    // Empty client
    expect(formatClientAddressLines({})).toEqual([])
    expect(formatClientAddress({})).toBe('')
  })

  it('creates and updates clients with contact, phone, separated address, and country tax ID', () => {
    let w = emptyWorkspace()
    w.business.name = 'Logistics Studio Ltd'
    w.business.address = '100 Commercial Road, London E1 1RD'
    const client: Client = {
      ...blankClient(),
      id: crypto.randomUUID(),
      name: 'Northwind Logistics GmbH',
      email: 'invoicing@northwind.de',
      contact: 'Hans Gruber',
      phone: '+49 30 1234567',
      addressLine1: 'Friedrichstraße 43',
      addressLine2: 'Gebäude B',
      city: 'Berlin',
      state: 'Berlin',
      postalCode: '10117',
      country: 'Germany',
      taxId: 'DE123456789',
      terms: 14,
    }
    client.address = formatClientAddress(client)

    // Create client in workspace
    w = applyCommand(w, { type: 'client', value: client })
    expect(w.clients).toHaveLength(1)
    const saved = w.clients[0]
    expect(saved.contact).toBe('Hans Gruber')
    expect(saved.phone).toBe('+49 30 1234567')
    expect(saved.city).toBe('Berlin')
    expect(saved.country).toBe('Germany')
    expect(saved.taxId).toBe('DE123456789')
    expect(saved.address).toContain('Friedrichstraße 43')
    expect(saved.address).toContain('Berlin, Berlin, 10117')

    // Create draft and issue invoice with enriched client details
    const draft = newInvoice(w)
    draft.clientId = client.id
    draft.client = structuredClone(client)
    draft.lines = [{ id: crypto.randomUUID(), description: 'Customs Consulting', quantity: '1', rate: '1200.00', unit: 'fixed' }]
    w = applyCommand(w, { type: 'draft', value: draft })
    w = applyCommand(w, { type: 'issue', id: draft.id })

    const issued = w.invoices.find(i => i.id === draft.id)!
    expect(issued.lifecycle).toBe('issued')
    expect(issued.client.contact).toBe('Hans Gruber')
    expect(issued.client.phone).toBe('+49 30 1234567')
    expect(issued.client.country).toBe('Germany')
    expect(issued.client.taxId).toBe('DE123456789')
    expect(issued.client.postalCode).toBe('10117')
  })

  it('supports separated address fields for business settings and formats consistently', () => {
    let w = emptyWorkspace()
    w = applyCommand(w, {
      type: 'business',
      value: {
        ...w.business,
        name: 'Acme Global Ltd',
        country: 'United Kingdom',
        addressLine1: 'Suite 404, Innovation House',
        addressLine2: '77 Kingsway',
        city: 'London',
        state: 'Greater London',
        postalCode: 'WC2B 6SR',
        address: formatAddress({
          country: 'United Kingdom',
          addressLine1: 'Suite 404, Innovation House',
          addressLine2: '77 Kingsway',
          city: 'London',
          state: 'Greater London',
          postalCode: 'WC2B 6SR',
        }),
      },
    })

    expect(w.business.addressLine1).toBe('Suite 404, Innovation House')
    expect(w.business.addressLine2).toBe('77 Kingsway')
    expect(w.business.city).toBe('London')
    expect(w.business.state).toBe('Greater London')
    expect(w.business.postalCode).toBe('WC2B 6SR')
    expect(w.business.country).toBe('United Kingdom')
    expect(w.business.address).toBe(
      'Suite 404, Innovation House\n77 Kingsway\nLondon, Greater London, WC2B 6SR\nUnited Kingdom'
    )
  })
})
