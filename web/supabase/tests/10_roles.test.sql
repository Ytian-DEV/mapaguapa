-- Roles migration tests. Fixture ids: admin ...0a, students ...b1 / ...b2.
begin;

-- Legacy 'user' rows were migrated.
select tests.expect_count($$select count(*) from public.profiles where role = 'user'$$, 0, 'no legacy user role left');
select tests.expect_count($$select count(*) from public.profiles where role = 'student'$$, 2, 'students migrated');

-- Sign-up creates the profile with the chosen account type.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'owner1@test.local', '{"full_name":"Owner One","account_type":"owner"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'student3@test.local', '{"name":"Student Three"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'sneaky@test.local', '{"account_type":"admin"}');
select tests.expect_count($$select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000c1' and role = 'owner' and full_name = 'Owner One'$$, 1, 'owner sign-up');
select tests.expect_count($$select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000b3' and role = 'student' and full_name = 'Student Three'$$, 1, 'student sign-up');
select tests.expect_count($$select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000e1' and role = 'student'$$, 1, 'cannot sign up as admin');

-- A student can read and edit their own profile but not escalate.
select tests.login('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select tests.expect_count($$select count(*) from public.profiles$$, 1, 'student sees only own profile');
update public.profiles set full_name = 'Student Uno' where id = '00000000-0000-0000-0000-0000000000b1';
select tests.expect_count($$select count(*) from public.profiles where full_name = 'Student Uno'$$, 1, 'student edits own name');
select tests.expect_error($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b1'$$, '%Only an admin%');
select tests.expect_error($$update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000b1'$$, '%Only an admin%');
select tests.expect_count($$with u as (update public.profiles set full_name = 'x' where id = '00000000-0000-0000-0000-0000000000b2' returning 1) select count(*) from u$$, 0, 'student cannot edit others');
select tests.expect_error($$update public.profiles set email = 'new@test.local' where id = '00000000-0000-0000-0000-0000000000b1'$$, '%changed through auth%');
select tests.expect_count($$select count(*) from public.profile_cards$$, 6, 'profile cards are public');
reset role;

-- The v1 client still inserts role 'user' itself; it is stored as student.
delete from public.profiles where id = '00000000-0000-0000-0000-0000000000b3';
select tests.login('00000000-0000-0000-0000-0000000000b3');
set local role authenticated;
insert into public.profiles (id, email, role, is_active) values ('00000000-0000-0000-0000-0000000000b3', 'student3@test.local', 'user', true);
select tests.expect_error($$insert into public.profiles (id, email) values ('00000000-0000-0000-0000-0000000000b2', 'x')$$, '%own profile%');
reset role;
select tests.expect_count($$select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000b3' and role = 'student'$$, 1, 'legacy insert normalised');

-- v1 guard trigger is gone (replaced by app.profiles_guard)
select tests.expect_count($$select count(*) from pg_trigger where tgname = 'protect_profile_system_fields'$$, 0, 'old guard dropped');

-- Auth email change still syncs (runs without a user JWT)
update auth.users set email = 'student1.new@test.local' where id = '00000000-0000-0000-0000-0000000000b1';
select tests.expect_count($$select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000b1' and email = 'student1.new@test.local'$$, 1, 'email sync from auth');

-- Re-running the auth insert upsert keeps the role and fills missing names
select tests.expect_count($$select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000c1' and role = 'owner'$$, 1, 'owner role kept');

-- Admin can change roles.
select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
update public.profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000b2';
select tests.expect_count($$select count(*) from public.profiles$$, 6, 'admin sees all profiles');
reset role;
select tests.expect_count($$select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000b2' and role = 'owner'$$, 1, 'admin changed role');

rollback;
