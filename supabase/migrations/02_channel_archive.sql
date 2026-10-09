-- Archive channels without deleting their publication or scheduling history.
alter table public.channels
  add column if not exists is_archived boolean not null default false;

create index if not exists channels_active_registry_idx
  on public.channels (created_at desc)
  where is_archived = false;
