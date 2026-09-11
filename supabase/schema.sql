-- Continuity Studio MVP schema
-- Run in a fresh Supabase Postgres project.

create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  aspect_ratio text not null default '9:16',
  visual_style text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type asset_kind as enum ('character', 'location', 'prop', 'wardrobe');
create type asset_lock_state as enum ('draft', 'canon');

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  kind asset_kind not null,
  name text not null,
  description text,
  reference_image_url text,
  lock_state asset_lock_state not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type shot_status as enum ('planned', 'draft', 'canon');

create table if not exists shots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  shot_number integer not null,
  title text not null,
  camera text,
  action text,
  time_of_day text,
  prompt text,
  status shot_status not null default 'planned',
  approved_frame_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, shot_number)
);

create table if not exists shot_assets (
  shot_id uuid not null references shots(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  role text,
  primary key (shot_id, asset_id)
);

create type rule_scope as enum ('project', 'shot_range', 'shot');

create table if not exists continuity_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  description text not null,
  scope rule_scope not null default 'project',
  start_shot integer,
  end_shot integer,
  target_shot_id uuid references shots(id) on delete cascade,
  severity text not null default 'hard',
  machine_rule jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  shot_id uuid not null references shots(id) on delete cascade,
  provider text not null,
  model text not null,
  media_type text not null check (media_type in ('image','video')),
  provider_job_id text,
  prompt text,
  input jsonb not null default '{}'::jsonb,
  output_url text,
  status text not null default 'queued',
  created_at timestamptz not null default now()
);

alter table projects enable row level security;
alter table assets enable row level security;
alter table shots enable row level security;
alter table shot_assets enable row level security;
alter table continuity_rules enable row level security;
alter table generations enable row level security;

create policy "users own projects"
on projects for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users access project assets"
on assets for all
using (exists (select 1 from projects p where p.id = assets.project_id and p.user_id = auth.uid()))
with check (exists (select 1 from projects p where p.id = assets.project_id and p.user_id = auth.uid()));

create policy "users access project shots"
on shots for all
using (exists (select 1 from projects p where p.id = shots.project_id and p.user_id = auth.uid()))
with check (exists (select 1 from projects p where p.id = shots.project_id and p.user_id = auth.uid()));

create policy "users access shot assets"
on shot_assets for all
using (exists (
  select 1 from shots s join projects p on p.id = s.project_id
  where s.id = shot_assets.shot_id and p.user_id = auth.uid()
))
with check (exists (
  select 1 from shots s join projects p on p.id = s.project_id
  where s.id = shot_assets.shot_id and p.user_id = auth.uid()
));

create policy "users access continuity rules"
on continuity_rules for all
using (exists (select 1 from projects p where p.id = continuity_rules.project_id and p.user_id = auth.uid()))
with check (exists (select 1 from projects p where p.id = continuity_rules.project_id and p.user_id = auth.uid()));

create policy "users access generations"
on generations for all
using (exists (
  select 1 from shots s join projects p on p.id = s.project_id
  where s.id = generations.shot_id and p.user_id = auth.uid()
))
with check (exists (
  select 1 from shots s join projects p on p.id = s.project_id
  where s.id = generations.shot_id and p.user_id = auth.uid()
));
