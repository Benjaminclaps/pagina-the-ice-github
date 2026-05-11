alter table if exists orders
  alter column customer_id drop not null;

alter table if exists orders
  add column if not exists customer_name text;

alter table if exists orders
  add column if not exists source text not null default 'hubspot';

alter table if exists orders
  add column if not exists hub_ok boolean not null default false;

update orders
set
  customer_name = coalesce(customer_name, 'Sin cliente'),
  source = coalesce(source, 'hubspot'),
  hub_ok = coalesce(hub_ok, false)
where customer_name is null
   or source is null
   or hub_ok is null;

alter table if exists orders
  alter column customer_name set not null;
