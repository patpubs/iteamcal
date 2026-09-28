// Generated from the Supabase schema. Regenerate after each migration.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Enums_ = {
  app_role: 'admin' | 'staff';
  approval_status: 'pending' | 'approved' | 'rejected';
  request_status: 'pending' | 'approved' | 'declined';
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
          id: string;
          kind: string;
          link: string | null;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          link?: string | null;
          read_at?: string | null;
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
          updated_at: string;
        };
        Insert: {
          approval?: Enums_['approval_status'];
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
        Row: { id: boolean; staff_see_coworker_time_off_details: boolean; timezone: string; updated_at: string };
        Insert: {
          id?: boolean;
          staff_see_coworker_time_off_details?: boolean;
          timezone?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['settings']['Insert']>;
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
    };
    Views: { [_ in never]: never };
    Functions: {
      decide_time_off_request: {
        Args: { p_approve: boolean; p_note?: string; p_request_id: string };
        Returns: Database['public']['Tables']['time_off_requests']['Row'];
      };
      is_admin: { Args: never; Returns: boolean };
      is_approved: { Args: never; Returns: boolean };
      local_today: { Args: never; Returns: string };
      my_crew_id: { Args: never; Returns: string };
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
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
