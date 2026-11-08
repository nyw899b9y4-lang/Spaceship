-- Spaceship backend: run once in Supabase → SQL Editor → New query → Run.
-- Visitors (anonymous) may only ADD rows and upload photos.
-- Nobody can read the data through the public key; you see it in the Supabase dashboard.

create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  location    jsonb,
  motion      jsonb,
  photo_path  text,
  note        text check (char_length(note) <= 500)
);

alter table public.submissions enable row level security;

-- Tables are not exposed automatically: allow visitors to INSERT only (no select/update/delete)
revoke all on public.submissions from anon, authenticated;
grant usage on schema public to anon;
grant insert on public.submissions to anon;

drop policy if exists "visitors can submit" on public.submissions;
create policy "visitors can submit"
  on public.submissions for insert
  to anon
  with check (true);

-- Private bucket for photos (max 10 MB, images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

drop policy if exists "visitors can upload photos" on storage.objects;
create policy "visitors can upload photos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'photos');
