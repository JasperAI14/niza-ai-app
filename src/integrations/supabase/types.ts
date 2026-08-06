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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: boolean
          notes: string | null
          paystack_plan_amount_kobo: number
          paystack_plan_code: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          notes?: string | null
          paystack_plan_amount_kobo?: number
          paystack_plan_code?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          notes?: string | null
          paystack_plan_amount_kobo?: number
          paystack_plan_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      error_reports: {
        Row: {
          app_version: string | null
          created_at: string
          details: Json
          device: string | null
          error_type: string
          feature: string | null
          id: string
          message: string
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          details?: Json
          device?: string | null
          error_type?: string
          feature?: string | null
          id?: string
          message?: string
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          details?: Json
          device?: string | null
          error_type?: string
          feature?: string | null
          id?: string
          message?: string
          user_id?: string | null
        }
        Relationships: []
      }
      message_feedback: {
        Row: {
          created_at: string
          id: string
          message_id: string
          note: string | null
          rating: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          note?: string | null
          rating: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          note?: string | null
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          audio_url: string | null
          content: string
          created_at: string
          edited: boolean
          edited_at: string | null
          id: string
          image_url: string | null
          media_model: string | null
          media_prompt: string | null
          role: string
          thread_id: string
          user_id: string
          watermarked: boolean
        }
        Insert: {
          audio_url?: string | null
          content?: string
          created_at?: string
          edited?: boolean
          edited_at?: string | null
          id?: string
          image_url?: string | null
          media_model?: string | null
          media_prompt?: string | null
          role: string
          thread_id: string
          user_id: string
          watermarked?: boolean
        }
        Update: {
          audio_url?: string | null
          content?: string
          created_at?: string
          edited?: boolean
          edited_at?: string | null
          id?: string
          image_url?: string | null
          media_model?: string | null
          media_prompt?: string | null
          role?: string
          thread_id?: string
          user_id?: string
          watermarked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      music_history: {
        Row: {
          audio_path: string
          created_at: string
          duration_seconds: number | null
          id: string
          prompt: string
          title: string
          user_id: string
        }
        Insert: {
          audio_path: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          prompt?: string
          title?: string
          user_id: string
        }
        Update: {
          audio_path?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          prompt?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          audience: string
          body: string
          created_at: string
          id: string
          kind: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          audience?: string
          body?: string
          created_at?: string
          id?: string
          kind?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          id?: string
          kind?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      nova_hub_config: {
        Row: {
          app_id: string | null
          app_secret: string | null
          connected_at: string | null
          id: boolean
          last_error: string | null
          server_url: string | null
          updated_at: string
          updated_by: string | null
          webhook_secret: string | null
        }
        Insert: {
          app_id?: string | null
          app_secret?: string | null
          connected_at?: string | null
          id?: boolean
          last_error?: string | null
          server_url?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Update: {
          app_id?: string | null
          app_secret?: string | null
          connected_at?: string | null
          id?: boolean
          last_error?: string | null
          server_url?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          amount_kobo: number | null
          created_at: string
          event_type: string
          id: string
          raw: Json | null
          reference: string | null
          user_id: string | null
        }
        Insert: {
          amount_kobo?: number | null
          created_at?: string
          event_type: string
          id?: string
          raw?: Json | null
          reference?: string | null
          user_id?: string | null
        }
        Update: {
          amount_kobo?: number | null
          created_at?: string
          event_type?: string
          id?: string
          raw?: Json | null
          reference?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pinned_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          language: string
          paystack_customer_code: string | null
          paystack_subscription_code: string | null
          plan: string
          plan_expires_at: string | null
          plan_status: string
          promo_used: boolean
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          language?: string
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
          plan?: string
          plan_expires_at?: string | null
          plan_status?: string
          promo_used?: boolean
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          language?: string
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
          plan?: string
          plan_expires_at?: string | null
          plan_status?: string
          promo_used?: boolean
          username?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          admin_reply: string | null
          ai_reply: string | null
          archived: boolean
          body: string
          created_at: string
          escalated: boolean
          id: string
          rating: number
          screenshot_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          ai_reply?: string | null
          archived?: boolean
          body?: string
          created_at?: string
          escalated?: boolean
          id?: string
          rating: number
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          ai_reply?: string | null
          archived?: boolean
          body?: string
          created_at?: string
          escalated?: boolean
          id?: string
          rating?: number
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          admin_reply: string | null
          archived: boolean
          created_at: string
          diagnostics: Json
          id: string
          message: string
          screenshot_url: string | null
          source: string
          status: string
          subject: string
          thread_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_reply?: string | null
          archived?: boolean
          created_at?: string
          diagnostics?: Json
          id?: string
          message: string
          screenshot_url?: string | null
          source?: string
          status?: string
          subject: string
          thread_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_reply?: string | null
          archived?: boolean
          created_at?: string
          diagnostics?: Json
          id?: string
          message?: string
          screenshot_url?: string | null
          source?: string
          status?: string
          subject?: string
          thread_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage: {
        Row: {
          image_count: number
          image_window_start: string
          text_count: number
          text_window_start: string
          user_id: string
        }
        Insert: {
          image_count?: number
          image_window_start?: string
          text_count?: number
          text_window_start?: string
          user_id: string
        }
        Update: {
          image_count?: number
          image_window_start?: string
          text_count?: number
          text_window_start?: string
          user_id?: string
        }
        Relationships: []
      }
      user_memory: {
        Row: {
          created_at: string
          id: string
          key: string
          kind: string
          source_message_id: string | null
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          kind?: string
          source_message_id?: string | null
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          kind?: string
          source_message_id?: string | null
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
