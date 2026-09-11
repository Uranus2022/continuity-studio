create table public.shot_frames (
  id uuid primary key default gen_random_uuid(),
  shot_id uuid not null references public.shots(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  label text,
  is_approved boolean not null default false,
  is_canon boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_shot_frames_shot_id on public.shot_frames(shot_id);
create index idx_shot_frames_created_by on public.shot_frames(created_by);
create unique index one_approved_frame_per_shot on public.shot_frames(shot_id) where is_approved;
create unique index one_canon_frame_per_shot on public.shot_frames(shot_id) where is_canon;

alter table public.shot_frames enable row level security;

grant select, insert, update, delete on public.shot_frames to authenticated;

create policy "users read own shot frames"
on public.shot_frames for select to authenticated
using (
  exists (
    select 1
    from public.shots s
    join public.projects p on p.id = s.project_id
    where s.id = shot_frames.shot_id
      and p.user_id = (select auth.uid())
  )
);

create policy "users insert own shot frames"
on public.shot_frames for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.shots s
    join public.projects p on p.id = s.project_id
    where s.id = shot_frames.shot_id
      and p.user_id = (select auth.uid())
  )
);

create policy "users update own shot frames"
on public.shot_frames for update to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.shots s
    join public.projects p on p.id = s.project_id
    where s.id = shot_frames.shot_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.shots s
    join public.projects p on p.id = s.project_id
    where s.id = shot_frames.shot_id
      and p.user_id = (select auth.uid())
  )
);

create policy "users delete own shot frames"
on public.shot_frames for delete to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.shots s
    join public.projects p on p.id = s.project_id
    where s.id = shot_frames.shot_id
      and p.user_id = (select auth.uid())
  )
);

create trigger set_shot_frames_updated_at
before update on public.shot_frames
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shot-frames',
  'shot-frames',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "shot frames read own files"
on storage.objects for select to authenticated
using (
  bucket_id = 'shot-frames'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "shot frames upload own files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'shot-frames'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "shot frames update own files"
on storage.objects for update to authenticated
using (
  bucket_id = 'shot-frames'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'shot-frames'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "shot frames delete own files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'shot-frames'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
