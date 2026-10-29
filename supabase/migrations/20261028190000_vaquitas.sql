-- Vaquitas para Nubo (numio). Solo crea tablas nuevas con prefijo vq_: no toca ni borra nada existente.
-- Correr una vez en Supabase › SQL Editor.

create extension if not exists pgcrypto;

-- Grupo: un viaje (con varias vaquitas adentro) o una juntada (una sola cuenta)
create table if not exists vq_groups (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind          text not null default 'juntada' check (kind in ('viaje','juntada')),
  title         text not null check (length(title) between 1 and 80),
  starts_on     date,
  ends_on       date,
  currency      text not null default 'ARS',
  status        text not null default 'open' check (status in ('open','settled')),
  share_token   text not null unique default encode(gen_random_bytes(12),'hex'),
  link_can_edit boolean not null default false,          -- "Cualquiera con el link" puede cargar
  created_at    timestamptz not null default now()
);

-- Gente del grupo. user_id queda vacío para quien no tiene cuenta (se suma por nombre).
create table if not exists vq_participants (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references vq_groups(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  name       text not null check (length(name) between 1 and 60),
  alias_cbu  text,
  can_edit   boolean not null default true,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

-- Vaquitas dentro de un viaje (nafta, hospedaje, asado…), cada una con su gente
create table if not exists vq_vaquitas (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references vq_groups(id) on delete cascade,
  title      text not null check (length(title) between 1 and 60),
  status     text not null default 'open' check (status in ('open','settled')),
  created_at timestamptz not null default now()
);
create table if not exists vq_vaquita_members (
  vaquita_id     uuid not null references vq_vaquitas(id) on delete cascade,
  participant_id uuid not null references vq_participants(id) on delete cascade,
  primary key (vaquita_id, participant_id)
);

-- Gastos. vaquita_id null = gasto suelto del viaje / gasto de la juntada
create table if not exists vq_expenses (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references vq_groups(id) on delete cascade,
  vaquita_id  uuid references vq_vaquitas(id) on delete cascade,
  title       text not null check (length(title) between 1 and 80),
  amount      numeric(14,2) not null check (amount > 0),
  currency    text not null default 'ARS',
  payer_id    uuid not null references vq_participants(id) on delete cascade,
  split_mode  text not null default 'equal' check (split_mode in ('equal','exact','shares','percent')),
  spent_on    date not null default current_date,
  receipt_ref text,                                         -- n.° de operación de Mercado Pago, evita duplicados
  numio_txn   uuid,                                         -- movimiento de numio vinculado (lo que pagaste vos)
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  unique (group_id, receipt_ref)
);
create table if not exists vq_expense_shares (
  expense_id     uuid not null references vq_expenses(id) on delete cascade,
  participant_id uuid not null references vq_participants(id) on delete cascade,
  value          numeric(14,4),                             -- monto (exact), partes (shares) o % (percent); vacío en equal
  primary key (expense_id, participant_id)
);

-- Transferencias marcadas como "Pagado"
create table if not exists vq_payments (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references vq_groups(id) on delete cascade,
  vaquita_id uuid references vq_vaquitas(id) on delete cascade,
  from_id    uuid not null references vq_participants(id) on delete cascade,
  to_id      uuid not null references vq_participants(id) on delete cascade,
  amount     numeric(14,2) not null check (amount > 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);

create index if not exists vq_part_user  on vq_participants(user_id);
create index if not exists vq_exp_group  on vq_expenses(group_id);
create index if not exists vq_pay_group  on vq_payments(group_id);

-- ── Permisos ────────────────────────────────────────────────────────────────
-- Ve el grupo: quien lo armó y cualquier participante con cuenta vinculada.
-- Edita: quien lo armó y participantes con can_edit, solo mientras el grupo está abierto.
create or replace function vq_can_view(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from vq_groups where id = g and owner_id = auth.uid())
      or exists (select 1 from vq_participants where group_id = g and user_id = auth.uid());
$$;
create or replace function vq_can_edit(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from vq_groups where id = g and owner_id = auth.uid())
      or exists (select 1 from vq_participants p join vq_groups gr on gr.id = p.group_id
                 where p.group_id = g and p.user_id = auth.uid() and p.can_edit and gr.status = 'open');
$$;

alter table vq_groups          enable row level security;
alter table vq_participants    enable row level security;
alter table vq_vaquitas        enable row level security;
alter table vq_vaquita_members enable row level security;
alter table vq_expenses        enable row level security;
alter table vq_expense_shares  enable row level security;
alter table vq_payments        enable row level security;

drop policy if exists vq_groups_sel on vq_groups;
-- owner_id directo: sin esto, insert … returning falla porque la fila nueva todavía no la ve la función
create policy vq_groups_sel on vq_groups for select using (owner_id = auth.uid() or vq_can_view(id));
drop policy if exists vq_groups_ins on vq_groups;
create policy vq_groups_ins on vq_groups for insert with check (owner_id = auth.uid());
drop policy if exists vq_groups_upd on vq_groups;
create policy vq_groups_upd on vq_groups for update using (owner_id = auth.uid());
drop policy if exists vq_groups_del on vq_groups;
create policy vq_groups_del on vq_groups for delete using (owner_id = auth.uid());

do $$ declare t text; begin
  foreach t in array array['vq_participants','vq_vaquitas','vq_expenses','vq_payments'] loop
    execute format('drop policy if exists %1$s_sel on %1$s', t);
    execute format('create policy %1$s_sel on %1$s for select using (vq_can_view(group_id))', t);
    execute format('drop policy if exists %1$s_all on %1$s', t);
    execute format('create policy %1$s_all on %1$s for all using (vq_can_edit(group_id)) with check (vq_can_edit(group_id))', t);
  end loop;
end $$;

drop policy if exists vq_members_sel on vq_vaquita_members;
create policy vq_members_sel on vq_vaquita_members for select
  using (vq_can_view((select group_id from vq_vaquitas v where v.id = vaquita_id)));
drop policy if exists vq_members_all on vq_vaquita_members;
create policy vq_members_all on vq_vaquita_members for all
  using (vq_can_edit((select group_id from vq_vaquitas v where v.id = vaquita_id)))
  with check (vq_can_edit((select group_id from vq_vaquitas v where v.id = vaquita_id)));

drop policy if exists vq_shares_sel on vq_expense_shares;
create policy vq_shares_sel on vq_expense_shares for select
  using (vq_can_view((select group_id from vq_expenses e where e.id = expense_id)));
drop policy if exists vq_shares_all on vq_expense_shares;
create policy vq_shares_all on vq_expense_shares for all
  using (vq_can_edit((select group_id from vq_expenses e where e.id = expense_id)))
  with check (vq_can_edit((select group_id from vq_expenses e where e.id = expense_id)));

-- ── Link público ────────────────────────────────────────────────────────────
-- Cualquiera con el link ve la vaquita sin cuenta (solo lectura). No expone user_id.
create or replace function vq_shared(token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'group', jsonb_build_object('id', g.id, 'kind', g.kind, 'title', g.title, 'startsOn', g.starts_on,
                                'endsOn', g.ends_on, 'status', g.status, 'linkCanEdit', g.link_can_edit),
    'participants', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'aliasCbu', p.alias_cbu, 'linked', p.user_id is not null) order by p.created_at)
                              from vq_participants p where p.group_id = g.id), '[]'),
    'vaquitas', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'title', v.title, 'status', v.status,
                              'memberIds', (select coalesce(jsonb_agg(m.participant_id), '[]') from vq_vaquita_members m where m.vaquita_id = v.id)) order by v.created_at)
                          from vq_vaquitas v where v.group_id = g.id), '[]'),
    'expenses', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'vaquitaId', e.vaquita_id, 'title', e.title, 'amount', e.amount,
                              'payerId', e.payer_id, 'splitMode', e.split_mode, 'spentOn', e.spent_on,
                              'shares', (select coalesce(jsonb_agg(jsonb_build_object('participantId', s.participant_id, 'value', s.value)), '[]')
                                         from vq_expense_shares s where s.expense_id = e.id)) order by e.spent_on, e.created_at)
                          from vq_expenses e where e.group_id = g.id), '[]'),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'vaquitaId', x.vaquita_id, 'fromId', x.from_id, 'toId', x.to_id, 'amount', x.amount))
                          from vq_payments x where x.group_id = g.id), '[]'))
  from vq_groups g where g.share_token = token;
