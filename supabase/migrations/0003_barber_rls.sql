-- authenticated (barber) has full access — anon policies from Slice 1 are untouched
create policy "barber full access customers" on customers
  for all to authenticated using (true) with check (true);

create policy "barber full access locations" on locations
  for all to authenticated using (true) with check (true);

create policy "barber full access bookings" on bookings
  for all to authenticated using (true) with check (true);

create policy "barber full access settings" on barber_settings
  for all to authenticated using (true) with check (true);
