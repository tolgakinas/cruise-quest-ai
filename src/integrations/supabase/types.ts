export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_name: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          summary: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          summary: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          summary?: string
        }
        Relationships: []
      }
      booking_addons: {
        Row: {
          addon_id: string | null
          booking_id: string
          created_at: string
          currency: string
          id: string
          line_total: number
          name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          addon_id?: string | null
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          line_total: number
          name: string
          quantity?: number
          unit_price: number
        }
        Update: {
          addon_id?: string | null
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          line_total?: number
          name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "excursion_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_modifications: {
        Row: {
          booking_id: string
          changed_by: string | null
          created_at: string
          field: string
          id: string
          new_value: string | null
          note: string | null
          old_value: string | null
        }
        Insert: {
          booking_id: string
          changed_by?: string | null
          created_at?: string
          field: string
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
        }
        Update: {
          booking_id?: string
          changed_by?: string | null
          created_at?: string
          field?: string
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_modifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cabin_number: string | null
          created_at: string
          currency: string
          excursion_id: string
          expires_at: string | null
          id: string
          lead_passenger_email: string
          lead_passenger_name: string
          lead_passenger_phone: string | null
          notes: string | null
          party_size: number
          port_call_id: string | null
          reference: string
          sailing_id: string | null
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          tour_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cabin_number?: string | null
          created_at?: string
          currency?: string
          excursion_id: string
          expires_at?: string | null
          id?: string
          lead_passenger_email: string
          lead_passenger_name: string
          lead_passenger_phone?: string | null
          notes?: string | null
          party_size?: number
          port_call_id?: string | null
          reference?: string
          sailing_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          tour_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cabin_number?: string | null
          created_at?: string
          currency?: string
          excursion_id?: string
          expires_at?: string | null
          id?: string
          lead_passenger_email?: string
          lead_passenger_name?: string
          lead_passenger_phone?: string | null
          notes?: string | null
          party_size?: number
          port_call_id?: string | null
          reference?: string
          sailing_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          tour_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_excursion_id_fkey"
            columns: ["excursion_id"]
            isOneToOne: false
            referencedRelation: "excursions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_port_call_id_fkey"
            columns: ["port_call_id"]
            isOneToOne: false
            referencedRelation: "sailing_port_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_sailing_id_fkey"
            columns: ["sailing_id"]
            isOneToOne: false
            referencedRelation: "sailings"
            referencedColumns: ["id"]
          },
        ]
      }
      cruise_lines: {
        Row: {
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          attempts: number
          body: string
          booking_id: string | null
          created_at: string
          error: string | null
          id: string
          sent_at: string | null
          status: string
          subject: string
          template: string
          to_email: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          body: string
          booking_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subject: string
          template?: string
          to_email: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          body?: string
          booking_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template?: string
          to_email?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      excursion_addons: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          excursion_id: string
          id: string
          is_active: boolean
          name: string
          per_guest: boolean
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          excursion_id: string
          id?: string
          is_active?: boolean
          name: string
          per_guest?: boolean
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          excursion_id?: string
          id?: string
          is_active?: boolean
          name?: string
          per_guest?: boolean
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "excursion_addons_excursion_id_fkey"
            columns: ["excursion_id"]
            isOneToOne: false
            referencedRelation: "excursions"
            referencedColumns: ["id"]
          },
        ]
      }
      excursions: {
        Row: {
          capacity: number
          category: string | null
          created_at: string
          currency: string
          description: string | null
          difficulty: string | null
          duration_minutes: number
          excludes: string[]
          external_id: string | null
          id: string
          image_url: string | null
          includes: string[]
          is_published: boolean
          meeting_point: string | null
          port_id: string
          price: number
          slug: string
          source: string
          summary: string | null
          title: string
          updated_at: string
          wheelchair_accessible: boolean
        }
        Insert: {
          capacity?: number
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number
          excludes?: string[]
          external_id?: string | null
          id?: string
          image_url?: string | null
          includes?: string[]
          is_published?: boolean
          meeting_point?: string | null
          port_id: string
          price: number
          slug: string
          source?: string
          summary?: string | null
          title: string
          updated_at?: string
          wheelchair_accessible?: boolean
        }
        Update: {
          capacity?: number
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number
          excludes?: string[]
          external_id?: string | null
          id?: string
          image_url?: string | null
          includes?: string[]
          is_published?: boolean
          meeting_point?: string | null
          port_id?: string
          price?: number
          slug?: string
          source?: string
          summary?: string | null
          title?: string
          updated_at?: string
          wheelchair_accessible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "excursions_port_id_fkey"
            columns: ["port_id"]
            isOneToOne: false
            referencedRelation: "ports"
            referencedColumns: ["id"]
          },
        ]
      }
      import_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          port_calls_created: number
          port_calls_updated: number
          sailings_created: number
          sailings_updated: number
          source_id: string | null
          started_at: string
          status: string
          trigger: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          port_calls_created?: number
          port_calls_updated?: number
          sailings_created?: number
          sailings_updated?: number
          source_id?: string | null
          started_at?: string
          status?: string
          trigger?: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          port_calls_created?: number
          port_calls_updated?: number
          sailings_created?: number
          sailings_updated?: number
          source_id?: string | null
          started_at?: string
          status?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "import_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      import_sources: {
        Row: {
          attempts: number
          created_at: string
          cruise_line_slug: string | null
          id: string
          is_active: boolean
          kind: string
          label: string
          last_error: string | null
          last_run_at: string | null
          parser: string
          ship_slug: string | null
          updated_at: string
          url: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          cruise_line_slug?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          label: string
          last_error?: string | null
          last_run_at?: string | null
          parser?: string
          ship_slug?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          attempts?: number
          created_at?: string
          cruise_line_slug?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          label?: string
          last_error?: string | null
          last_run_at?: string | null
          parser?: string
          ship_slug?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          booking_id: string | null
          created_at: string
          href: string | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          booking_id?: string | null
          created_at?: string
          href?: string | null
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          booking_id?: string | null
          created_at?: string
          href?: string | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          provider: string
          provider_payment_intent: string | null
          provider_session_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          provider?: string
          provider_payment_intent?: string | null
          provider_session_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          provider?: string
          provider_payment_intent?: string | null
          provider_session_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      ports: {
        Row: {
          country: string
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          image_url: string | null
          latitude: number | null
          longitude: number | null
          name: string
          region: string | null
          slug: string
          source: string
          updated_at: string
        }
        Insert: {
          country: string
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          region?: string | null
          slug: string
          source?: string
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          region?: string | null
          slug?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cabin_number: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cabin_number?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cabin_number?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          admin_note: string | null
          amount: number | null
          booking_id: string
          created_at: string
          currency: string
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount?: number | null
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number | null
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      sailing_port_calls: {
        Row: {
          arrival_time: string | null
          call_date: string
          created_at: string
          day_number: number
          departure_time: string | null
          id: string
          is_sea_day: boolean
          notes: string | null
          port_id: string | null
          sailing_id: string
          updated_at: string
        }
        Insert: {
          arrival_time?: string | null
          call_date: string
          created_at?: string
          day_number: number
          departure_time?: string | null
          id?: string
          is_sea_day?: boolean
          notes?: string | null
          port_id?: string | null
          sailing_id: string
          updated_at?: string
        }
        Update: {
          arrival_time?: string | null
          call_date?: string
          created_at?: string
          day_number?: number
          departure_time?: string | null
          id?: string
          is_sea_day?: boolean
          notes?: string | null
          port_id?: string | null
          sailing_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sailing_port_calls_port_id_fkey"
            columns: ["port_id"]
            isOneToOne: false
            referencedRelation: "ports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sailing_port_calls_sailing_id_fkey"
            columns: ["sailing_id"]
            isOneToOne: false
            referencedRelation: "sailings"
            referencedColumns: ["id"]
          },
        ]
      }
      sailings: {
        Row: {
          arrival_date: string
          arrival_port_id: string | null
          created_at: string
          departure_date: string
          departure_port_id: string | null
          description: string | null
          external_id: string | null
          hero_image_url: string | null
          id: string
          is_published: boolean
          name: string
          nights: number
          region: string
          ship_id: string
          slug: string
          source: string
          starting_price: number | null
          updated_at: string
        }
        Insert: {
          arrival_date: string
          arrival_port_id?: string | null
          created_at?: string
          departure_date: string
          departure_port_id?: string | null
          description?: string | null
          external_id?: string | null
          hero_image_url?: string | null
          id?: string
          is_published?: boolean
          name: string
          nights: number
          region: string
          ship_id: string
          slug: string
          source?: string
          starting_price?: number | null
          updated_at?: string
        }
        Update: {
          arrival_date?: string
          arrival_port_id?: string | null
          created_at?: string
          departure_date?: string
          departure_port_id?: string | null
          description?: string | null
          external_id?: string | null
          hero_image_url?: string | null
          id?: string
          is_published?: boolean
          name?: string
          nights?: number
          region?: string
          ship_id?: string
          slug?: string
          source?: string
          starting_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sailings_arrival_port_id_fkey"
            columns: ["arrival_port_id"]
            isOneToOne: false
            referencedRelation: "ports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sailings_departure_port_id_fkey"
            columns: ["departure_port_id"]
            isOneToOne: false
            referencedRelation: "ports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sailings_ship_id_fkey"
            columns: ["ship_id"]
            isOneToOne: false
            referencedRelation: "ships"
            referencedColumns: ["id"]
          },
        ]
      }
      ships: {
        Row: {
          capacity: number | null
          created_at: string
          cruise_line_id: string
          description: string | null
          external_id: string | null
          id: string
          image_url: string | null
          name: string
          slug: string
          source: string
          updated_at: string
          year_built: number | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          cruise_line_id: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug: string
          source?: string
          updated_at?: string
          year_built?: number | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          cruise_line_id?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          source?: string
          updated_at?: string
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ships_cruise_line_id_fkey"
            columns: ["cruise_line_id"]
            isOneToOne: false
            referencedRelation: "cruise_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      write_audit_log: {
        Args: {
          _action: string
          _entity_id: string
          _entity_type: string
          _metadata?: Json
          _summary: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "passenger"
      booking_status: "reserved" | "confirmed" | "cancelled" | "refunded"
      payment_status: "pending" | "paid" | "failed" | "refunded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "passenger"],
      booking_status: ["reserved", "confirmed", "cancelled", "refunded"],
      payment_status: ["pending", "paid", "failed", "refunded"],
    },
  },
} as const
