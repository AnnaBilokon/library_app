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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      author_countries: {
        Row: {
          author: string
          countries: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          author: string
          countries: string[]
          updated_at?: string
          user_id?: string
        }
        Update: {
          author?: string
          countries?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      book_battle_picks: {
        Row: {
          book_id: string
          bracket: string
          slot: string
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          book_id: string
          bracket: string
          slot: string
          updated_at?: string
          user_id?: string
          year: number
        }
        Update: {
          book_id?: string
          bracket?: string
          slot?: string
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "book_battle_picks_book_id_user_id_fkey"
            columns: ["book_id", "user_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      books: {
        Row: {
          acquired_at: string | null
          authors: string[]
          cover_path: string | null
          cover_url: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          favorite: boolean
          for_sale: boolean
          forgotten: boolean
          format: Database["public"]["Enums"]["book_format"] | null
          genres: string[]
          id: string
          isbn: string | null
          language: string | null
          notes: string | null
          notion_page_id: string | null
          original_language: string | null
          owned: boolean
          pages: number | null
          priority: Database["public"]["Enums"]["wish_priority"] | null
          published_year: number | null
          publisher: string | null
          purchase_price: number | null
          queue_position: number | null
          rating: number | null
          release_date: string | null
          review: string | null
          sale_original_currency: string | null
          sale_original_price: number | null
          sale_price: number | null
          series: string | null
          series_index: number | null
          sold_at: string | null
          status: Database["public"]["Enums"]["book_status"]
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          wanted: boolean
          where_to_buy: string | null
          wish_price: number | null
          wishlist_reason: string | null
        }
        Insert: {
          acquired_at?: string | null
          authors?: string[]
          cover_path?: string | null
          cover_url?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          favorite?: boolean
          for_sale?: boolean
          forgotten?: boolean
          format?: Database["public"]["Enums"]["book_format"] | null
          genres?: string[]
          id?: string
          isbn?: string | null
          language?: string | null
          notes?: string | null
          notion_page_id?: string | null
          original_language?: string | null
          owned?: boolean
          pages?: number | null
          priority?: Database["public"]["Enums"]["wish_priority"] | null
          published_year?: number | null
          publisher?: string | null
          purchase_price?: number | null
          queue_position?: number | null
          rating?: number | null
          release_date?: string | null
          review?: string | null
          sale_original_currency?: string | null
          sale_original_price?: number | null
          sale_price?: number | null
          series?: string | null
          series_index?: number | null
          sold_at?: string | null
          status?: Database["public"]["Enums"]["book_status"]
          tags?: string[]
          title: string
          updated_at?: string
          user_id?: string
          wanted?: boolean
          where_to_buy?: string | null
          wish_price?: number | null
          wishlist_reason?: string | null
        }
        Update: {
          acquired_at?: string | null
          authors?: string[]
          cover_path?: string | null
          cover_url?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          favorite?: boolean
          for_sale?: boolean
          forgotten?: boolean
          format?: Database["public"]["Enums"]["book_format"] | null
          genres?: string[]
          id?: string
          isbn?: string | null
          language?: string | null
          notes?: string | null
          notion_page_id?: string | null
          original_language?: string | null
          owned?: boolean
          pages?: number | null
          priority?: Database["public"]["Enums"]["wish_priority"] | null
          published_year?: number | null
          publisher?: string | null
          purchase_price?: number | null
          queue_position?: number | null
          rating?: number | null
          release_date?: string | null
          review?: string | null
          sale_original_currency?: string | null
          sale_original_price?: number | null
          sale_price?: number | null
          series?: string | null
          series_index?: number | null
          sold_at?: string | null
          status?: Database["public"]["Enums"]["book_status"]
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          wanted?: boolean
          where_to_buy?: string | null
          wish_price?: number | null
          wishlist_reason?: string | null
        }
        Relationships: []
      }
      reading_goals: {
        Row: {
          goal: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          goal: number
          updated_at?: string
          user_id?: string
          year: number
        }
        Update: {
          goal?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      readings: {
        Row: {
          book_id: string
          created_at: string
          finished_at: string | null
          id: string
          outcome: Database["public"]["Enums"]["reading_outcome"] | null
          progress_page: number | null
          progress_percent: number | null
          progress_updated_at: string | null
          rating: number | null
          started_at: string | null
          stop_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          finished_at?: string | null
          id?: string
          outcome?: Database["public"]["Enums"]["reading_outcome"] | null
          progress_page?: number | null
          progress_percent?: number | null
          progress_updated_at?: string | null
          rating?: number | null
          started_at?: string | null
          stop_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          book_id?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          outcome?: Database["public"]["Enums"]["reading_outcome"] | null
          progress_page?: number | null
          progress_percent?: number | null
          progress_updated_at?: string | null
          rating?: number | null
          started_at?: string | null
          stop_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "readings_book_id_user_id_fkey"
            columns: ["book_id", "user_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      user_settings: {
        Row: {
          countries_goal: number | null
          hide_for_sale: boolean
          updated_at: string
          user_id: string
          yearly_goal: number
        }
        Insert: {
          countries_goal?: number | null
          hide_for_sale?: boolean
          updated_at?: string
          user_id?: string
          yearly_goal?: number
        }
        Update: {
          countries_goal?: number | null
          hide_for_sale?: boolean
          updated_at?: string
          user_id?: string
          yearly_goal?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reorder_queue: { Args: { ids: string[] }; Returns: undefined }
    }
    Enums: {
      book_format: "paper" | "ebook" | "audio"
      book_status: "to-read" | "reading" | "paused" | "finished" | "abandoned"
      reading_outcome: "finished" | "abandoned"
      wish_priority: "low" | "medium" | "high"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      book_format: ["paper", "ebook", "audio"],
      book_status: ["to-read", "reading", "paused", "finished", "abandoned"],
      reading_outcome: ["finished", "abandoned"],
      wish_priority: ["low", "medium", "high"],
    },
  },
} as const
