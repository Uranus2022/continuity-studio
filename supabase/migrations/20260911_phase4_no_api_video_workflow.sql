create table if not exists public.shot_video_takes (
  id uuid primary key default gen_random_uuid(),
  shot_id uuid not null references public.shots(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('video/mp4','video/quicktime','video/webm')),
  file_size bigint not null check (file_size > 0 and file_size <= 52428800),
  duration_seconds numeric,
  source_frame_id uuid references public.shot_frames(id) on delete set null,
  previous_video_take_id uuid references public.shot_video_takes(id) on delete set null,
  prompt_package text,
  director_adjustment text,
  target_duration_seconds integer,
  motion_intensity text,
  camera_motion text,
  is_approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  is_canon boolean not null default false,
  canon_at timestamptz,
  canon_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shot_video_takes_shot_id on public.shot_video_takes(shot_id);
create index if not exists idx_shot_video_takes_created_by on public.shot_video_takes(created_by);
create index if not exists idx_shot_video_takes_source_frame_id on public.shot_video_takes(source_frame_id);
create index if not exists idx_shot_video_takes_previous_video_take_id on public.shot_video_takes(previous_video_take_id);
create index if not exists idx_shot_video_takes_approved_by on public.shot_video_takes(approved_by);
create index if not exists idx_shot_video_takes_canon_by on public.shot_video_takes(canon_by);
create unique index if not exists one_approved_video_take_per_shot on public.shot_video_takes(shot_id) where is_approved;
create unique index if not exists one_canon_video_take_per_shot on public.shot_video_takes(shot_id) where is_canon;

alter table public.shot_video_takes enable row level security;
grant select, insert, update, delete on public.shot_video_takes to authenticated;

create policy "users read own shot video takes"
on public.shot_video_takes for select to authenticated
using (
  exists (
    select 1
    from public.shots s
    join public.projects p on p.id = s.project_id
    where s.id = shot_video_takes.shot_id
      and p.user_id = (select auth.uid())
  )
);

create policy "users insert own shot video takes"
on public.shot_video_takes for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.shots s
    join public.projects p on p.id = s.project_id
    where s.id = shot_video_takes.shot_id
      and p.user_id = (select auth.uid())
  )
);

create policy "users update own shot video takes"
on public.shot_video_takes for update to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.shots s
    join public.projects p on p.id = s.project_id
    where s.id = shot_video_takes.shot_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.shots s
    join public.projects p on p.id = s.project_id
    where s.id = shot_video_takes.shot_id
      and p.user_id = (select auth.uid())
  )
);

create policy "users delete own shot video takes"
on public.shot_video_takes for delete to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.shots s
    join public.projects p on p.id = s.project_id
    where s.id = shot_video_takes.shot_id
      and p.user_id = (select auth.uid())
  )
);

create trigger set_shot_video_takes_updated_at
before update on public.shot_video_takes
for each row execute function public.set_updated_at();

create or replace function public.set_shot_video_take_approved(p_take_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_shot_id uuid;
begin
  select shot_id into v_shot_id from public.shot_video_takes where id = p_take_id;
  if v_shot_id is null then raise exception 'Video take not found'; end if;

  update public.shot_video_takes
  set is_approved = false, approved_at = null, approved_by = null
  where shot_id = v_shot_id and is_approved = true;

  update public.shot_video_takes
  set is_approved = true, approved_at = now(), approved_by = auth.uid()
  where id = p_take_id;
end;
$$;

create or replace function public.set_shot_video_take_canon(p_take_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_shot_id uuid;
begin
  select shot_id into v_shot_id from public.shot_video_takes where id = p_take_id;
  if v_shot_id is null then raise exception 'Video take not found'; end if;

  update public.shot_video_takes
  set is_canon = false, canon_at = null, canon_by = null
  where shot_id = v_shot_id and is_canon = true;

  update public.shot_video_takes
  set is_approved = false, approved_at = null, approved_by = null
  where shot_id = v_shot_id and id <> p_take_id and is_approved = true;

  update public.shot_video_takes
  set is_canon = true,
      canon_at = now(),
      canon_by = auth.uid(),
      is_approved = true,
      approved_at = coalesce(approved_at, now()),
      approved_by = coalesce(approved_by, auth.uid())
  where id = p_take_id;
end;
$$;

grant execute on function public.set_shot_video_take_approved(uuid) to authenticated;
grant execute on function public.set_shot_video_take_canon(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shot-videos',
  'shot-videos',
  false,
  52428800,
  array['video/mp4','video/quicktime','video/webm']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "shot videos read own files"
on storage.objects for select to authenticated
using (
  bucket_id = 'shot-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "shot videos upload own files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'shot-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "shot videos update own files"
on storage.objects for update to authenticated
using (
  bucket_id = 'shot-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'shot-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "shot videos delete own files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'shot-videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
