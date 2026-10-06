-- Permission and business-rule checks (PRD §16 acceptance checklist).
-- Run with scripts/test-db.sh. Each block raises on failure.

\set ON_ERROR_STOP 1
\set QUIET 1
\pset tuples_only on

create or replace function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end;
$$;

create or replace function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'FAIL: expected an error: %', p_label;
end;
$$;

-- Fixed ids keep the tests readable.
-- a1 = first account (admin), s1 = staff, s2 = second staff, p1 = stays pending
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'sam@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'lee@example.com'),
  ('00000000-0000-0000-0000-0000000000c1', 'pending@example.com');

do $$ begin
  assert (select role::text || '/' || approval::text from public.profiles
          where id = '00000000-0000-0000-0000-0000000000a1') = 'admin/approved',
    'first account should be approved admin';
  assert (select role::text || '/' || approval::text from public.profiles
          where id = '00000000-0000-0000-0000-0000000000b1') = 'staff/pending',
    'later accounts should be pending staff';
end $$;

-- Admin sets up crew and approves staff.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into public.crew (id, name, sort_order) values
  ('00000000-0000-0000-0000-00000000c001', 'Sam Rivera', 1),
  ('00000000-0000-0000-0000-00000000c002', 'Lee Park', 2),
  ('00000000-0000-0000-0000-00000000c003', 'Pat Office', 3);
update public.crew set hide_timecards = true where id = '00000000-0000-0000-0000-00000000c003';
update public.profiles set approval = 'approved'
  where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2');
update public.profiles set crew_id = '00000000-0000-0000-0000-00000000c001'
  where id = '00000000-0000-0000-0000-0000000000b1';
update public.profiles set crew_id = '00000000-0000-0000-0000-00000000c002'
  where id = '00000000-0000-0000-0000-0000000000b2';
insert into public.shifts (crew_id, shift_date, start_time, end_time)
  values ('00000000-0000-0000-0000-00000000c001', '2026-09-01', '08:00', '16:00');
select public.publish_week('2026-09-01', false);
insert into public.holidays (holiday_date, name) values ('2026-12-25', 'Christmas');
select pg_temp.expect_error($q$ insert into public.holidays (holiday_date, name) values ('2026-12-25', 'Dup') $q$, 'duplicate holiday date');
select pg_temp.expect_error($q$ insert into public.holidays (holiday_date, name) values ('2026-12-26', '  ') $q$, 'blank holiday name');
select pg_temp.expect_error($q$ update public.profiles set crew_id = '00000000-0000-0000-0000-00000000c001' where id = '00000000-0000-0000-0000-0000000000b2' $q$, 'two accounts on one crew member');
select pg_temp.expect_error($q$ update public.profiles set crew_id = '00000000-0000-0000-0000-00000000c003' where id = '00000000-0000-0000-0000-0000000000c1' $q$, 'linking a pending account');
select pg_temp.expect_error($q$ insert into public.shifts (crew_id, shift_date, start_time, end_time) values ('00000000-0000-0000-0000-00000000c001', '2026-09-02', '16:00', '08:00') $q$, 'shift ending before it starts');
commit;

-- Last admin guard.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_error($q$ update public.profiles set role = 'staff' where id = '00000000-0000-0000-0000-0000000000a1' $q$, 'demoting the last admin');
select pg_temp.expect_error($q$ update public.profiles set approval = 'rejected' where id = '00000000-0000-0000-0000-0000000000a1' $q$, 'rejecting the last admin');
commit;

-- Pending accounts see their own profile and nothing else.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'pending user should only see own profile';
  assert (select count(*) from public.crew) = 0, 'pending user should not see crew';
  assert (select count(*) from public.shifts) = 0, 'pending user should not see shifts';
  assert (select count(*) from public.holidays) = 0, 'pending user should not see holidays';
  assert (select count(*) from public.time_off_in_range('2000-01-01', '2100-01-01')) = 0, 'pending user should not see time off';
end $$;
commit;

-- Anonymous visitors get nothing.
begin;
set local role anon;
select pg_temp.expect_error('select * from public.crew', 'anon reading crew');
commit;

-- Staff can read the schedule but not change it, or their own access.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  assert (select count(*) from public.shifts) = 1, 'staff should read shifts';
  assert (select count(*) from public.profiles) = 1, 'staff should only see own profile';
end $$;
select pg_temp.expect_error($q$ insert into public.shifts (crew_id, shift_date) values ('00000000-0000-0000-0000-00000000c001', '2026-09-03') $q$, 'staff creating a shift');
do $$ declare n int; begin
  update public.shifts set notes = 'hacked';
  get diagnostics n = row_count;
  assert n = 0, 'staff should not update shifts';
  update public.profiles set role = 'admin' where id = auth.uid();
  get diagnostics n = row_count;
  assert n = 0, 'staff should not promote themselves';
end $$;
commit;

-- Time-off request lifecycle.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
insert into public.time_off_requests (id, requester_id, crew_id, start_date, end_date, type, reason, status)
  values ('00000000-0000-0000-0000-0000000000f1', auth.uid(), '00000000-0000-0000-0000-00000000c001',
          '2026-10-05', '2026-10-06', 'sick', 'flu', 'approved');
