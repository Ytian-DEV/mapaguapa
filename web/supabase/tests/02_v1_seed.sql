-- Fixture rows with fixed ids so tests can refer to them. Test fixture only.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{"full_name":"Test Admin"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'student1@test.local', '{"full_name":"Student One"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'student2@test.local', '{"full_name":"Student Two"}')
on conflict do nothing;

insert into public.profiles (id, email, full_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', 'Test Admin', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', 'student1@test.local', 'Student One', 'user'),
  ('00000000-0000-0000-0000-0000000000b2', 'student2@test.local', 'Student Two', 'user')
on conflict do nothing;

insert into public.listings (id, name, address, accommodation_type, exclusivity, monthly_rental_label, monthly_rent_min, monthly_rent_max, status) values
  ('10000000-0000-0000-0000-000000000001', 'Fixture Range BH', 'Guadalupe, Baybay City', 'Boarding house', 'Mixed', '₱1,000-1,999', 1000, 1999, 'active'),
  ('10000000-0000-0000-0000-000000000002', 'Fixture Cheap BH', 'Pangasugan, Baybay City', 'Boarding house', 'Ladies only', 'Less than ₱1,000', null, 999, 'active'),
  ('10000000-0000-0000-0000-000000000003', 'Fixture Premium BH', 'Marcos, Baybay City', 'Dormitory', 'Men only', '₱3,000 or more', 3000, null, 'active'),
  ('10000000-0000-0000-0000-000000000004', 'Fixture Label Only', 'Guadalupe, Baybay City', 'Boarding house', 'Mixed', '2,000-2,999', null, null, 'active'),
  ('10000000-0000-0000-0000-000000000005', 'Fixture Archived', 'Guadalupe, Baybay City', 'Boarding house', 'Mixed', '₱1,000-1,999', 1000, 1999, 'deleted')
on conflict do nothing;
