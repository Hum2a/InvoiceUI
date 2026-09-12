-- Additive Row Level Security migration enforcing tenant isolation and defense in depth.
-- The FORCE option ensures policies apply to table owners and all connections.

ALTER TABLE invoice_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_workspaces FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_workspaces_tenant_isolation ON invoice_workspaces;
CREATE POLICY invoice_workspaces_tenant_isolation ON invoice_workspaces FOR ALL USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '') OR current_setting('app.service_role', true) = 'worker') WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '') OR current_setting('app.service_role', true) = 'worker');

ALTER TABLE invoice_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_webhook_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_webhook_events_service ON invoice_webhook_events;
CREATE POLICY invoice_webhook_events_service ON invoice_webhook_events FOR ALL USING (current_setting('app.service_role', true) = 'worker') WITH CHECK (current_setting('app.service_role', true) = 'worker');

ALTER TABLE auth_user ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_user_service ON auth_user;
CREATE POLICY auth_user_service ON auth_user FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE auth_session ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_session_service ON auth_session;
CREATE POLICY auth_session_service ON auth_session FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE auth_account ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_account_service ON auth_account;
CREATE POLICY auth_account_service ON auth_account FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE auth_verification ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_verification_service ON auth_verification;
CREATE POLICY auth_verification_service ON auth_verification FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE auth_rate_limit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_rate_limit_service ON auth_rate_limit;
CREATE POLICY auth_rate_limit_service ON auth_rate_limit FOR ALL USING (true) WITH CHECK (true);