do $$ begin
  assert (select status from public.time_off_requests where id = '00000000-0000-0000-0000-0000000000f1') = 'pending',
    'new requests always start pending';
end $$;
select pg_temp.expect_error($q$ insert into public.time_off_requests (requester_id, crew_id, start_date, end_date, type) values (auth.uid(), '00000000-0000-0000-0000-00000000c002', '2026-10-05', '2026-10-05', 'other') $q$, 'requesting for another crew member');
select pg_temp.expect_error($q$ update public.time_off_requests set status = 'approved' $q$, 'staff approving own request');
select pg_temp.expect_error($q$ select public.decide_time_off_request('00000000-0000-0000-0000-0000000000f1', true) $q$, 'staff deciding a request');
insert into public.time_off_requests (id, requester_id, crew_id, start_date, end_date, type)
  values ('00000000-0000-0000-0000-0000000000f2', auth.uid(), '00000000-0000-0000-0000-00000000c001', '2026-11-01', '2026-11-01', 'personal');
delete from public.time_off_requests where id = '00000000-0000-0000-0000-0000000000f2';
-- Part of a day: one day with from/until times.
insert into public.time_off_requests (id, requester_id, crew_id, start_date, end_date, start_time, end_time, type)
  values ('00000000-0000-0000-0000-0000000000f3', auth.uid(), '00000000-0000-0000-0000-00000000c001',
          '2026-11-02', '2026-11-02', '13:00', '17:00', 'personal');
select pg_temp.expect_error($q$ insert into public.time_off_requests (requester_id, crew_id, start_date, end_date, start_time, end_time, type) values (auth.uid(), '00000000-0000-0000-0000-00000000c001', '2026-11-02', '2026-11-02', '17:00', '13:00', 'personal') $q$, 'part-day request ending before it starts');
commit;

begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($q$ insert into public.time_off_requests (requester_id, crew_id, start_date, end_date, type) values (auth.uid(), '00000000-0000-0000-0000-00000000c003', '2026-10-05', '2026-10-05', 'other') $q$, 'unlinked pending user requesting');
commit;

begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.decide_time_off_request('00000000-0000-0000-0000-0000000000f1', true, 'Feel better');
select pg_temp.expect_error($q$ select public.decide_time_off_request('00000000-0000-0000-0000-0000000000f1', false) $q$, 'deciding twice');
select public.decide_time_off_request('00000000-0000-0000-0000-0000000000f3', true);
do $$ begin
  assert (select start_time::text || '-' || end_time::text from public.time_off
          where request_id = '00000000-0000-0000-0000-0000000000f3') = '13:00:00-17:00:00',
    'approval keeps the hours';
  assert (select count(*) from public.time_off where request_id = '00000000-0000-0000-0000-0000000000f1') = 1,
    'approval should create exactly one absence';
  assert (select count(*) from public.time_off_requests where id = '00000000-0000-0000-0000-0000000000f2') = 0,
    'cancelled request should be deleted';
end $$;
commit;

begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  assert (select count(*) from public.notifications where kind = 'request_decided') = 2, 'requester should be notified';
  assert exists (select 1 from public.notifications where kind = 'request_decided' and body like '%Feel better%'), 'note should reach requester';
  assert exists (select 1 from public.notifications where kind = 'request_decided'
                 and body = 'Your personal request for Mon Nov 2, 1:00 PM – 5:00 PM was approved.'), 'part-day note names the hours';
  assert (select type from public.time_off_in_range('2026-10-01', '2026-10-31')) = 'sick', 'own time off shows type';
  assert (select start_time from public.time_off_hours_in_range('2026-11-02', '2026-11-02')) = '13:00', 'schedule gets the hours';
end $$;
do $$ declare n int; begin
  delete from public.time_off_requests where id = '00000000-0000-0000-0000-0000000000f1';
  get diagnostics n = row_count;
  assert n = 0, 'decided requests cannot be cancelled';
end $$;
commit;

begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  assert (select count(*) from public.time_off) = 0, 'coworker should not read time off rows directly';
  assert (select count(*) from public.time_off_in_range('2026-10-01', '2026-10-31')) = 1, 'coworker sees that someone is off';
  assert (select type from public.time_off_in_range('2026-10-01', '2026-10-31')) is null, 'coworker should not see the type';
  assert (select reason from public.time_off_in_range('2026-10-01', '2026-10-31')) is null, 'coworker should not see the reason';
  assert (select count(*) from public.notifications) = 0, 'notifications are private';
end $$;
commit;

-- Timecards.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
insert into public.timecards (id, user_id, work_date, start_time, end_time, lunch_start, lunch_end)
  values ('00000000-0000-0000-0000-0000000000d1', auth.uid(), '2026-09-01', '08:00', '16:30', '12:00', '12:30');
do $$ begin
  assert (select net_hours from public.timecards where id = '00000000-0000-0000-0000-0000000000d1') = 8.00,
    'net hours should subtract lunch';
end $$;
insert into public.timecards (user_id, work_date, start_time, lunch_start)
  values (auth.uid(), '2026-09-02', '08:00', '12:00');
