-- ============================================================
-- Add Suria Dan Sonne Sdn Bhd as a client
-- Fill in their WhatsApp credentials once received, then run
-- in Supabase SQL Editor.
-- ============================================================

do $$
declare
  v_tenant_id uuid;
  v_user_id   uuid;
begin

  insert into tenants (name, whatsapp_phone_number_id, whatsapp_access_token)
  values (
    'Suria Dan Sonne Sdn Bhd',
    'PASTE_THEIR_PHONE_NUMBER_ID_HERE',
    'PASTE_THEIR_ACCESS_TOKEN_HERE'
  )
  returning id into v_tenant_id;

  -- Create a default bot config for them
  -- (edit the system prompt via Bot Settings once logged in)
  insert into bot_config (tenant_id, bot_name, system_prompt)
  values (
    v_tenant_id,
    'Assistant',
    'You are a helpful customer service assistant for Suria Dan Sonne Sdn Bhd. Be friendly, concise, and professional. Reply in the same language the customer uses (Bahasa Malaysia or English).'
  );

  -- Assign their login once their Supabase user is created
  -- Uncomment and fill in their email:
  -- select id into v_user_id from auth.users where email = 'THEIR_EMAIL_HERE' limit 1;
  -- if v_user_id is not null then
  --   insert into tenant_users (user_id, tenant_id) values (v_user_id, v_tenant_id);
  -- end if;

  raise notice 'Suria Dan Sonne tenant created with id: %', v_tenant_id;
end;
$$;
