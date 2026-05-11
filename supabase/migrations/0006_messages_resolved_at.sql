alter table if exists messages
  add column if not exists resolved_at timestamptz;
