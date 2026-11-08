-- Spaceship v3: open a saved spaceship by its link (…/Spaceship/?ship=<id>).
-- Run once in Supabase → SQL Editor → New query → Run.
--
-- * get_spaceship(id) returns exactly ONE apartment, and only if you know its random id.
--   The table itself stays unreadable for visitors (no listing, no search).
-- * The photos bucket becomes "public": a photo can be opened with its exact URL
--   (which contains the random id), but nobody can list or browse the bucket.

create or replace function public.get_spaceship(ship_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(a) - 'client'          -- don't hand out browser/device details
  from public.apartments a
  where a.id = ship_id;
$$;

revoke all on function public.get_spaceship(uuid) from public;
grant execute on function public.get_spaceship(uuid) to anon;

update storage.buckets set public = true where id = 'photos';
