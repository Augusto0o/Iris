create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
insert into public.ecosystem_mobile_secrets(key,value) values('scheduler',jsonb_build_object('token',encode(extensions.gen_random_bytes(32),'hex'))) on conflict do nothing;
select cron.schedule('ecosystem-mobile-reminders','* * * * *',$job$
 select net.http_post(
  url:='https://kujsafgtmrtqezdugsag.supabase.co/functions/v1/mobile',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select value->>'token' from public.ecosystem_mobile_secrets where key='scheduler')),
  body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=50000
 );
$job$);
