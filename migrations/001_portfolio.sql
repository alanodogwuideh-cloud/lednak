CREATE TABLE portfolio_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name TEXT NOT NULL DEFAULT 'Alan Odogwuideh',
  role TEXT NOT NULL DEFAULT 'UX Designer',
  intro TEXT NOT NULL DEFAULT 'I design digital products that make complex experiences feel simple, useful, and human.',
  about_text TEXT NOT NULL DEFAULT 'I’m Alan Odogwuideh, a multidisciplinary designer transitioning my visual design experience into product and UX design. I enjoy turning ambiguous problems into clear, thoughtful experiences.',
  location TEXT NOT NULL DEFAULT 'Abuja, Nigeria',
  linkedin_url TEXT NOT NULL DEFAULT 'https://www.linkedin.com/in/alanodogwuideh/',
  email TEXT NOT NULL DEFAULT '',
  about_image_url TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)