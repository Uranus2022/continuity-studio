alter table public.generations
  add column if not exists shot_frame_id uuid references public.shot_frames(id) on delete set null,
  add column if not exists error_message text,
  add column if not exists completed_at timestamptz,
  add column if not exists duration_ms integer,
  add column if not exists reference_count integer not null default 0;

create index if not exists idx_generations_shot_frame_id on public.generations(shot_frame_id);
create index if not exists idx_shot_frames_approved_by on public.shot_frames(approved_by);
create index if not exists idx_shot_frames_canon_by on public.shot_frames(canon_by);
