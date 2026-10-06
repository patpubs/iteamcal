// Generated from the Supabase schema. Regenerate after each migration.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Enums_ = {
  app_role: 'admin' | 'staff';
  approval_status: 'pending' | 'approved' | 'rejected';
  request_status: 'pending' | 'approved' | 'declined' | 'cancelled';
  time_off_type: 'vacation' | 'sick' | 'personal' | 'other';
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.5' };
  public: {
    Tables: {
      account_invites: {
        Row: {
          approval: Enums_['approval_status'];
          claimed_at: string | null;
          claimed_by: string | null;
          created_at: string;
          crew_id: string | null;
          email: string;
          id: string;
          legacy_user_id: string | null;
          role: Enums_['app_role'];
        };
        Insert: {
          approval?: Enums_['approval_status'];
          claimed_at?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          crew_id?: string | null;
          email: string;
          id?: string;
          legacy_user_id?: string | null;
          role?: Enums_['app_role'];
        };
        Update: Partial<Database['public']['Tables']['account_invites']['Insert']>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          after: Json | null;
          before: Json | null;
          created_at: string;
          id: number;
          record_id: string | null;
          table_name: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          id?: never;
          record_id?: string | null;
          table_name: string;
        };
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>;
        Relationships: [];
      };
      crew: {
        Row: {
          archived_at: string | null;
          color: string;
          created_at: string;
          full_time: boolean;
          hide_timecards: boolean;
          id: string;
          job_label: string | null;
          legacy_id: number | null;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          full_time?: boolean;
          hide_timecards?: boolean;
          id?: string;
          job_label?: string | null;
          legacy_id?: number | null;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['crew']['Insert']>;
        Relationships: [];
      };
      holidays: {
        Row: { created_at: string; holiday_date: string; id: string; name: string; updated_at: string };
        Insert: { created_at?: string; holiday_date: string; id?: string; name: string; updated_at?: string };
        Update: Partial<Database['public']['Tables']['holidays']['Insert']>;
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          email_error: string | null;
          emailed_at: string | null;
          id: string;
          kind: string;
          link: string | null;
          read_at: string | null;
          send_email: boolean;
          send_push: boolean;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          email_error?: string | null;
          emailed_at?: string | null;
          id?: string;
          kind: string;
          link?: string | null;
          read_at?: string | null;
          send_email?: boolean;
          send_push?: boolean;
          title: string;
          user_id: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          approval: Enums_['approval_status'];
          created_at: string;
          crew_id: string | null;
          display_name: string | null;
          email: string | null;
          id: string;
          role: Enums_['app_role'];
          timecard_alerts: boolean;
          updated_at: string;
        };
        Insert: {
          approval?: Enums_['approval_status'];
          timecard_alerts?: boolean;
          created_at?: string;
          crew_id?: string | null;
          display_name?: string | null;
          email?: string | null;
          id: string;
          role?: Enums_['app_role'];
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      settings: {
        Row: {
          email_hook_url: string | null;
          id: boolean;
          reminder_minutes: number;
          reminders_enabled: boolean;
          staff_see_coworker_time_off_details: boolean;
          timezone: string;
          updated_at: string;
          weekly_review_day: number;
          weekly_review_time: string;
        };
        Insert: {
          email_hook_url?: string | null;
          id?: boolean;
          reminder_minutes?: number;
          reminders_enabled?: boolean;
          weekly_review_day?: number;
          weekly_review_time?: string;
          staff_see_coworker_time_off_details?: boolean;
          timezone?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['settings']['Insert']>;
        Relationships: [];
      };
      schedule_weeks: {
        Row: { changed_crew: string[]; published_at: string; published_by: string | null; week_start: string };
        Insert: { changed_crew?: string[]; published_at?: string; published_by?: string | null; week_start: string };
        Update: Partial<Database['public']['Tables']['schedule_weeks']['Insert']>;
        Relationships: [];
      };
      shifts: {
        Row: {
          copy_batch_id: string | null;
          created_at: string;
          created_by: string | null;
          crew_id: string;
          end_time: string | null;
          id: string;
          notes: string | null;
          shift_date: string;
          start_time: string | null;
          updated_at: string;
        };
        Insert: {
          copy_batch_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          crew_id: string;
          end_time?: string | null;
          id?: string;
          notes?: string | null;
          shift_date: string;
          start_time?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['shifts']['Insert']>;
        Relationships: [];
      };
      time_off: {
        Row: {
          created_at: string;
          created_by: string | null;
          crew_id: string;
          end_date: string;
          id: string;
          reason: string | null;
          request_id: string | null;
          start_date: string;
          start_time: string | null;
          end_time: string | null;
          type: Enums_['time_off_type'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          crew_id: string;
          end_date: string;
          id?: string;
          reason?: string | null;
          request_id?: string | null;
          start_date: string;
          start_time?: string | null;
          end_time?: string | null;
          type: Enums_['time_off_type'];
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['time_off']['Insert']>;
        Relationships: [];
      };
      time_off_requests: {
        Row: {
          created_at: string;
          crew_id: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_note: string | null;
          end_date: string;
          id: string;
          reason: string | null;
          requester_id: string;
          start_date: string;
          start_time: string | null;
          end_time: string | null;
          status: Enums_['request_status'];
          type: Enums_['time_off_type'];
        };
        Insert: {
          created_at?: string;
          crew_id: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          end_date: string;
          id?: string;
          reason?: string | null;
          requester_id: string;
          start_date: string;
          start_time?: string | null;
          end_time?: string | null;
          status?: Enums_['request_status'];
          type: Enums_['time_off_type'];
        };
        Update: Partial<Database['public']['Tables']['time_off_requests']['Insert']>;
        Relationships: [];
      };
      timecards: {
        Row: {
          created_at: string;
          end_time: string | null;
          id: string;
          lunch_end: string | null;
          lunch_start: string | null;
          net_hours: number | null;
          start_time: string;
          updated_at: string;
          user_id: string;
          work_date: string;
        };
        Insert: {
          created_at?: string;
          end_time?: string | null;
          id?: string;
          lunch_end?: string | null;
          lunch_start?: string | null;
          start_time: string;
          updated_at?: string;
          user_id: string;
          work_date: string;
        };
        Update: Partial<Database['public']['Tables']['timecards']['Insert']>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: Partial<Database['public']['Tables']['push_subscriptions']['Insert']>;
        Relationships: [];
      };
      user_preferences: {
        Row: { time_format: 'full' | 'short' | '24h'; updated_at: string; user_id: string };
        Insert: { time_format?: 'full' | 'short' | '24h'; updated_at?: string; user_id?: string };
        Update: Partial<Database['public']['Tables']['user_preferences']['Insert']>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      decide_time_off_request: {
        Args: { p_approve: boolean; p_note?: string; p_request_id: string };
        Returns: Database['public']['Tables']['time_off_requests']['Row'];
      };
      cancel_time_off: { Args: { p_id: string }; Returns: undefined };
      is_admin: { Args: never; Returns: boolean };
      unpublish_week: { Args: { p_week: string }; Returns: undefined };
      week_recipients: { Args: { p_week: string }; Returns: { crew_id: string; has_account: boolean }[] };
      publish_week: { Args: { p_week: string; p_notify?: boolean }; Returns: number };
      push_public_key: { Args: never; Returns: string | null };
      push_ready_users: { Args: never; Returns: string[] };
      send_message: {
        Args: { p_title: string; p_body: string; p_to?: string[]; p_push?: boolean; p_email?: boolean };
        Returns: number;
      };
      save_push_subscription: {
        Args: { p_endpoint: string; p_p256dh: string; p_auth: string; p_user_agent?: string };
        Returns: undefined;
      };
      is_approved: { Args: never; Returns: boolean };
      local_today: { Args: never; Returns: string };
      my_crew_id: { Args: never; Returns: string };
      reorder_crew: { Args: { p_ids: string[] }; Returns: undefined };
      require_admin: { Args: never; Returns: undefined };
      duplicate_shift: { Args: { p_shift_id: string; p_dates: string[] }; Returns: number };
      copy_week: { Args: { p_from: string; p_to: string }; Returns: { batch_id: string; copied: number }[] };
      undo_copy_week: { Args: { p_batch_id: string }; Returns: number };
      old_timecards: {
        Args: { p_from: string; p_to: string };
        Returns: {
          crew_id: string;
          work_date: string;
          start_time: string;
          lunch_start: string | null;
          lunch_end: string | null;
          end_time: string | null;
          net_hours: number | null;
        }[];
      };
      punch: {
        Args: { p_action: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out' };
        Returns: Database['public']['Tables']['timecards']['Row'];
      };
      move_shift: {
        Args: {
          p_shift_id: string;
          p_expected_updated_at: string;
          p_to: string;
          p_expected_dest: string[];
          p_mode?: 'merge' | 'replace';
        };
        Returns: undefined;
      };
      time_off_hours_in_range: {
        Args: { p_from: string; p_to: string };
        Returns: {
          crew_id: string;
          end_date: string;
          id: string;
          reason: string | null;
          start_date: string;
          type: Enums_['time_off_type'] | null;
          start_time: string | null;
          end_time: string | null;
        }[];
      };
      time_off_in_range: {
        Args: { p_from: string; p_to: string };
        Returns: {
          crew_id: string;
          end_date: string;
          id: string;
          reason: string | null;
          start_date: string;
          type: Enums_['time_off_type'] | null;
        }[];
      };
    };
    Enums: Enums_;
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
