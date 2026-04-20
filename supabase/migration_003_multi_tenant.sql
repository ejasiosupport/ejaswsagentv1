-- Multi-tenancy: one deployment, multiple clients

-- Each client is a tenant with their own WhatsApp credentials
create table tenants (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  whatsapp_phone_number_id text unique not null,
  whatsapp_access_token text not null,
  created_at timestamp with time zone default now()
);

-- Links Supabase auth users to a tenant (one user = one tenant for now)
create table tenant_users (
  user_id uuid references auth.users(id) on delete cascade not null,
  tenant_id uuid references tenants(id) on delete cascade not null,
  primary key (user_id, tenant_id)
);

-- Scope conversations to a tenant
alter table conversations add column tenant_id uuid references tenants(id) on delete cascade;

-- Allow same phone number across different tenants (same customer, different clients)
alter table conversations drop constraint conversations_phone_key;
create unique index conversations_phone_tenant_unique
  on conversations(phone, tenant_id)
  where tenant_id is not null;

-- Scope bot_config to a tenant (one config per tenant)
alter table bot_config add column tenant_id uuid references tenants(id) on delete cascade unique;
