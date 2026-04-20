-- ============================================================
-- Seed ejas.io as the first client tenant
-- Fill in your WhatsApp Access Token below, then run this in
-- the Supabase SQL Editor. Run migration_003 first.
-- ============================================================

do $$
declare
  v_tenant_id uuid;
  v_user_id   uuid;
begin

  -- 1. Create ejas.io tenant
  insert into tenants (name, whatsapp_phone_number_id, whatsapp_access_token)
  values (
    'ejas.io',
    '1052019637997174',
    'PASTE_YOUR_WHATSAPP_ACCESS_TOKEN_HERE'   -- ← only thing to fill in
  )
  returning id into v_tenant_id;

  -- 2. Link the existing bot_config row to this tenant
  --    (deletes the blank default one the admin UI would create)
  update bot_config
  set tenant_id = v_tenant_id
  where tenant_id is null;

  -- 3. Link all existing conversations to this tenant
  update conversations
  set tenant_id = v_tenant_id
  where tenant_id is null;

  -- 4. Assign your login to this tenant
  select id into v_user_id
  from auth.users
  where email = 'ejas.io.support@gmail.com'
  limit 1;

  if v_user_id is not null then
    insert into tenant_users (user_id, tenant_id)
    values (v_user_id, v_tenant_id)
    on conflict do nothing;
  end if;

  raise notice 'ejas.io tenant created with id: %', v_tenant_id;
end;
$$;
