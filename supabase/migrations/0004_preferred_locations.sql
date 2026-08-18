insert into locations (name, active)
select 'G9 Hostel', true
where not exists (
  select 1 from locations where name = 'G9 Hostel'
);

insert into locations (name, active)
select 'New NRI Hostel', true
where not exists (
  select 1 from locations where name = 'New NRI Hostel'
);

insert into locations (name, active)
select 'Customer Location', true
where not exists (
  select 1 from locations where name = 'Customer Location'
);

with canonical as (
  select id from locations where name = 'G9 Hostel' order by created_at limit 1
),
legacy as (
  select id from locations where name = 'Barber''s Hostel'
)
update bookings
set location_id = canonical.id
from canonical
where bookings.location_id in (select id from legacy);

with canonical as (
  select id from locations where name = 'New NRI Hostel' order by created_at limit 1
),
legacy as (
  select id from locations where name = 'NRI Hostel'
)
update bookings
set location_id = canonical.id
from canonical
where bookings.location_id in (select id from legacy);

update locations
set active = false
where name in ('Barber''s Hostel', 'NRI Hostel');

update locations
set active = true
where name in ('G9 Hostel', 'New NRI Hostel', 'Customer Location');
