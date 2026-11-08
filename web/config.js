// Backend connection (Supabase). Leave empty to run the page in preview mode:
// everything works on the device, but nothing is sent.
// The key is the project's *publishable / anon* key – it is meant to be public.
// Visitors can only ADD submissions; they cannot read anyone's data.
window.SPACESHIP_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_KEY: "",
  TABLE: "submissions",
  PHOTO_BUCKET: "photos",
};
