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
commit;

begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($q$ insert into public.time_off_requests (requester_id, crew_id, start_date, end_date, type) values (auth.uid(), '00000000-0000-0000-0000-00000000c003', '2026-10-05', '2026-10-05', 'other') $q$, 'unlinked pending user requesting');
commit;

begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.decide_time_off_request('00000000-0000-0000-0000-0000000000f1', true, 'Feel better');
select pg_temp.expect_error($q$ select public.decide_time_off_request('00000000-0000-0000-0000-0000000000f1', false) $q$, 'deciding twice');
do $$ begin
  assert (select count(*) from public.time_off where request_id = '00000000-0000-0000-0000-0000000000f1') = 1,
    'approval should create exactly one absence';
  assert (select count(*) from public.time_off_requests where id = '00000000-0000-0000-0000-0000000000f2') = 0,
    'cancelled request should be deleted';
end $$;
commit;

begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  assert (select count(*) from public.notifications where kind = 'request_decided') = 1, 'requester should be notified';
  assert (select body from public.notifications where kind = 'request_decided') like '%Feel better%', 'note should reach requester';
  assert (select type from public.time_off_in_range('2026-10-01', '2026-10-31')) = 'sick', 'own time off shows type';
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

\echo 'All permission checks passed.'
