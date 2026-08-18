create table customers (
  id UUID primary key default gen_random_uuid(),
  name TEXT not null,
  phone TEXT not null,
  created_at TIMESTAMPTZ not null default now()
);

create table locations (
  id UUID primary key default gen_random_uuid(),
  name TEXT not null,
  description TEXT,
  active BOOLEAN not null default true,
  created_at TIMESTAMPTZ not null default now()
);

create table bookings (
  id UUID primary key default gen_random_uuid(),
  booking_number TEXT not null unique,
  customer_id UUID not null references customers(id),
  location_id UUID not null references locations(id),
  status TEXT not null check (status in ('waiting','cutting','completed','cancelled')),
  joined_at TIMESTAMPTZ not null default now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  price NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ not null default now(),
  updated_at TIMESTAMPTZ not null default now()
);

create table barber_settings (
  id UUID primary key default gen_random_uuid(),
  accepting_customers BOOLEAN not null default true,
  updated_at TIMESTAMPTZ not null default now()
);

insert into locations (name) values
  ('G9 Hostel'), ('New NRI Hostel'), ('Customer Location');

insert into barber_settings (accepting_customers) values (true);