$$;
grant execute on function vq_shared(text) to anon, authenticated;

-- Sumarse con el link: vincula tu cuenta a un participante existente (o crea uno nuevo con tu nombre)
create or replace function vq_join(token text, participant uuid default null, display_name text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare g vq_groups; pid uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into g from vq_groups where share_token = token;
  if g.id is null then raise exception 'No encontramos esta vaquita'; end if;
  select id into pid from vq_participants where group_id = g.id and user_id = auth.uid();
  if pid is not null then return pid; end if;
  if participant is not null then
    update vq_participants set user_id = auth.uid(), can_edit = g.link_can_edit
     where id = participant and group_id = g.id and user_id is null returning id into pid;
    if pid is null then raise exception 'Esa persona ya está vinculada a otra cuenta'; end if;
  else
    insert into vq_participants(group_id, user_id, name, can_edit)
    values (g.id, auth.uid(), coalesce(nullif(trim(display_name), ''), 'Yo'), g.link_can_edit) returning id into pid;
  end if;
  return pid;
end $$;
grant execute on function vq_join(text, uuid, text) to authenticated;

-- ── Amigos por @usuario ─────────────────────────────────────────────────────
create table if not exists vq_profiles (
  user_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  name         text not null check (length(name) between 1 and 60),
  alias_cbu    text,
  friends_only boolean not null default false,          -- solo mis amigos me pueden sumar a vaquitas
  created_at   timestamptz not null default now()
);
create table if not exists vq_friends (
  requester  uuid not null references auth.users(id) on delete cascade,
  addressee  uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
alter table vq_profiles enable row level security;
alter table vq_friends  enable row level security;

create or replace function vq_are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from vq_friends where status = 'accepted'
                 and ((requester = a and addressee = b) or (requester = b and addressee = a)));
$$;

-- tu perfil lo editás vos; lo ven tus amigos, quienes te mandaron o les mandaste solicitud, y quienes comparten una vaquita con vos
drop policy if exists vq_profiles_own on vq_profiles;
create policy vq_profiles_own on vq_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists vq_profiles_sel on vq_profiles;
create policy vq_profiles_sel on vq_profiles for select using (
  user_id = auth.uid()
  or exists (select 1 from vq_friends f where (f.requester = auth.uid() and f.addressee = user_id) or (f.addressee = auth.uid() and f.requester = user_id))
  or exists (select 1 from vq_participants a join vq_participants b on a.group_id = b.group_id where a.user_id = auth.uid() and b.user_id = vq_profiles.user_id));

drop policy if exists vq_friends_sel on vq_friends;
create policy vq_friends_sel on vq_friends for select using (auth.uid() in (requester, addressee));
drop policy if exists vq_friends_ins on vq_friends;
create policy vq_friends_ins on vq_friends for insert with check (requester = auth.uid() and status = 'pending');
drop policy if exists vq_friends_upd on vq_friends;
create policy vq_friends_upd on vq_friends for update using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
drop policy if exists vq_friends_del on vq_friends;
create policy vq_friends_del on vq_friends for delete using (auth.uid() in (requester, addressee));

-- buscar por @usuario exacto: devuelve solo nombre y usuario, nunca el mail
create or replace function vq_find_user(handle text) returns table (user_id uuid, username text, name text)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.name from vq_profiles p
  where p.username = lower(trim(both '@' from trim(handle))) and p.user_id <> auth.uid() and auth.uid() is not null;
$$;
grant execute on function vq_find_user(text) to authenticated;

-- sumar a alguien con cuenta a una vaquita: solo a tus amigos (o a cualquiera que no lo haya restringido, si ya te aceptó)
create or replace function vq_check_participant() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null and new.user_id <> auth.uid() and (tg_op = 'INSERT' or new.user_id is distinct from old.user_id) then
    if not vq_are_friends(auth.uid(), new.user_id) then
      raise exception 'Solo podés sumar con su cuenta a tus amigos';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists vq_participant_check on vq_participants;
create trigger vq_participant_check before insert or update on vq_participants for each row execute function vq_check_participant();

-- ── Recordatorios de pago ──────────────────────────────────────────────────
create table if not exists vq_reminders (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references vq_groups(id) on delete cascade,
  from_id    uuid not null references vq_participants(id) on delete cascade,  -- quien cobra
  to_id      uuid not null references vq_participants(id) on delete cascade,  -- quien debe
  amount     numeric(14,2) not null check (amount > 0),
  seen       boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists vq_rem_to on vq_reminders(to_id);
alter table vq_reminders enable row level security;
drop policy if exists vq_rem_ins on vq_reminders;
create policy vq_rem_ins on vq_reminders for insert with check (vq_can_view(group_id) and created_by = auth.uid());
drop policy if exists vq_rem_sel on vq_reminders;
create policy vq_rem_sel on vq_reminders for select using (
  created_by = auth.uid() or exists (select 1 from vq_participants p where p.id = to_id and p.user_id = auth.uid()));
drop policy if exists vq_rem_upd on vq_reminders;
create policy vq_rem_upd on vq_reminders for update using (exists (select 1 from vq_participants p where p.id = to_id and p.user_id = auth.uid())) with check (seen);
