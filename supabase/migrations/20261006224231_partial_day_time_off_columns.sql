-- Part-of-the-day time off: a single day with from/until times, such as
-- "Off 12:00 PM – 5:00 PM". No times means the whole day, as before.

alter table public.time_off_requests
  add column start_time time,
  add column end_time time,
  add constraint requests_part_day check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and end_time > start_time and start_date = end_date)
  );

alter table public.time_off
  add column start_time time,
  add column end_time time,
  add constraint time_off_part_day check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and end_time > start_time and start_date = end_date)
  );
