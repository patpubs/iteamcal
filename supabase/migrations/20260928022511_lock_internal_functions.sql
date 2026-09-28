-- Supabase grants EXECUTE on new functions to signed-in users directly, so
-- revoking from PUBLIC isn't enough. Trigger and internal helpers are not
-- part of the app's API.
revoke execute on function
  public.handle_new_user(),
  public.guard_last_admin(),
  public.guard_profile_link(),
  public.unlink_archived_crew(),
  public.guard_timecard(),
  public.log_timecard_change(),
  public.guard_request_insert(),
  public.touch_updated_at(),
  public.timecards_hidden_for(uuid)
from authenticated, anon;
