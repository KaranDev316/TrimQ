-- Apartment/address field for "Customer Location" bookings.
-- Only set when the selected location is "Customer Location".
alter table bookings add column address text;
