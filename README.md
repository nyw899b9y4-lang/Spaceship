# Spaceship

Turn an apartment into a spaceship: its real outline, its windows, and the view from each window into the sky.

## Open

**[🚀 nyw899b9y4-lang.github.io/Spaceship](https://nyw899b9y4-lang.github.io/Spaceship/)**

1. **Address** – search (swisstopo for Switzerland, OpenStreetMap elsewhere)
2. **Building & windows** – satellite image with the building outline; tap each window on the outline → its outward view direction (azimuth) comes from the wall
3. **Views** – one photo per window (frame + sky) taken in the page, with the phone's compass heading and tilt at the moment of the shot
4. **Plan & send** – outline, windows and view rays; stored in Supabase

## Environment

- `web/` – the homepage (plain HTML/JS, Leaflet), published to GitHub Pages on every push
- `web/config.js` – Supabase URL + publishable key (insert-only)
- `backend/supabase-apartments.sql` – `apartments` table; photos in the private `photos` bucket under `<apartment id>/window-<n>.jpg`
- Imagery © swisstopo (CH) / © Esri (elsewhere, non-commercial) · Buildings & search © OpenStreetMap contributors
