// Backend connection (Supabase). Leave empty to run the page in preview mode:
// everything works on the device, but nothing is sent.
// The key is the project's *publishable / anon* key – it is meant to be public.
// Visitors can only ADD submissions; they cannot read anyone's data.
window.SPACESHIP_CONFIG = {
  SUPABASE_URL: "https://yzrgdobxilmrxruzwwvi.supabase.co",
  SUPABASE_KEY: "sb_publishable_EJrjYgyAjcDz683W6v3SwQ_mRve5pL5",
  TABLE: "submissions",
  APARTMENTS_TABLE: "apartments",
  PHOTO_BUCKET: "photos",
};