do $$ begin
  assert (select net_hours from public.timecards where work_date = '2026-09-02') is null,
    'open shift has no hours yet';
end $$;
select pg_temp.expect_error($q$ insert into public.timecards (user_id, work_date, start_time) values (auth.uid(), '2026-09-01', '09:00') $q$, 'two cards on one day');
select pg_temp.expect_error($q$ insert into public.timecards (user_id, work_date, start_time) values (auth.uid(), '2099-01-01', '09:00') $q$, 'future date');
select pg_temp.expect_error($q$ insert into public.timecards (user_id, work_date, start_time, end_time) values (auth.uid(), '2026-09-03', '09:00', '08:00') $q$, 'end before start');
select pg_temp.expect_error($q$ update public.timecards set end_time = '16:00' where work_date = '2026-09-02' $q$, 'clocking out with lunch still open');
select pg_temp.expect_error($q$ insert into public.timecards (user_id, work_date, start_time) values ('00000000-0000-0000-0000-0000000000b2', '2026-09-03', '09:00') $q$, 'writing a coworker card');
commit;

-- Hidden timecards are enforced in the database.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
update public.crew set hide_timecards = true where id = '00000000-0000-0000-0000-00000000c002';
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select pg_temp.expect_error($q$ insert into public.timecards (user_id, work_date, start_time) values (auth.uid(), '2026-09-01', '09:00') $q$, 'hidden-timecards user adding a card');
commit;

-- Manager corrections notify the owner and leave an audit entry.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
update public.timecards set end_time = '17:00' where id = '00000000-0000-0000-0000-0000000000d1';
delete from public.timecards where work_date = '2026-09-02';
do $$ begin
  assert (select count(*) from public.audit_log where table_name = 'timecards') = 2, 'edits should be audited';
end $$;
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  assert (select count(*) from public.notifications where kind = 'timecard_changed') = 2,
    'owner should be notified of manager edit and delete';
end $$;
select pg_temp.expect_error($q$ update public.notifications set title = 'x' $q$, 'editing notification text');
update public.notifications set read_at = now();
commit;

-- Archiving crew unlinks the account.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
update public.crew set archived_at = now() where id = '00000000-0000-0000-0000-00000000c002';
do $$ begin
  assert (select crew_id from public.profiles where id = '00000000-0000-0000-0000-0000000000b2') is null,
    'archiving should unlink the account';
end $$;
commit;

-- Internal helpers are not callable from the app.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_error($q$ select public.timecards_hidden_for(auth.uid()) $q$, 'calling an internal helper');
commit;

-- Pre-approved sign-ins from the old app.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into public.account_invites (email, role, crew_id) values
  ('invited@example.com', 'admin', '00000000-0000-0000-0000-00000000c003'),
  ('dupe-link@example.com', 'staff', '00000000-0000-0000-0000-00000000c001');
select pg_temp.expect_error($q$ insert into public.account_invites (email) values ('Mixed@Example.com') $q$, 'invite email must be lowercase');
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  assert (select count(*) from public.account_invites) = 0, 'staff should not see invites';
end $$;
commit;
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'Invited@Example.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'dupe-link@example.com');
do $$ begin
  assert (select role::text || '/' || approval::text || '/' || coalesce(crew_id::text, '-') from public.profiles
          where id = '00000000-0000-0000-0000-0000000000e1')
    = 'admin/approved/00000000-0000-0000-0000-00000000c003', 'invite should set role, approval, and crew';
  assert (select claimed_by from public.account_invites where email = 'invited@example.com')
    = '00000000-0000-0000-0000-0000000000e1', 'invite should be marked claimed';
  assert (select crew_id from public.profiles where id = '00000000-0000-0000-0000-0000000000e2') is null,
    'an invite must not steal a crew link another account already has';
  assert (select approval from public.profiles where id = '00000000-0000-0000-0000-0000000000e2') = 'approved',
    'the second invite is still approved';
end $$;

-- Schedule order: admins reorder crew, staff cannot.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.reorder_crew(array['00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000c001']::uuid[]);
do $$ begin
  assert (select sort_order from public.crew where id = '00000000-0000-0000-0000-00000000c002') = 1,
    'admin reorder should move Lee first';
  assert (select sort_order from public.crew where id = '00000000-0000-0000-0000-00000000c001') = 2,
    'admin reorder should move Sam second';
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_error($q$ select public.reorder_crew(array['00000000-0000-0000-0000-00000000c001']::uuid[]) $q$, 'staff reordering crew');
rollback;

-- Schedule tools: duplicate, copy week, undo, move.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into public.shifts (id, crew_id, shift_date, start_time, end_time, notes) values
  ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-00000000c001', '2027-03-01', '08:00', '16:00', 'src'),
  ('00000000-0000-0000-0000-0000000005a2', '00000000-0000-0000-0000-00000000c001', '2027-03-03', '09:00', '12:00', 'dest');
insert into public.time_off (crew_id, start_date, end_date, type) values
  ('00000000-0000-0000-0000-00000000c001', '2027-03-04', '2027-03-04', 'vacation');
