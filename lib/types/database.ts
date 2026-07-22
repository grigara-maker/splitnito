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
          role: "company" | "member";
          created_at: string;
        };
        Insert: {
          id: string;
          company_id: string;
          name: string;
          iban?: string | null;
          role?: "company" | "member";
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          iban?: string | null;
          role?: "company" | "member";
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
          user_id: string | null;
          uploader_name: string | null;
          vendor: string;
          total_amount: number;
          items: Json | null;
          image_url: string | null;
          purchased_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id?: string | null;
          uploader_name?: string | null;
          vendor: string;
          total_amount: number;
          items?: Json | null;
          image_url?: string | null;
          purchased_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string | null;
          uploader_name?: string | null;
          vendor?: string;
          total_amount?: number;
          items?: Json | null;
          image_url?: string | null;
          purchased_at?: string | null;
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
      complete_user_setup: {
        Args: {
          p_name: string;
          p_iban?: string | null;
          p_invite_code?: string | null;
          p_company_name?: string | null;
          p_role?: string | null;
        };
        Returns: string;
      };
      is_company_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      remove_company_member: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      delete_own_account: {
        Args: Record<string, never>;
        Returns: string;
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
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

/** Normalize legacy `{ name, amount }` and partial OCR payloads. */
export function normalizeReceiptItem(raw: unknown): ReceiptItem | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const name = String(obj.name ?? "").trim();
  if (!name) return null;

  const quantityRaw = Number(obj.quantity ?? obj.qty ?? 1);
  const quantity =
    Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;

  const unitFromField = Number(obj.unitPrice ?? obj.unit_price);
  const totalFromField = Number(
    obj.totalPrice ?? obj.total_amount ?? obj.amount
  );

  let unitPrice = Number.isFinite(unitFromField) ? unitFromField : NaN;
  let totalPrice = Number.isFinite(totalFromField) ? totalFromField : NaN;

  if (!Number.isFinite(unitPrice) && Number.isFinite(totalPrice)) {
    unitPrice = totalPrice / quantity;
  }
  if (!Number.isFinite(totalPrice) && Number.isFinite(unitPrice)) {
    totalPrice = unitPrice * quantity;
  }
  if (!Number.isFinite(unitPrice)) unitPrice = 0;
  if (!Number.isFinite(totalPrice)) totalPrice = unitPrice * quantity;

  return {
    name,
    quantity: Math.round(quantity * 1000) / 1000,
    unitPrice: Math.round(unitPrice * 100) / 100,
    totalPrice: Math.round(totalPrice * 100) / 100,
  };
}

export function normalizeReceiptItems(raw: unknown): ReceiptItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeReceiptItem)
    .filter((item): item is ReceiptItem => item != null);
}
