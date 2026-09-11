-- Continuity Studio MVP schema
-- Mirrors the live Supabase project as of 2026-09-11.

create extension if not exists pgcrypto;

create type asset_kind as enum ('character', 'location', 'prop', 'wardrobe');
create type asset_lock_state as enum ('draft', 'canon');
create type shot_status as enum ('planned', 'draft', 'canon');
create type rule_scope as enum ('project', 'shot_range', 'shot');

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  aspect_ratio text not null default '9:16',
  visual_style text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, title)
);

create table assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  kind asset_kind not null,
  name text not null,
  description text,
  reference_image_url text,
  lock_state asset_lock_state not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, kind, name)
);

create table shots (
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

create table shot_assets (
  shot_id uuid not null references shots(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  role text,
  primary key (shot_id, asset_id)
);

create table continuity_rules (
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

create table generations (
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

create index idx_projects_user_id on projects(user_id);
create index idx_assets_project_id on assets(project_id);
create index idx_shots_project_id on shots(project_id);
create index idx_shot_assets_asset_id on shot_assets(asset_id);
create index idx_continuity_rules_project_id on continuity_rules(project_id);
create index idx_continuity_rules_target_shot_id on continuity_rules(target_shot_id);
create index idx_generations_shot_id on generations(shot_id);

alter table projects enable row level security;
alter table assets enable row level security;
alter table shots enable row level security;
alter table shot_assets enable row level security;
alter table continuity_rules enable row level security;
alter table generations enable row level security;

create policy "users own projects" on projects for all
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users access project assets" on assets for all
using (exists (select 1 from projects p where p.id = assets.project_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from projects p where p.id = assets.project_id and p.user_id = (select auth.uid())));

create policy "users access project shots" on shots for all
using (exists (select 1 from projects p where p.id = shots.project_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from projects p where p.id = shots.project_id and p.user_id = (select auth.uid())));

create policy "users access shot assets" on shot_assets for all
using (exists (
  select 1 from shots s join projects p on p.id = s.project_id
  where s.id = shot_assets.shot_id and p.user_id = (select auth.uid())
))
with check (exists (
  select 1 from shots s join projects p on p.id = s.project_id
  where s.id = shot_assets.shot_id and p.user_id = (select auth.uid())
));

create policy "users access continuity rules" on continuity_rules for all
using (exists (select 1 from projects p where p.id = continuity_rules.project_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from projects p where p.id = continuity_rules.project_id and p.user_id = (select auth.uid())));

create policy "users access generations" on generations for all
using (exists (
  select 1 from shots s join projects p on p.id = s.project_id
  where s.id = generations.shot_id and p.user_id = (select auth.uid())
))
with check (exists (
  select 1 from shots s join projects p on p.id = s.project_id
  where s.id = generations.shot_id and p.user_id = (select auth.uid())
));

create or replace function set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_projects_updated_at before update on projects
for each row execute function set_updated_at();
create trigger set_assets_updated_at before update on assets
for each row execute function set_updated_at();
create trigger set_shots_updated_at before update on shots
for each row execute function set_updated_at();

create or replace function bootstrap_demo_project()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_project uuid;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  insert into projects (user_id, title, aspect_ratio, visual_style)
  values (v_user, 'The Message From Tomorrow', '9:16', 'Cinematic photorealism')
  on conflict (user_id, title) do update
    set aspect_ratio = excluded.aspect_ratio,
        visual_style = excluded.visual_style
  returning id into v_project;

  insert into assets (project_id, kind, name, description, lock_state, metadata)
  values
    (v_project, 'character', 'Woman A', '~30, shoulder-length dark hair, light collared button-up shirt, dark pants', 'canon', '{"role":"Lead"}'::jsonb),
    (v_project, 'wardrobe', 'Outfit A', 'Light collared button-up shirt with dark pants; keep unchanged across shots', 'canon', '{}'::jsonb),
    (v_project, 'location', 'Apartment A', 'Small modern apartment, sofa by window, round wooden table, lamp on frame-right', 'canon', '{}'::jsonb),
    (v_project, 'prop', 'Phone A', 'Black smartphone used throughout the film', 'canon', '{}'::jsonb),
    (v_project, 'prop', 'Photo Frame A', 'Standing wooden frame; daughter on left, older mother on right; fixed crack pattern', 'canon', '{}'::jsonb),
    (v_project, 'prop', 'Keys A', 'Apartment keys', 'draft', '{}'::jsonb),
    (v_project, 'prop', 'Hospital Wristband', 'Simple paper hospital visitor wristband, left wrist only in morning shots', 'draft', '{}'::jsonb)
  on conflict (project_id, kind, name) do update
    set description = excluded.description,
        metadata = excluded.metadata;

  insert into shots (project_id, shot_number, title, camera, action, time_of_day, status)
  values
    (v_project, 1, 'Voice message', 'Extreme close-up', 'Phone shows a new voice message', 'Night', 'canon'),
    (v_project, 2, 'Reaction', 'Close-up', 'She listens, worried and disbelieving', 'Night', 'canon'),
    (v_project, 3, 'Apartment master', 'Medium', 'Seated on sofa, looking at phone', 'Night', 'canon'),
    (v_project, 4, 'Photo frame', 'Close-up', 'Cracked photo of daughter and mother', 'Night', 'canon'),
    (v_project, 5, 'Incoming call', 'Extreme close-up', 'Incoming call interface', 'Night', 'draft'),
    (v_project, 6, 'Hesitation', 'Close-up', 'Finger pauses over decline', 'Night', 'draft'),
    (v_project, 7, 'Answers', 'Close-up', 'Phone at ear, listening silently', 'Night', 'draft'),
    (v_project, 8, 'Decision', 'Medium', 'Rises and reaches for keys', 'Night', 'draft'),
    (v_project, 9, 'Leaving', 'Medium', 'At open door with phone and keys', 'Night', 'planned'),
    (v_project, 10, 'Morning', 'Wide', 'Back on sofa, exhausted', 'Morning', 'planned'),
    (v_project, 11, 'Relief', 'Close-up', 'Listens to a new message', 'Morning', 'planned'),
    (v_project, 12, 'Photo settles', 'Close-up', 'Straightens the photo frame', 'Morning', 'planned')
  on conflict (project_id, shot_number) do update
    set title = excluded.title,
        camera = excluded.camera,
        action = excluded.action,
        time_of_day = excluded.time_of_day;

  insert into shot_assets (shot_id, asset_id, role)
  select s.id, a.id, m.role
  from (values
    (1, 'Phone A', 'visible'),
    (2, 'Woman A', 'character'), (2, 'Outfit A', 'wardrobe'),
    (3, 'Woman A', 'character'), (3, 'Outfit A', 'wardrobe'), (3, 'Apartment A', 'location'), (3, 'Phone A', 'visible'), (3, 'Photo Frame A', 'visible'),
    (4, 'Photo Frame A', 'hero prop'),
    (5, 'Phone A', 'hero prop'),
    (6, 'Phone A', 'hero prop'),
    (7, 'Woman A', 'character'), (7, 'Outfit A', 'wardrobe'), (7, 'Phone A', 'visible'),
    (8, 'Woman A', 'character'), (8, 'Outfit A', 'wardrobe'), (8, 'Apartment A', 'location'), (8, 'Keys A', 'visible'), (8, 'Phone A', 'visible'),
    (9, 'Woman A', 'character'), (9, 'Outfit A', 'wardrobe'), (9, 'Phone A', 'visible'), (9, 'Keys A', 'visible'),
    (10, 'Woman A', 'character'), (10, 'Outfit A', 'wardrobe'), (10, 'Apartment A', 'location'), (10, 'Hospital Wristband', 'visible'),
    (11, 'Woman A', 'character'), (11, 'Outfit A', 'wardrobe'), (11, 'Phone A', 'visible'), (11, 'Hospital Wristband', 'visible'),
    (12, 'Photo Frame A', 'hero prop'), (12, 'Hospital Wristband', 'visible')
  ) as m(shot_number, asset_name, role)
  join shots s on s.project_id = v_project and s.shot_number = m.shot_number
  join assets a on a.project_id = v_project and a.name = m.asset_name
  on conflict (shot_id, asset_id) do update set role = excluded.role;

  insert into continuity_rules (project_id, description, scope, start_shot, end_shot, severity, machine_rule)
  select v_project, r.description, r.scope::rule_scope, r.start_shot, r.end_shot, 'hard', r.machine_rule
  from (values
    ('Woman A keeps the same face, hair, shirt and pants across all shots.', 'project', null::integer, null::integer, '{"key":"woman_identity"}'::jsonb),
    ('Mother appears only inside Photo Frame A.', 'project', null::integer, null::integer, '{"key":"mother_photo_only"}'::jsonb),
    ('Photo Frame A crack pattern never changes.', 'project', null::integer, null::integer, '{"key":"photo_crack"}'::jsonb),
    ('Hospital wristband appears only in shots 10–12, on the left wrist.', 'shot_range', 10, 12, '{"key":"wristband_range"}'::jsonb),
    ('Shots 1–9 are night; shots 10–12 are morning.', 'project', null::integer, null::integer, '{"key":"time_split"}'::jsonb)
  ) as r(description, scope, start_shot, end_shot, machine_rule)
  where not exists (
    select 1 from continuity_rules existing
    where existing.project_id = v_project
      and existing.machine_rule->>'key' = r.machine_rule->>'key'
  );

  return v_project;
end;
$$;

revoke all on function bootstrap_demo_project() from public;
grant execute on function bootstrap_demo_project() to authenticated;
