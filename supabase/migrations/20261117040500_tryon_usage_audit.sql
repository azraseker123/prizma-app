-- Historical snapshots show only the state recorded at migration time, not invented historical transitions.
-- Append-only operational metadata; user images and private signed URLs are never stored here.
create table if not exists public.tryon_audit_events (
 id bigint generated always as identity primary key,
 job_id uuid not null,
 user_id uuid not null,
 event_type text not null check(event_type in ('created','submitted','processing','completed','failed','deleted','prior_state_snapshot')),
 from_status text,
 to_status text not null,
 event_time timestamptz not null default now(),
 credit_effect text not null check(credit_effect in ('reserved','retained','released')),
 source text not null default 'database_trigger'
);
create index if not exists tryon_audit_user_time_idx on public.tryon_audit_events(user_id,event_time desc);
create index if not exists tryon_audit_job_time_idx on public.tryon_audit_events(job_id,event_time desc);
alter table public.tryon_audit_events enable row level security;
revoke all on public.tryon_audit_events from public,anon,authenticated;

create or replace function public.tryon_audit_append_only()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 raise exception 'Audit event ledger is append-only';
end $fn$;
revoke all on function public.tryon_audit_append_only() from public,anon,authenticated;
drop trigger if exists tryon_audit_no_update_delete on public.tryon_audit_events;
create trigger tryon_audit_no_update_delete
before update or delete on public.tryon_audit_events
for each row execute function public.tryon_audit_append_only();

create or replace function public.record_tryon_job_status()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v_event text;
begin
 if tg_op='INSERT' then
  insert into public.tryon_audit_events(job_id,user_id,event_type,from_status,to_status,credit_effect)
  values(new.id,new.user_id,'created',null,new.status,'reserved');
 elsif old.status is distinct from new.status then
  insert into public.tryon_audit_events(job_id,user_id,event_type,from_status,to_status,credit_effect)
  values(new.id,new.user_id,new.status,old.status,new.status,
    case when new.status='failed' then 'released' else 'retained' end);
 end if;
 return new;
end $fn$;
revoke all on function public.record_tryon_job_status() from public,anon,authenticated;
drop trigger if exists tryon_jobs_audit_status on public.tryon_jobs;
create trigger tryon_jobs_audit_status after insert or update of status on public.tryon_jobs
for each row execute function public.record_tryon_job_status();

insert into public.tryon_audit_events(job_id,user_id,event_type,from_status,to_status,credit_effect,source)
select j.id,j.user_id,'prior_state_snapshot',null,j.status,
 case when j.status='failed' then 'released' else 'retained' end,'backfill_current_state'
from public.tryon_jobs j
where not exists(select 1 from public.tryon_audit_events a where a.job_id=j.id);

create table if not exists public.tryon_support_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true,
 granted_at timestamptz not null default now()
);
alter table public.tryon_support_admins enable row level security;
revoke all on public.tryon_support_admins from public,anon,authenticated;

-- Do not add administrators automatically.
-- Only a privileged operator should enroll a verified support administrator.
-- Example after checking authorized user ID in Supabase Auth dashboard:
-- insert into public.tryon_support_admins(user_id) values ('VERIFIED-USER-UUID');
