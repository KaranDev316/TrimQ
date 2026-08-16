alter table customers enable row level security;
alter table locations enable row level security;
alter table bookings enable row level security;
alter table barber_settings enable row level security;

grant usage on schema public to anon;

grant insert (name, phone) on customers to anon;
grant select (id, phone) on customers to anon;

grant select on locations to anon;
grant select on barber_settings to anon;

grant insert (booking_number, customer_id, location_id, status) on bookings to anon;
grant select on bookings to anon;
grant update (status) on bookings to anon;

create policy "anon can insert customers"
on customers
for insert
to anon
with check (true);

create policy "anon can select matching customer by phone"
on customers
for select
to anon
using (
  phone = ((current_setting('request.headers', true)::json) ->> 'x-customer-phone')
);

create policy "anon can select active locations"
on locations
for select
to anon
using (active = true);

create policy "anon can select barber settings"
on barber_settings
for select
to anon
using (true);

create policy "anon can insert waiting bookings"
on bookings
for insert
to anon
with check (status = 'waiting');

create policy "anon can select own booking"
on bookings
for select
to anon
using (
  booking_number = ((current_setting('request.headers', true)::json) ->> 'x-booking-number')
  and exists (
    select 1
    from customers
    where customers.id = bookings.customer_id
      and customers.phone = ((current_setting('request.headers', true)::json) ->> 'x-customer-phone')
  )
);

create policy "anon can cancel own waiting booking"
on bookings
for update
to anon
using (
  status = 'waiting'
  and booking_number = ((current_setting('request.headers', true)::json) ->> 'x-booking-number')
  and exists (
    select 1
    from customers
    where customers.id = bookings.customer_id
      and customers.phone = ((current_setting('request.headers', true)::json) ->> 'x-customer-phone')
  )
)
with check (
  status = 'cancelled'
  and booking_number = ((current_setting('request.headers', true)::json) ->> 'x-booking-number')
  and exists (
    select 1
    from customers
    where customers.id = bookings.customer_id
      and customers.phone = ((current_setting('request.headers', true)::json) ->> 'x-customer-phone')
  )
);
