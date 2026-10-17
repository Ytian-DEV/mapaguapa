-- Listings migration tests.
-- Fixture: admin ...0a, students ...b1/...b2; listings 1000...01-05 (05 archived).
begin;

-- Status and price backfill
select tests.expect_count($$select count(*) from public.listings where status in ('active', 'deleted')$$, 0, 'legacy statuses migrated');
select tests.expect_count($$select count(*) from public.listings where status = 'archived'$$, 1, 'deleted -> archived');
select tests.expect_count($$select count(*) from public.listings where id = '10000000-0000-0000-0000-000000000001' and price_band = '1000_1999'$$, 1, 'band from min/max');
select tests.expect_count($$select count(*) from public.listings where id = '10000000-0000-0000-0000-000000000002' and price_band = 'under_1000'$$, 1, 'band from max only');
select tests.expect_count($$select count(*) from public.listings where id = '10000000-0000-0000-0000-000000000003' and price_band = '3000_plus'$$, 1, 'band from min only');
select tests.expect_count($$select count(*) from public.listings where id = '10000000-0000-0000-0000-000000000004' and price_band = '2000_2999'$$, 1, 'band from label only');

-- Exclusivity grouping from v1 free text
select tests.expect_count($$select count(*) from public.listings where id = '10000000-0000-0000-0000-000000000002' and exclusivity_group = 'ladies'$$, 1, 'Ladies only -> ladies');
select tests.expect_count($$select count(*) from public.listings where id = '10000000-0000-0000-0000-000000000003' and exclusivity_group = 'men'$$, 1, 'Men only -> men');
select tests.expect_count($$select count(*) from public.listings where id = '10000000-0000-0000-0000-000000000001' and exclusivity_group = 'mixed'$$, 1, 'Mixed -> mixed');
select tests.expect_count($$select count(*) from (values
  ('Female only', 'ladies'), ('Women', 'ladies'), ('Male only', 'men'), ('Boys', 'men'),
  ('Co-ed', 'mixed'), ('Male and Female', 'mixed'), ('', null), ('Family', null)
) v(input, expected) where app.exclusivity_group_of(input) is distinct from expected$$, 0, 'exclusivity grouping rules');

-- rent_exact drives band, min/max and label (room types widen the range)
update public.listings
set rent_exact = 2800, room_types = '[{"label":"Room for 2","capacity":2,"rent":3000,"available":1},{"label":"Room for 4","capacity":4,"rent":2800,"available":1}]'
where id = '10000000-0000-0000-0000-000000000001';
select tests.expect_count($$select count(*) from public.listings where id = '10000000-0000-0000-0000-000000000001'
  and price_band = '2000_2999' and monthly_rent_min = 2800 and monthly_rent_max = 3000 and monthly_rental_label = '₱2,000–2,999'$$, 1, 'rent_exact derivation');

-- Make two owners
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'owner1@test.local', '{"account_type":"owner"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'owner2@test.local', '{"account_type":"owner"}');

-- Anonymous visitors and students only see published listings
set local role anon;
select tests.expect_count($$select count(*) from public.listings$$, 0, 'signed-out visitors see nothing (as in v1)');
select tests.expect_error($$select count(*) from public.profile_cards$$, '%permission denied%');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select tests.expect_count($$select count(*) from public.listings$$, 4, 'student sees published only');
select tests.expect_error($$insert into public.listings (name, address, accommodation_type, monthly_rental_label) values ('x', 'y', 'z', 'w')$$, '%Only owners and admins%');
select tests.expect_count($$with u as (update public.listings set name = 'hacked' returning 1) select count(*) from u$$, 0, 'student cannot update');
select tests.expect_error($$select public.archive_listing('10000000-0000-0000-0000-000000000001')$$, '%Only admins%');
reset role;

-- Owner creates a draft, cannot self-publish, submits for review
select tests.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
insert into public.listings (id, name, address, accommodation_type, monthly_rental_label, rent_exact, owner_id, status)
values ('20000000-0000-0000-0000-000000000001', 'Owner Draft', 'Guadalupe', 'Boarding house', '', 1500, '00000000-0000-0000-0000-0000000000b1', 'draft');
select tests.expect_count($$select count(*) from public.listings where id = '20000000-0000-0000-0000-000000000001' and owner_id = '00000000-0000-0000-0000-0000000000c1' and price_band = '1000_1999'$$, 1, 'owner_id forced to self');
select tests.expect_error($$insert into public.listings (name, address, accommodation_type, monthly_rental_label, status) values ('x', 'y', 'z', 'w', 'published')$$, '%draft or be submitted%');
select tests.expect_error($$update public.listings set status = 'published' where id = '20000000-0000-0000-0000-000000000001'$$, '%Only an admin%');
select tests.expect_error($$update public.listings set status = 'archived' where id = '20000000-0000-0000-0000-000000000001'$$, '%Only an admin%');
update public.listings set review_note = 'self note', status = 'in_review' where id = '20000000-0000-0000-0000-000000000001';
select tests.expect_count($$select count(*) from public.listings where id = '20000000-0000-0000-0000-000000000001' and status = 'in_review' and review_note is null and submitted_at is not null$$, 1, 'owner submits; cannot write review_note');
select tests.expect_count($$select count(*) from public.listings$$, 5, 'owner sees published + own');
select tests.expect_count($$with u as (update public.listings set name = 'mine now' where id = '10000000-0000-0000-0000-000000000002' returning 1) select count(*) from u$$, 0, 'owner cannot edit others');
-- photo rows for own listing
insert into public.listing_photos (listing_id, storage_path) values ('20000000-0000-0000-0000-000000000001', 'owner/20000000-0000-0000-0000-000000000001/a.jpg');
select tests.expect_error($$insert into public.listing_photos (listing_id, storage_path) values ('10000000-0000-0000-0000-000000000002', 'x.jpg')$$, '%row-level security%');
-- storage folder rule
insert into storage.objects (bucket_id, name) values ('listing-photos', 'owner/20000000-0000-0000-0000-000000000001/a.jpg');
select tests.expect_error($$insert into storage.objects (bucket_id, name) values ('listing-photos', 'owner/10000000-0000-0000-0000-000000000002/a.jpg')$$, '%row-level security%');
select tests.expect_error($$insert into storage.objects (bucket_id, name) values ('listing-photos', 'admin/20000000-0000-0000-0000-000000000001/a.jpg')$$, '%row-level security%');
reset role;