do $$ begin
  assert public.duplicate_shift('00000000-0000-0000-0000-0000000005a1',
    array['2027-03-01', '2027-03-02', '2027-03-04', '2027-03-05', '2027-03-05']::date[]) = 2,
    'duplicate should skip its own day, time off, and repeats';
  assert (select count(*) from public.shifts where notes = 'src' and shift_date = '2027-03-05') = 1,
    'duplicate should copy notes and times';
end $$;
do $$
declare r record;
begin
  select * into r from public.copy_week('2027-03-03', '2027-03-10');
  assert r.copied = 4, format('copy week should copy 4 shifts, got %s', r.copied);
  assert (select count(*) from public.shifts where shift_date = '2027-03-08' and notes = 'src') = 1,
    'copy week should offset dates by a week';
  assert public.undo_copy_week(r.batch_id) = 4, 'undo should remove the copies';
  assert (select count(*) from public.shifts where shift_date between '2027-03-08' and '2027-03-14') = 0,
    'nothing left after undo';
end $$;
select pg_temp.expect_error($q$ select public.copy_week('2027-03-01', '2027-03-07') $q$, 'copy week onto itself');
select pg_temp.expect_error($q$ select public.move_shift('00000000-0000-0000-0000-0000000005a1',
  (select updated_at from public.shifts where id = '00000000-0000-0000-0000-0000000005a1'),
  '2027-03-04', '{}') $q$, 'moving onto time off');
select pg_temp.expect_error($q$ select public.move_shift('00000000-0000-0000-0000-0000000005a1',
  '2000-01-01', '2027-03-08', '{}') $q$, 'moving a stale shift');
select pg_temp.expect_error($q$ select public.move_shift('00000000-0000-0000-0000-0000000005a1',
  (select updated_at from public.shifts where id = '00000000-0000-0000-0000-0000000005a1'),
  '2027-03-03', '{}') $q$, 'moving onto a day that changed');
select public.move_shift('00000000-0000-0000-0000-0000000005a1',
  (select updated_at from public.shifts where id = '00000000-0000-0000-0000-0000000005a1'),
  '2027-03-03', array['00000000-0000-0000-0000-0000000005a2']::uuid[], 'replace');
do $$ begin
  assert (select shift_date from public.shifts where id = '00000000-0000-0000-0000-0000000005a1') = '2027-03-03',
    'move should change the date';
  assert not exists (select 1 from public.shifts where id = '00000000-0000-0000-0000-0000000005a2'),
    'replace should remove that person''s other shift';
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_error($q$ select public.duplicate_shift('00000000-0000-0000-0000-0000000005a1', array['2027-03-09']::date[]) $q$, 'staff duplicating');
select pg_temp.expect_error($q$ select public.copy_week('2027-03-01', '2027-03-15') $q$, 'staff copying a week');
rollback;

-- Punch clock uses the server's local time on today's card.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.punch('clock_in');
select pg_temp.expect_error($q$ select public.punch('clock_in') $q$, 'clocking in twice');
select pg_temp.expect_error($q$ select public.punch('lunch_end') $q$, 'ending a lunch that never started');
select public.punch('lunch_start');
select pg_temp.expect_error($q$ select public.punch('clock_out') $q$, 'clocking out during lunch');
select pg_temp.expect_error($q$ select public.punch('lunch_end') $q$, 'a lunch shorter than a minute');
-- Pretend the day started at midnight so the rest can finish inside one transaction.
update public.timecards set start_time = '00:00', lunch_start = '00:00'
  where user_id = auth.uid() and work_date = public.local_today();
select public.punch('lunch_end');
select public.punch('clock_out');
do $$ begin
  assert (select net_hours from public.timecards where user_id = auth.uid() and work_date = public.local_today()) is not null,
    'a finished punch day should have hours';
end $$;
select pg_temp.expect_error($q$ select public.punch('clock_out') $q$, 'clocking out twice');
select pg_temp.expect_error($q$ select public.punch('nap') $q$, 'unknown punch');
select pg_temp.expect_error($q$ select * from public.legacy_timecards $q$, 'reading staged old cards');
select pg_temp.expect_error($q$ select public.claim_legacy_timecards(auth.uid(), 'L1') $q$, 'claiming old cards by hand');
rollback;

-- Old timecards move onto the account the first time that person signs in.
begin;
insert into public.crew (id, name, sort_order, hide_timecards) values
  ('00000000-0000-0000-0000-00000000c0f2', 'Office Only', 9, true);
insert into public.account_invites (email, role, approval, crew_id, legacy_user_id) values
  ('oldcards@example.com', 'staff', 'approved', null, 'L1'),
  ('hiddencards@example.com', 'staff', 'approved', '00000000-0000-0000-0000-00000000c0f2', 'L2');
