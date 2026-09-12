CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, name text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL, email text, address text, logo_url text, currency char(3) NOT NULL DEFAULT 'GBP', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL, email text, address text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL, invoice_number text NOT NULL UNIQUE,
  client_name text NOT NULL, client_email text, status text NOT NULL CHECK (status IN ('draft','sent','paid','overdue','void')),
  currency char(3) NOT NULL DEFAULT 'GBP', tax_rate numeric(5,2) NOT NULL DEFAULT 0, due_date date NOT NULL,
  subtotal numeric(12,2) NOT NULL, total numeric(12,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position integer NOT NULL, description text NOT NULL, quantity numeric(12,2) NOT NULL, unit_price numeric(12,2) NOT NULL, line_total numeric(12,2) NOT NULL
);
CREATE INDEX invoices_business_created_idx ON invoices (business_id, created_at DESC);
