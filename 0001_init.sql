create table customers (
  id UUID primary key default gen_random_uuid(),
  name TEXT not null,
  phone TEXT not null unique,
  created_at TIMESTAMPTZ not null default now()
);

create table locations (
  id UUID primary key default gen_random_uuid(),
  name TEXT not null,
  description TEXT,
  active BOOLEAN not null default true,
  created_at TIMESTAMPTZ not null default now()
);

create type booking_status as enum ('waiting', 'cutting', 'completed', 'cancelled');

create or replace function trigger_set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table bookings (
  id UUID primary key default gen_random_uuid(),
  booking_number TEXT not null unique,
  customer_id UUID not null references customers(id),
  location_id UUID not null references locations(id),
  status booking_status not null,
  joined_at TIMESTAMPTZ not null default now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  price NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ not null default now(),
  updated_at TIMESTAMPTZ not null default now()
);

create trigger set_bookings_timestamp
before update on bookings
for each row
execute procedure trigger_set_timestamp();

create table barber_settings (
  id UUID primary key default gen_random_uuid(),
  accepting_customers BOOLEAN not null default true,
  updated_at TIMESTAMPTZ not null default now()
);

-- seed data
insert into locations (name) values
  ('Barber''s Hostel'), ('NRI Hostel'), ('Customer Location');

insert into barber_settings (accepting_customers) values (true);