-- Another owner can't see the in-review listing
select tests.login('00000000-0000-0000-0000-0000000000c2');
set local role authenticated;
select tests.expect_count($$select count(*) from public.listings where id = '20000000-0000-0000-0000-000000000001'$$, 0, 'other owner cannot see');
select tests.expect_count($$select count(*) from public.listing_photos where listing_id = '20000000-0000-0000-0000-000000000001'$$, 0, 'other owner cannot see photos');
reset role;

-- Admin requests changes, then publishes
select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
update public.listings set status = 'changes_requested', review_note = 'Add a photo of the CR.' where id = '20000000-0000-0000-0000-000000000001';
reset role;
select tests.expect_count($$select count(*) from public.listings where id = '20000000-0000-0000-0000-000000000001' and status = 'changes_requested' and reviewed_by = '00000000-0000-0000-0000-00000000000a'$$, 1, 'admin requested changes');

select tests.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
select tests.expect_count($$select count(*) from public.listings where id = '20000000-0000-0000-0000-000000000001' and review_note = 'Add a photo of the CR.'$$, 1, 'owner sees review note');
update public.listings set status = 'in_review', description = 'Now with CR photo' where id = '20000000-0000-0000-0000-000000000001';
reset role;

select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
update public.listings set status = 'published' where id = '20000000-0000-0000-0000-000000000001';
reset role;
select tests.expect_count($$select count(*) from public.listings where id = '20000000-0000-0000-0000-000000000001' and status = 'published' and published_at is not null and review_note is null$$, 1, 'admin published');

-- Owner edit of a published listing resubmits it; so does a photo change
select tests.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
update public.listings set curfew = '10 PM' where id = '20000000-0000-0000-0000-000000000001';
reset role;
select tests.expect_count($$select count(*) from public.listings where id = '20000000-0000-0000-0000-000000000001' and status = 'in_review'$$, 1, 'edit resubmits');
select tests.logout();
update public.listings set status = 'published' where id = '20000000-0000-0000-0000-000000000001';
select tests.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
update public.listing_photos set is_cover = true where listing_id = '20000000-0000-0000-0000-000000000001';
reset role;
select tests.expect_count($$select count(*) from public.listings where id = '20000000-0000-0000-0000-000000000001' and status = 'in_review'$$, 1, 'photo edit resubmits');

-- Archive / restore keep working (admin only) and v1 legacy status writes are mapped
select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select public.archive_listing('10000000-0000-0000-0000-000000000003', 'closed');
reset role;
select tests.expect_count($$select count(*) from public.listings where id = '10000000-0000-0000-0000-000000000003' and status = 'archived' and deleted_at is not null$$, 1, 'archived');
select tests.expect_count($$select count(*) from public.deleted_listings where original_listing_id = '10000000-0000-0000-0000-000000000003'
  and listing_snapshot ? 'listing' and listing_snapshot ? 'photos' and listing_snapshot #>> '{listing,status}' = 'published'$$, 1, 'archive snapshot keeps v1 {listing, photos} shape');

select tests.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
select tests.expect_error($$select public.restore_listing('10000000-0000-0000-0000-000000000003')$$, '%Only admins%');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select public.restore_listing('10000000-0000-0000-0000-000000000003');
insert into public.listings (id, name, address, accommodation_type, monthly_rental_label, status)
values ('30000000-0000-0000-0000-000000000001', 'v1 admin insert', 'Baybay', 'Boarding house', '₱2,000-2,999', 'active');
select tests.expect_count($$select count(*) from public.deleted_listings$$, 1, 'admin reads archive; restore keeps the record (v1 behaviour)');
reset role;
select tests.expect_count($$select count(*) from public.listings where id = '10000000-0000-0000-0000-000000000003' and status = 'published'$$, 1, 'restored');
select tests.expect_count($$select count(*) from public.listings where id = '30000000-0000-0000-0000-000000000001' and status = 'published' and price_band = '2000_2999'$$, 1, 'v1 active insert mapped');

rollback;
