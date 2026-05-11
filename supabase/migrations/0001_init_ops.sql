create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  display_name text not null,
  razon_social text,
  hubspot_contact_id text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists customers add column if not exists phone text;
alter table if exists customers add column if not exists display_name text;
alter table if exists customers add column if not exists razon_social text;
alter table if exists customers add column if not exists hubspot_contact_id text;
alter table if exists customers add column if not exists status text default 'active';
alter table if exists customers add column if not exists created_at timestamptz default now();
alter table if exists customers add column if not exists updated_at timestamptz default now();

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  hubspot_thread_id text not null,
  hubspot_message_id text not null,
  direction text not null default 'inbound',
  raw_text text not null,
  grouped_text text,
  group_key text,
  status text not null default 'pending',
  received_at timestamptz not null,
  buffered_until timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table if exists messages add column if not exists customer_id uuid references customers(id) on delete set null;
alter table if exists messages add column if not exists hubspot_thread_id text;
alter table if exists messages add column if not exists hubspot_message_id text;
alter table if exists messages add column if not exists direction text default 'inbound';
alter table if exists messages add column if not exists raw_text text;
alter table if exists messages add column if not exists grouped_text text;
alter table if exists messages add column if not exists group_key text;
alter table if exists messages add column if not exists status text default 'pending';
alter table if exists messages add column if not exists received_at timestamptz;
alter table if exists messages add column if not exists buffered_until timestamptz;
alter table if exists messages add column if not exists processed_at timestamptz;
alter table if exists messages add column if not exists created_at timestamptz default now();

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete restrict,
  source_group_key text,
  source_thread_id text not null,
  original_message text not null,
  delivery_date date not null,
  status text not null default 'pendiente_aprobacion',
  approved_by text,
  sheet_row_number integer,
  sheet_status text default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists orders add column if not exists customer_id uuid references customers(id) on delete restrict;
alter table if exists orders add column if not exists source_group_key text;
alter table if exists orders add column if not exists source_thread_id text;
alter table if exists orders add column if not exists original_message text;
alter table if exists orders add column if not exists delivery_date date;
alter table if exists orders add column if not exists status text default 'pendiente_aprobacion';
alter table if exists orders add column if not exists approved_by text;
alter table if exists orders add column if not exists sheet_row_number integer;
alter table if exists orders add column if not exists sheet_status text default 'pending';
alter table if exists orders add column if not exists notes text;
alter table if exists orders add column if not exists created_at timestamptz default now();
alter table if exists orders add column if not exists updated_at timestamptz default now();

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  internal_code text not null,
  display_name text not null,
  portal_label text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table if exists products add column if not exists internal_code text;
alter table if exists products add column if not exists display_name text;
alter table if exists products add column if not exists portal_label text;
alter table if exists products add column if not exists active boolean default true;
alter table if exists products add column if not exists created_at timestamptz default now();

create unique index if not exists idx_customers_phone_unique on customers(phone);
create unique index if not exists idx_messages_hubspot_message_id_unique on messages(hubspot_message_id);
create unique index if not exists idx_products_internal_code_unique on products(internal_code);

create index if not exists idx_messages_thread on messages(hubspot_thread_id);
create index if not exists idx_messages_group_key on messages(group_key);
create index if not exists idx_messages_status on messages(status);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_delivery_date on orders(delivery_date);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_status_check'
  ) then
    alter table customers
      add constraint customers_status_check
      check (status in ('new', 'active', 'inactive'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_direction_check'
  ) then
    alter table messages
      add constraint messages_direction_check
      check (direction in ('inbound', 'outbound', 'internal'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_status_check'
  ) then
    alter table messages
      add constraint messages_status_check
      check (status in ('pending', 'buffered', 'grouped', 'ignored', 'error'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_status_check'
  ) then
    alter table orders
      add constraint orders_status_check
      check (status in (
        'pendiente_aprobacion',
        'aprobado',
        'pendiente_portal',
        'ingresado_portal',
        'error_portal'
      ));
  end if;
end $$;

drop trigger if exists trg_customers_updated_at on customers;
create trigger trg_customers_updated_at
before update on customers
for each row execute function set_updated_at();

drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at
before update on orders
for each row execute function set_updated_at();
