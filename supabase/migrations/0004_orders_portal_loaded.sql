alter table if exists orders
  add column if not exists portal_loaded boolean not null default false;

update orders
set portal_loaded = coalesce(portal_loaded, hub_ok, false)
where portal_loaded is null;

update orders
set hub_ok = coalesce(hub_ok, portal_loaded, false)
where hub_ok is null;
