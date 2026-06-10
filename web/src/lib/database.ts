export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          role: "user" | "admin";
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      listings: {
        Row: {
          id: string;
          name: string;
          address: string;
          accommodation_type: string;
          accommodation_type_other: string | null;
          description: string | null;
          is_fenced: boolean | null;
          floors_label: string | null;
          floor_count: number | null;
          rooms_available: number | null;
          exclusivity: string | null;
          occupancy_label: string | null;
          occupancy_min: number | null;
          occupancy_max: number | null;
          monthly_rental_label: string;
          monthly_rent_min: number | null;
          monthly_rent_max: number | null;
          utilities_included: boolean | null;
          bills_included: string | null;
          bills_not_included: string | null;
          has_additional_appliance_fee: boolean | null;
          appliance_fee_label: string | null;
          appliance_fee_amount: number | null;
          has_laundry_area: boolean | null;
          has_drying_area: boolean | null;
          has_comfort_room_each_room: boolean | null;
          comfort_rooms_separate_from_bathrooms: boolean | null;
          comfort_room_count: number | null;
          bathroom_count: number | null;
          has_bathroom_each_floor: boolean | null;
          has_charging_slots_each_room: boolean | null;
          charging_station_count_label: string | null;
          charging_station_count: number | null;
          has_electric_fans: boolean | null;
          has_aircon: boolean | null;
          aircon_room_count: number | null;
          has_common_kitchen: boolean | null;
          has_refrigerator: boolean | null;
          has_television: boolean | null;
          other_amenities: string | null;
          has_study_area: boolean | null;
          has_wifi: boolean | null;
          cellular_signals_raw: string | null;
          cellular_signals: string[];
          has_parking_area: boolean | null;
          pets_allowed: boolean | null;
          curfew: string | null;
          visitors_allowed: boolean | null;
          visitor_time: string | null;
          smoking_allowed: boolean | null;
          has_security_cctv: boolean | null;
          has_emergency_exit: boolean | null;
          has_fire_alarm: boolean | null;
          has_emergency_lights: boolean | null;
          has_fire_extinguisher: boolean | null;
          has_smoke_detector: boolean | null;
          has_sprinkler: boolean | null;
          contact_person: string | null;
          contact_number: string | null;
          other_contact_information: string | null;
          location_lat: number | null;
          location_lng: number | null;
          raw_import_data: Json;
          source_row_number: number | null;
          status: "active" | "deleted";
          created_by: string | null;
          updated_by: string | null;
          deleted_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["listings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["listings"]["Row"]>;
      };
      listing_photos: {
        Row: {
          id: string;
          listing_id: string;
          storage_bucket: string;
          storage_path: string;
          caption: string | null;
          alt_text: string | null;
          sort_order: number;
          is_cover: boolean;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      deleted_listings: {
        Row: {
          id: string;
          original_listing_id: string;
          listing_name: string;
          deleted_by: string | null;
          delete_reason: string | null;
          listing_snapshot: Json;
          deleted_at: string;
        };
      };
      saved_listings: {
        Row: {
          id: string;
          user_id: string;
          accommodation_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          accommodation_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["saved_listings"]["Row"]>;
      };
    };
    Functions: {
      archive_listing: {
        Args: { p_listing_id: string; p_delete_reason?: string | null };
        Returns: string;
      };
      restore_listing: {
        Args: { p_listing_id: string };
        Returns: void;
      };
    };
  };
};
