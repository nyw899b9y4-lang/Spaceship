# Spaceship

Share data from any device – phone, tablet or computer – through the browser. No app install.

## Open

**[🚀 nyw899b9y4-lang.github.io/Spaceship](https://nyw899b9y4-lang.github.io/Spaceship/)**

Visitors can send their **location**, **motion sensor readings** and a **photo** (its GPS position is read from the photo metadata when present). Each is optional, asked for with the device's own permission prompt, and sent only after they agree.

## Environment

- `web/` – the homepage (plain HTML/JS), published to GitHub Pages on every push
- `web/config.js` – backend connection (Supabase URL + publishable key)
- `backend/supabase-setup.sql` – creates the `submissions` table and private `photos` bucket; visitors can only add data, never read it
- Submissions are viewed in the Supabase dashboard (Table Editor → `submissions`, Storage → `photos`)