insert into public.legacy_timecards (legacy_user_id, work_date, start_time, end_time, lunch_start, lunch_end) values
  ('L1', '2026-08-03', '08:00', '16:30', '12:00', '12:30'),
  ('L1', '2026-08-04', '08:00', null, null, null),
  ('L1', '2099-01-01', '08:00', '09:00', null, null),
  ('L2', '2026-08-03', '08:00', '16:00', null, null);
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'oldcards@example.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'hiddencards@example.com');
do $$ begin
  assert (select count(*) from public.timecards where user_id = '00000000-0000-0000-0000-0000000000f1') = 2,
    'valid old cards should move to the new account';
  assert (select net_hours from public.timecards
          where user_id = '00000000-0000-0000-0000-0000000000f1' and work_date = '2026-08-03') = 8.00,
    'moved cards keep their hours';
  assert (select count(*) from public.legacy_timecards where legacy_user_id = 'L1') = 1,
    'a card that breaks a rule stays staged';
  assert (select count(*) from public.legacy_timecards where legacy_user_id = 'L2') = 1,
    'cards for someone who needs no timecards stay staged';
  assert (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000f1') = 0,
    'moving old cards sends no notifications';
end $$;
-- Admins can read the cards still staged for crew who never signed in; staff can't.
insert into public.account_invites (email, role, approval, crew_id, legacy_user_id) values
  ('leftcompany@example.com', 'staff', 'approved', '00000000-0000-0000-0000-00000000c0f2', 'L3');
insert into public.legacy_timecards (legacy_user_id, work_date, start_time, end_time, lunch_start, lunch_end) values
  ('L3', '2026-08-05', '09:00', '17:30', '12:00', '12:30');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_error($q$ select * from public.old_timecards('2026-08-01', '2026-08-09') $q$, 'staff reading old cards');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  assert (select count(*) from public.old_timecards('2026-08-01', '2026-08-09')) = 1,
    'admins see staged cards only for crew who never signed in';
  assert (select net_hours from public.old_timecards('2026-08-05', '2026-08-05')) = 8.00,
    'old cards come with hours';
end $$;
reset role;
rollback;

-- Email bookkeeping belongs to the server, not the app.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_error($q$ update public.notifications set emailed_at = now() $q$, 'marking a notification emailed');
select pg_temp.expect_error($q$ select public.queue_notification_email() $q$, 'calling the email trigger');
rollback;
begin;
insert into public.notifications (user_id, kind, title) values ('00000000-0000-0000-0000-0000000000b1', 'test', 'No hook set');
do $$ begin
  assert (select emailed_at from public.notifications where kind = 'test') is null, 'no email without a hook';
end $$;
rollback;

-- Preferences are personal.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
insert into public.user_preferences (time_format) values ('short');
update public.user_preferences set time_format = '24h';
do $$ begin
  assert (select time_format from public.user_preferences where user_id = auth.uid()) = '24h', 'own preference should save';
end $$;
select pg_temp.expect_error($q$ insert into public.user_preferences (user_id, time_format) values ('00000000-0000-0000-0000-0000000000b2', 'short') $q$, 'setting a coworker preference');
select pg_temp.expect_error($q$ update public.user_preferences set time_format = 'fancy' $q$, 'an unknown time format');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  assert (select count(*) from public.user_preferences) = 0, 'others preferences are private';
end $$;
rollback;

-- Push sign-ups are personal; the keys and reminder log are server-only.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.save_push_subscription('https://push.example.com/device-1', 'key', 'secret', 'Test phone');
do $$ begin
  assert (select count(*) from public.push_subscriptions) = 1, 'own device should save';
end $$;
select pg_temp.expect_error($q$ select public.save_push_subscription('http://insecure.example.com/x', 'key', 'secret') $q$, 'a non-https push endpoint');
select pg_temp.expect_error($q$ select * from public.push_keys $q$, 'reading the push keys');
select pg_temp.expect_error($q$ select * from public.reminders_sent $q$, 'reading the reminder log');
select pg_temp.expect_error($q$ select public.send_reminders() $q$, 'sending reminders from the app');
select pg_temp.expect_error($q$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-0000000000b2', 'https://push.example.com/x', 'k', 'a') $q$, 'adding a device for a coworker');
-- The same device signed in as someone else moves to them.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  assert (select count(*) from public.push_subscriptions) = 0, 'others devices are private';
end $$;
select public.save_push_subscription('https://push.example.com/device-1', 'key2', 'secret2');
do $$ begin
  assert (select count(*) from public.push_subscriptions) = 1, 'device should move to the new account';
end $$;
delete from public.push_subscriptions;
do $$ begin
  assert (select count(*) from public.push_subscriptions) = 0, 'own device can be removed';
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($q$ select public.save_push_subscription('https://push.example.com/device-2', 'k', 'a') $q$, 'push for a pending account');
rollback;

-- Clock-in, clock-out, and weekly reminders (times are US Central).
begin;
-- Earlier checks archived Lee; put Lee back on the roster.
update public.crew set archived_at = null, hide_timecards = false where id = '00000000-0000-0000-0000-00000000c002';
update public.profiles set crew_id = '00000000-0000-0000-0000-00000000c002'
  where id = '00000000-0000-0000-0000-0000000000b2';
-- Monday Aug 3: Sam 9:00–17:00 (with a later shift 18:00–20:00), Lee 9:00–15:00.
insert into public.shifts (crew_id, shift_date, start_time, end_time) values
  ('00000000-0000-0000-0000-00000000c001', '2026-08-03', '09:00', '17:00'),
  ('00000000-0000-0000-0000-00000000c001', '2026-08-03', '18:00', '20:00'),
  ('00000000-0000-0000-0000-00000000c002', '2026-08-03', '09:00', '15:00');
do $$ begin
  assert public.send_reminders('2026-08-03 09:30 America/Chicago') = 0, 'reminders start switched off';
end $$;
update public.settings set reminders_enabled = true;
do $$ begin
  assert public.send_reminders('2026-08-03 09:30 America/Chicago') = 0, 'draft weeks don''t send reminders';
end $$;
insert into public.schedule_weeks (week_start) values ('2026-08-03');
do $$ begin
  assert public.send_reminders('2026-08-03 09:10 America/Chicago') = 0, 'no reminder inside the grace period';
  assert public.send_reminders('2026-08-03 09:15 America/Chicago') = 2, 'both should get a clock-in reminder';
  assert public.send_reminders('2026-08-03 09:20 America/Chicago') = 0, 'clock-in reminder goes once';
  assert (select body from public.notifications
          where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'clock_in_reminder')
         like 'Your shift started at 9:00 AM.%', 'reminder names the start time';
end $$;
-- Sam clocked in; Lee never did.
insert into public.timecards (user_id, work_date, start_time)
  values ('00000000-0000-0000-0000-0000000000b1', '2026-08-03', '09:18');
do $$ begin
  -- 17:15 is 15 minutes after Sam's first shift, but the day's last shift ends at 20:00.
  assert public.send_reminders('2026-08-03 17:15 America/Chicago') = 0, 'split shift waits for the last one';
  assert public.send_reminders('2026-08-03 20:15 America/Chicago') = 1, 'open card gets a clock-out reminder';
  assert (select count(*) from public.notifications where kind = 'clock_out_reminder'
          and user_id = '00000000-0000-0000-0000-0000000000b1') = 1, 'clock-out reminder goes to Sam';
  assert public.send_reminders('2026-08-03 20:30 America/Chicago') = 0, 'clock-out reminder goes once';
end $$;
-- Time off and hidden timecards mean no reminder.
insert into public.time_off (crew_id, start_date, end_date, type)
  values ('00000000-0000-0000-0000-00000000c002', '2026-08-04', '2026-08-04', 'vacation');
insert into public.shifts (crew_id, shift_date, start_time, end_time)
  values ('00000000-0000-0000-0000-00000000c002', '2026-08-04', '09:00', '15:00');
do $$ begin
  assert public.send_reminders('2026-08-04 09:30 America/Chicago') = 0, 'no reminder on a day off';
end $$;
-- Part-day time off: Lee is off until noon, Sam leaves at 1 PM.
insert into public.time_off (crew_id, start_date, end_date, start_time, end_time, type) values
  ('00000000-0000-0000-0000-00000000c002', '2026-08-05', '2026-08-05', '09:00', '12:00', 'personal'),
  ('00000000-0000-0000-0000-00000000c001', '2026-08-05', '2026-08-05', '13:00', '17:00', 'personal');
insert into public.shifts (crew_id, shift_date, start_time, end_time) values
  ('00000000-0000-0000-0000-00000000c002', '2026-08-05', '09:00', '15:00'),
  ('00000000-0000-0000-0000-00000000c001', '2026-08-05', '09:00', '17:00');
insert into public.timecards (user_id, work_date, start_time)
  values ('00000000-0000-0000-0000-0000000000b1', '2026-08-05', '09:00');
do $$ begin
  assert public.send_reminders('2026-08-05 09:30 America/Chicago') = 0, 'part-day off covering the start waits';
  assert public.send_reminders('2026-08-05 12:15 America/Chicago') = 1, 'due once the part-day off ends';
  assert exists (select 1 from public.notifications where kind = 'clock_in_reminder'
                 and user_id = '00000000-0000-0000-0000-0000000000b2'
                 and body like 'Your shift started at 12:00 PM.%'), 'reminder names when they were due';
  assert public.send_reminders('2026-08-05 13:15 America/Chicago') = 1, 'leaving early gets a clock-out reminder then';
  assert exists (select 1 from public.notifications where kind = 'clock_out_reminder'
                 and user_id = '00000000-0000-0000-0000-0000000000b1'
                 and body like 'Your shift ended at 1:00 PM.%'), 'clock-out reminder uses the time they left';
  begin
    insert into public.time_off (crew_id, start_date, end_date, start_time, end_time, type)
      values ('00000000-0000-0000-0000-00000000c001', '2026-08-10', '2026-08-11', '09:00', '12:00', 'personal');
    raise exception 'part-day time off over two days should be refused';
  exception when check_violation then null;
  end;
end $$;
delete from public.timecards where work_date = '2026-08-05';
-- Sunday Aug 9 at 6 PM: weekly review for everyone who worked or was scheduled.
update public.timecards set end_time = '17:00'
  where user_id = '00000000-0000-0000-0000-0000000000b1' and work_date = '2026-08-03';
do $$ begin
  assert public.send_reminders('2026-08-09 17:59 America/Chicago') = 0, 'weekly review waits for its time';
  assert public.send_reminders('2026-08-09 18:00 America/Chicago') = 2, 'weekly review goes to Sam and Lee';
  assert public.send_reminders('2026-08-09 18:30 America/Chicago') = 0, 'weekly review goes once';
  assert (select body from public.notifications
          where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'weekly_review')
         like 'Your timecards add up to 7.70 hours for Aug 3 – Aug 9.%', 'weekly review shows the total';
  assert not (select bool_or(send_push) from public.notifications where kind = 'weekly_review'), 'weekly review is email only';
  assert (select bool_and(send_push and send_email) from public.notifications where kind like 'clock%'), 'clock reminders go by push and email';
end $$;
rollback;

-- Admin messages to staff.
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_error($q$ select public.send_message('Hi', 'Staff cannot broadcast') $q$, 'staff sending a message');
do $$ begin
  assert (select count(*) from public.push_ready_users()) = 0, 'staff cannot see who has push';
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_error($q$ select public.send_message('  ', 'No title') $q$, 'a message with no title');
select pg_temp.expect_error($q$ select public.send_message('Hi', 'Nobody', array['00000000-0000-0000-0000-0000000000c1']::uuid[]) $q$, 'a message only to a pending account');
select public.send_message('Weather alert', 'Office closes at 2 PM today.');
select public.send_message('Shift change', 'You now start at 10.', array['00000000-0000-0000-0000-0000000000b1']::uuid[], true, true);
select public.send_message('Email only', 'Check your inbox.', array['00000000-0000-0000-0000-0000000000b1']::uuid[], false, true);
select pg_temp.expect_error($q$ select public.send_message('Nowhere', 'x', null, false, false) $q$, 'a message with no way to send it');
reset role;
do $$ begin
  assert (select count(*) from public.notifications where title = 'Weather alert')
         = (select count(*) from public.profiles where approval = 'approved') - 1, 'message to everyone but the sender';
  assert not exists (select 1 from public.notifications where kind = 'message'
                     and user_id = '00000000-0000-0000-0000-0000000000a1'), 'sender does not message themselves';
  assert (select bool_and(send_push and not send_email) from public.notifications where title = 'Weather alert'), 'push only unless email asked';
  assert (select count(*) from public.notifications where title = 'Shift change') = 1, 'message to one person';
  assert (select bool_and(send_push and send_email) from public.notifications where title = 'Shift change'), 'push and email';
  assert (select bool_and(not send_push and send_email) from public.notifications where title = 'Email only'), 'email only';
end $$;
rollback;

-- Admins hear about new requests; supervisors hear about hand edits.
begin;
update public.crew set archived_at = null, hide_timecards = false where id = '00000000-0000-0000-0000-00000000c002';
update public.profiles set crew_id = '00000000-0000-0000-0000-00000000c002'
  where id = '00000000-0000-0000-0000-0000000000b2';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
insert into public.time_off_requests (requester_id, crew_id, start_date, end_date, type, reason)
  values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000c002', '2026-12-01', '2026-12-02', 'vacation', 'Family trip');
update public.profiles set timecard_alerts = true where id = auth.uid();
reset role;
do $$ begin
  assert not (select timecard_alerts from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), 'staff cannot turn on their own alerts';
  assert (select count(*) from public.notifications where kind = 'request_new' and body like '%Family trip%') =
         (select count(*) from public.profiles where role = 'admin' and approval = 'approved'), 'every admin hears about a new request';
  assert (select title from public.notifications where kind = 'request_new' and body like '%Family trip%' limit 1) = 'Time off request from Lee Park', 'request alert names the person';
end $$;
-- Sam supervises; Lee edits by hand, then punches.
update public.profiles set timecard_alerts = true where id = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
insert into public.timecards (user_id, work_date, start_time, end_time)
  values ('00000000-0000-0000-0000-0000000000b2', '2026-08-05', '09:00', '17:00');
update public.timecards set start_time = '08:30' where user_id = auth.uid() and work_date = '2026-08-05';
update public.timecards set lunch_start = '12:00', lunch_end = '12:30' where user_id = auth.uid() and work_date = '2026-08-05';
delete from public.timecards where user_id = auth.uid() and work_date = public.local_today();
select public.punch('clock_in');
reset role;
do $$ begin
  assert (select count(*) from public.notifications where kind = 'timecard_edited_by_owner'
          and user_id = '00000000-0000-0000-0000-0000000000b1') = 2, 'supervisor hears about the add and the start change only';
  assert exists (select 1 from public.notifications where kind = 'timecard_edited_by_owner'
                 and body like '%start 9:00 AM → 8:30 AM.'), 'alert shows old and new times';
end $$;
rollback;

-- Draft and publish: staff see a week only once it's published.
begin;
update public.crew set archived_at = null where id = '00000000-0000-0000-0000-00000000c002';
update public.profiles set crew_id = '00000000-0000-0000-0000-00000000c002'
  where id = '00000000-0000-0000-0000-0000000000b2';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into public.shifts (id, crew_id, shift_date, start_time, end_time) values
  ('00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-00000000c001', '2027-05-04', '09:00', '17:00'),
  ('00000000-0000-0000-0000-0000000006a2', '00000000-0000-0000-0000-00000000c002', '2027-05-05', '10:00', '14:00');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  assert (select count(*) from public.shifts where shift_date between '2027-05-03' and '2027-05-09') = 0, 'staff can''t see a draft week';
end $$;
select pg_temp.expect_error($q$ select public.publish_week('2027-05-03') $q$, 'staff publishing');
select pg_temp.expect_error($q$ insert into public.schedule_weeks (week_start) values ('2027-05-03') $q$, 'staff writing weeks directly');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  assert (select count(*) from public.week_recipients('2027-05-06')) = 2, 'both scheduled people would hear';
  assert public.publish_week('2027-05-06') = 2, 'publishing tells both scheduled people';
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  assert (select count(*) from public.shifts where shift_date between '2027-05-03' and '2027-05-09') = 2, 'staff see a published week';
  assert (select title from public.notifications where kind = 'schedule_published') = 'Schedule posted for May 3 – May 9', 'posted title';
  assert (select body from public.notifications where kind = 'schedule_published') = 'Tue May 4 9:00 AM – 5:00 PM', 'posted body lists shifts';
end $$;
-- Changes after publishing: only the changed person hears, once the admin sends it.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
update public.shifts set end_time = '15:00' where id = '00000000-0000-0000-0000-0000000006a2';
update public.shifts set notes = notes where id = '00000000-0000-0000-0000-0000000006a1';
do $$ begin
  assert (select changed_crew from public.schedule_weeks where week_start = '2027-05-03') = array['00000000-0000-0000-0000-00000000c002']::uuid[], 'tracks who changed';
  assert public.publish_week('2027-05-03') = 1, 'update goes to the changed person only';
  assert (select changed_crew from public.schedule_weeks where week_start = '2027-05-03') = '{}', 'update clears the list';
end $$;
delete from public.shifts where id = '00000000-0000-0000-0000-0000000006a1';
do $$ begin
  assert public.publish_week('2027-05-03', false) = 0, 'clearing without telling anyone';
end $$;
reset role;
do $$ begin
  assert (select body from public.notifications where kind = 'schedule_changed') = 'Wed May 5 10:00 AM – 3:00 PM', 'change shows the new times';
  assert (select link from public.notifications where kind = 'schedule_changed') = '/?view=week&date=2027-05-03', 'links to the week';
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.unpublish_week('2027-05-03');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  assert (select count(*) from public.shifts where shift_date between '2027-05-03' and '2027-05-09') = 0, 'back to draft hides it again';
end $$;
rollback;

-- Cancelling days off; removing turned-away accounts.
begin;
update public.crew set archived_at = null where id = '00000000-0000-0000-0000-00000000c002';
update public.profiles set crew_id = '00000000-0000-0000-0000-00000000c002'
  where id = '00000000-0000-0000-0000-0000000000b2';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
insert into public.time_off_requests (id, requester_id, crew_id, start_date, end_date, type)
  values ('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-0000000000b2',
          '00000000-0000-0000-0000-00000000c002', public.local_today() + 10, public.local_today() + 11, 'vacation');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.decide_time_off_request('00000000-0000-0000-0000-0000000007a1', true);
insert into public.time_off (id, crew_id, start_date, end_date, type) values
  ('00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-00000000c002', public.local_today() - 2, public.local_today() + 2, 'sick'),
  ('00000000-0000-0000-0000-0000000007b2', '00000000-0000-0000-0000-00000000c002', public.local_today() + 20, public.local_today() + 22, 'personal'),
  ('00000000-0000-0000-0000-0000000007b3', '00000000-0000-0000-0000-00000000c001', public.local_today() + 5, public.local_today() + 5, 'personal');
-- Sam can't cancel Lee's; Lee cancels a future range and the rest of a current one.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_error($q$ select public.cancel_time_off((select id from public.time_off where request_id = '00000000-0000-0000-0000-0000000007a1')) $q$, 'cancelling someone else''s day off');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.cancel_time_off((select id from public.time_off where request_id = '00000000-0000-0000-0000-0000000007a1'));
select public.cancel_time_off('00000000-0000-0000-0000-0000000007b1');
reset role;
do $$ begin
  assert not exists (select 1 from public.time_off where request_id = '00000000-0000-0000-0000-0000000007a1'), 'future day off removed';
  assert (select status::text from public.time_off_requests where id = '00000000-0000-0000-0000-0000000007a1') = 'cancelled', 'request shows cancelled';
  assert (select end_date from public.time_off where id = '00000000-0000-0000-0000-0000000007b1') = public.local_today() - 1, 'past days stay on record';
  assert (select count(*) from public.notifications where kind = 'time_off_cancelled') =
         2 * (select count(*) from public.profiles where role = 'admin' and approval = 'approved'), 'admins hear about each cancel';
  assert (select title from public.notifications where kind = 'time_off_cancelled' limit 1) = 'Lee Park cancelled time off', 'names the person';
  assert not exists (select 1 from public.notifications where kind = 'time_off_removed'), 'no "removed" note for your own cancel';
end $$;
-- An admin deleting someone's day off tells them.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
delete from public.time_off where id = '00000000-0000-0000-0000-0000000007b2';
reset role;
do $$ begin
  assert (select count(*) from public.notifications where kind = 'time_off_removed'
          and user_id = '00000000-0000-0000-0000-0000000000b2') = 1, 'owner hears an admin removed it';
end $$;
rollback;

\echo 'All permission checks passed.'
