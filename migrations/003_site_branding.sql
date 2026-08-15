CREATE TABLE site_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  favicon_key TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)