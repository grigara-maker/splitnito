export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          invite_code?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          invite_code?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          iban: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          company_id: string;
          name: string;
          iban?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          iban?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          status: "active" | "closed";
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          status?: "active" | "closed";
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          status?: "active" | "closed";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      receipts: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          vendor: string;
          total_amount: number;
          items: Json | null;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          vendor: string;
          total_amount: number;
          items?: Json | null;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          vendor?: string;
          total_amount?: number;
          items?: Json | null;
          image_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "receipts_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      settlements: {
        Row: {
          id: string;
          event_id: string;
          summary_data: Json;
          closed_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          summary_data: Json;
          closed_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          summary_data?: Json;
          closed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlements_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: true;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_company_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_company_by_invite: {
        Args: { code: string };
        Returns: { id: string; name: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type Event = Database["public"]["Tables"]["events"]["Row"];
export type Receipt = Database["public"]["Tables"]["receipts"]["Row"];
export type Settlement = Database["public"]["Tables"]["settlements"]["Row"];

export type ReceiptItem = {
  name: string;
  amount?: number;
};
