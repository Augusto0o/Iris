-- Mobile endpoints use verified sessions or scoped, revocable shortcut tokens.
-- These tables have no client privileges; the Edge function owns all access.
create table public.ecosystem_mobile_secrets(key text primary key,value jsonb not null);
create table public.ecosystem_push_subscriptions(
 endpoint text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 subscription jsonb not null, created_at timestamptz not null default now()
);
create index ecosystem_push_owner on public.ecosystem_push_subscriptions(user_id);
create table public.ecosystem_shortcut_tokens(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 token_hash text not null unique,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '365 days',revoked_at timestamptz
);
create index ecosystem_shortcut_owner on public.ecosystem_shortcut_tokens(user_id);
create table public.ecosystem_mobile_receipts(
 user_id uuid not null references auth.users(id) on delete cascade,key text not null,
 result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,key)
);
create table public.ecosystem_push_deliveries(
 endpoint text not null references public.ecosystem_push_subscriptions(endpoint) on delete cascade,
 key text not null,claimed_at timestamptz not null default now(),sent_at timestamptz,primary key(endpoint,key)
);
alter table public.ecosystem_mobile_secrets enable row level security;
alter table public.ecosystem_push_subscriptions enable row level security;
alter table public.ecosystem_shortcut_tokens enable row level security;
alter table public.ecosystem_mobile_receipts enable row level security;
alter table public.ecosystem_push_deliveries enable row level security;
revoke all on public.ecosystem_mobile_secrets,public.ecosystem_push_subscriptions,public.ecosystem_shortcut_tokens,public.ecosystem_mobile_receipts,public.ecosystem_push_deliveries from public,anon,authenticated;
grant all on public.ecosystem_mobile_secrets,public.ecosystem_push_subscriptions,public.ecosystem_shortcut_tokens,public.ecosystem_mobile_receipts,public.ecosystem_push_deliveries to service_role;
-- Atomic expected-revision write + receipt: retries cannot create duplicate records.
create function public.ecosystem_mobile_append(p_user uuid,p_module text,p_payload jsonb,p_expected bigint,p_key text,p_result jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare prior jsonb; saved bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select result into prior from public.ecosystem_mobile_receipts where user_id=p_user and key=p_key;
 if prior is not null then return prior;end if;
 update public.ecosystem_documents set payload=p_payload,revision=revision+1,updated_at=now()
 where user_id=p_user and module=p_module and revision=p_expected returning revision into saved;
 if saved is null then raise exception 'Concurrent change' using errcode='40001';end if;
 insert into public.ecosystem_mobile_receipts(user_id,key,result) values(p_user,p_key,p_result);
 return p_result;
end $$;
revoke all on function public.ecosystem_mobile_append(uuid,text,jsonb,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.ecosystem_mobile_append(uuid,text,jsonb,bigint,text,jsonb) to service_role;
create table public.ecosystem_push_timers(user_id uuid not null references auth.users(id) on delete cascade,id text not null,due_at timestamptz not null,payload jsonb not null,primary key(user_id,id));
alter table public.ecosystem_push_timers enable row level security;
revoke all on public.ecosystem_push_timers from public,anon,authenticated;
grant all on public.ecosystem_push_timers to service_role;
