-- New application tables coexist with the initial prototype tables; no old data is deleted.
CREATE TABLE IF NOT EXISTS auth_user (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, email_verified boolean NOT NULL DEFAULT false, image text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS auth_session (id text PRIMARY KEY, expires_at timestamptz NOT NULL, token text NOT NULL UNIQUE, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, ip_address text, user_agent text, user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS auth_session_user_idx ON auth_session(user_id);
CREATE TABLE IF NOT EXISTS auth_account (id text PRIMARY KEY, account_id text NOT NULL, provider_id text NOT NULL, user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, access_token text, refresh_token text, id_token text, access_token_expires_at timestamptz, refresh_token_expires_at timestamptz, scope text, password text, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS auth_verification (id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS auth_verification_identifier_idx ON auth_verification(identifier);
CREATE TABLE IF NOT EXISTS auth_rate_limit (id text PRIMARY KEY, key text NOT NULL UNIQUE, count bigint NOT NULL, last_request bigint NOT NULL);
-- Owner-scoped aggregates permit atomic edits, numbering and ledger updates with one CAS.
-- The personal workspace uses a 5MB document limit; split into per-invoice rows before scaling to large teams.
CREATE TABLE IF NOT EXISTS invoice_workspaces (owner_id text PRIMARY KEY REFERENCES auth_user(id), version integer NOT NULL DEFAULT 0, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), CHECK(version>=0), CHECK(jsonb_typeof(data)='object'));
CREATE TABLE IF NOT EXISTS invoice_webhook_events (id text PRIMARY KEY, received_at timestamptz NOT NULL DEFAULT now());
