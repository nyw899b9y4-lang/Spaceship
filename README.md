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
- `backend/supabase-apartments.sql` – `apartments` table; photos in the `photos` bucket under `<apartment id>/window-<n>.jpg`
- `backend/supabase-viewer.sql` – `get_spaceship(id)`: opens one saved ship by its link `…/Spaceship/?ship=<id>` (table and bucket stay unlistable)
- Imagery © swisstopo (CH) / © Esri (elsewhere, non-commercial) · Buildings & search © OpenStreetMap contributors

## Real sky

In the cockpit (★ SPACE) the open sky in each window photo is replaced by the real sky in that direction: ~5000 stars to magnitude 6 with constellations (d3-celestial data, BSD-3), Sun, Moon and planets (astronomy-engine, MIT), for the building's position and the chosen time (slider ±12 h). View direction = phone compass at the shot (fallback: wall direction), tilt = phone tilt, field of view ≈ phone main camera (53° × 67° portrait).

The cockpit is a full-screen star dome (`web/skydome.js`): stereographic (fisheye but conformal, so star patterns keep their true shape) up to 200° wide. The window frame is removed from the photo – only the skyline silhouette stays, placed at its true direction and height. Layers (toggle in the top-left panel): Milky Way, constellation lines, ecliptic, deep-sky objects (110 Messier galaxies, nebulae, clusters), alt/az and RA/Dec grids, names. Drag to look around, scroll/pinch to zoom, double-click to return to the window; the photo thumbnail switches to the original photo projected into the sky.

## Ship composition (200 m scan)

`web/scanfx.js` plays the spectral 200 m scan (MRI-style base, biodiversity spectrum, contour lines, structure edges) on the main stage; `web/sound.js` is the optional generative Soundsphere.

`web/compose.js` turns the surroundings into ship parameters (spec v1, downloadable as JSON in the page):
- Satellite classification within 200 m (greenery, water, roofs, streets & paved, shade) + OpenStreetMap counts (buildings & floors, roads, tram/rail, water, parks, trees, shops, facilities) + the building's own geometry and windows.
- `stats` (0–99): speed, acceleration, turn, tilt, hull, shield, sensors, energy, stealth, lifeSupport, trade.
- `physics`: engines, mass_t, max_speed, acceleration, turn_rate_deg_s, pitch_rate_deg_s, roll_rate_deg_s, max_tilt_deg, shield_regen_per_s, sensor_range.
- `capabilities`: bio_dome, hydro, maglev, solar, cloak, panorama, high_orbit, trade_port, academy, sanctuary, arterial – also shown as modules on the pixel ship.
