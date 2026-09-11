alter table public.shot_frames
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists canon_at timestamptz,
  add column if not exists canon_by uuid references auth.users(id) on delete set null;

create or replace function public.sync_shot_status_from_frames(p_shot_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_has_frame boolean;
  v_has_approved boolean;
  v_has_canon boolean;
begin
  select exists(select 1 from public.shot_frames where shot_id = p_shot_id),
         exists(select 1 from public.shot_frames where shot_id = p_shot_id and is_approved),
         exists(select 1 from public.shot_frames where shot_id = p_shot_id and is_canon)
    into v_has_frame, v_has_approved, v_has_canon;

  if v_has_canon then
    update public.shots set status = 'canon', updated_at = now() where id = p_shot_id;
  elsif v_has_approved then
    update public.shots set status = 'approved', updated_at = now() where id = p_shot_id;
  elsif v_has_frame then
    update public.shots set status = 'draft', updated_at = now() where id = p_shot_id;
  else
    update public.shots set status = 'planned', updated_at = now() where id = p_shot_id;
  end if;
end;
$$;

create or replace function public.set_shot_frame_approved(p_frame_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_shot_id uuid;
  v_existing_canon uuid;
begin
  select shot_id into v_shot_id
  from public.shot_frames
  where id = p_frame_id;

  if v_shot_id is null then
    raise exception 'Frame not found or not accessible';
  end if;

  select id into v_existing_canon
  from public.shot_frames
  where shot_id = v_shot_id and is_canon
  limit 1;

  if v_existing_canon is not null and v_existing_canon <> p_frame_id then
    raise exception 'This shot already has a canon frame. Use Make Canon on the new frame to replace it.';
  end if;

  update public.shot_frames
  set is_approved = false,
      approved_at = null,
      approved_by = null
  where shot_id = v_shot_id
    and id <> p_frame_id
    and is_approved;

  update public.shot_frames
  set is_approved = true,
      approved_at = coalesce(approved_at, now()),
      approved_by = coalesce(approved_by, (select auth.uid()))
  where id = p_frame_id;

  perform public.sync_shot_status_from_frames(v_shot_id);
end;
$$;

create or replace function public.set_shot_frame_canon(p_frame_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_shot_id uuid;
begin
  select shot_id into v_shot_id
  from public.shot_frames
  where id = p_frame_id;

  if v_shot_id is null then
    raise exception 'Frame not found or not accessible';
  end if;

  update public.shot_frames
  set is_canon = false,
      canon_at = null,
      canon_by = null,
      is_approved = false,
      approved_at = null,
      approved_by = null
  where shot_id = v_shot_id
    and id <> p_frame_id
    and (is_canon or is_approved);

  update public.shot_frames
  set is_canon = true,
      canon_at = now(),
      canon_by = (select auth.uid()),
      is_approved = true,
      approved_at = coalesce(approved_at, now()),
      approved_by = coalesce(approved_by, (select auth.uid()))
  where id = p_frame_id;

  perform public.sync_shot_status_from_frames(v_shot_id);
end;
$$;

create or replace function public.shot_frame_after_insert_sync()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.sync_shot_status_from_frames(new.shot_id);
  return new;
end;
$$;

create or replace function public.shot_frame_after_delete_sync()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.sync_shot_status_from_frames(old.shot_id);
  return old;
end;
$$;

drop trigger if exists shot_frame_after_insert_sync on public.shot_frames;
create trigger shot_frame_after_insert_sync
after insert on public.shot_frames
for each row execute function public.shot_frame_after_insert_sync();

drop trigger if exists shot_frame_after_delete_sync on public.shot_frames;
create trigger shot_frame_after_delete_sync
after delete on public.shot_frames
for each row execute function public.shot_frame_after_delete_sync();

revoke all on function public.sync_shot_status_from_frames(uuid) from public;
revoke all on function public.set_shot_frame_approved(uuid) from public;
revoke all on function public.set_shot_frame_canon(uuid) from public;
grant execute on function public.set_shot_frame_approved(uuid) to authenticated;
grant execute on function public.set_shot_frame_canon(uuid) to authenticated;

do $$
declare
  r record;
begin
  for r in select id from public.shots loop
    perform public.sync_shot_status_from_frames(r.id);
  end loop;
end $$;
