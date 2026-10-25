-- New isolated table. Does not change tables from any previous application.
create table if not exists public.ecosystem_documents (
 user_id uuid not null references auth.users(id) on delete cascade,
 module text not null check (module in ('centro','iris','mi-espacio','journal','organizador')),
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 12000000),
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now(),
 primary key (user_id,module)
);
alter table public.ecosystem_documents enable row level security;
revoke all on public.ecosystem_documents from anon;
grant select,insert,update on public.ecosystem_documents to authenticated;
create policy "Read own ecosystem" on public.ecosystem_documents for select to authenticated using ((select auth.uid())=user_id);
create policy "Insert own ecosystem" on public.ecosystem_documents for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Update own ecosystem" on public.ecosystem_documents for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

-- Optimistic revisions prevent a second device from silently replacing newer data.
create or replace function public.ecosystem_save_document(p_module text,p_payload jsonb,p_expected bigint)
returns table(revision bigint) language plpgsql security invoker set search_path = '' as $$
declare saved_revision bigint;
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
 if p_expected < 0 then raise exception 'Invalid revision' using errcode='22023'; end if;
 if p_expected=0 then
  insert into public.ecosystem_documents(user_id,module,payload,revision)
  values(auth.uid(),p_module,p_payload,1)
  on conflict do nothing returning ecosystem_documents.revision into saved_revision;
 else
  update public.ecosystem_documents d set payload=p_payload,revision=d.revision+1,updated_at=now()
  where d.user_id=auth.uid() and d.module=p_module and d.revision=p_expected returning d.revision into saved_revision;
 end if;
 if saved_revision is null then raise exception 'Another device changed this space' using errcode='40001'; end if;
 return query select saved_revision;
end $$;
revoke all on function public.ecosystem_save_document(text,jsonb,bigint) from public,anon;
grant execute on function public.ecosystem_save_document(text,jsonb,bigint) to authenticated;
