export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          ip_address: string | null
          target_id: string | null
          target_table: string
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      ai_generation_requests: {
        Row: {
          agent_type: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          listing_id: string | null
          model: string | null
          prompt_version: string | null
          provider: string
          request_tokens: number | null
          response_tokens: number | null
          status: string
          suggestion_id: string | null
        }
        Insert: {
          agent_type: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          listing_id?: string | null
          model?: string | null
          prompt_version?: string | null
          provider?: string
          request_tokens?: number | null
          response_tokens?: number | null
          status?: string
          suggestion_id?: string | null
        }
        Update: {
          agent_type?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          listing_id?: string | null
          model?: string | null
          prompt_version?: string | null
          provider?: string
          request_tokens?: number | null
          response_tokens?: number | null
          status?: string
          suggestion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generation_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generation_requests_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "ai_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_suggestions: {
        Row: {
          agent_type: string
          applied_at: string | null
          created_at: string
          id: string
          listing_id: string
          metadata: Json
          prompt_version: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggestion_text: string
          suggestion_type: string
          updated_at: string
        }
        Insert: {
          agent_type: string
          applied_at?: string | null
          created_at?: string
          id?: string
          listing_id: string
          metadata?: Json
          prompt_version?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggestion_text: string
          suggestion_type: string
          updated_at?: string
        }
        Update: {
          agent_type?: string
          applied_at?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          metadata?: Json
          prompt_version?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggestion_text?: string
          suggestion_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_name: string
          id: string
          ip_address: string | null
          properties: Json
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_name: string
          id?: string
          ip_address?: string | null
          properties?: Json
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_name?: string
          id?: string
          ip_address?: string | null
          properties?: Json
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      launch_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
      analytics_job_log: {
        Row: {
          created_at: string
          duration_ms: number | null
          errors: number
          id: string
          listings_processed: number
          notes: string | null
          run_date: string
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          errors?: number
          id?: string
          listings_processed?: number
          notes?: string | null
          run_date: string
          status: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          errors?: number
          id?: string
          listings_processed?: number
          notes?: string | null
          run_date?: string
          status?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          latitude: number
          launch_phase: string
          longitude: number
          metro_area: string | null
          name: string
          population: number | null
          slug: string
          state_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          latitude: number
          launch_phase?: string
          longitude: number
          metro_area?: string | null
          name: string
          population?: number | null
          slug: string
          state_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number
          launch_phase?: string
          longitude?: number
          metro_area?: string | null
          name?: string
          population?: number | null
          slug?: string
          state_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          claimant_user_id: string | null
          created_at: string
          id: string
          listing_id: string
          notes: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role_at_business: string | null
          status: string
          submitted_at: string
          updated_at: string
          verification_doc_paths: string[] | null
          verification_email: string | null
          verification_phone: string | null
        }
        Insert: {
          claimant_user_id?: string | null
          created_at?: string
          id?: string
          listing_id: string
          notes?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_at_business?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          verification_doc_paths?: string[] | null
          verification_email?: string | null
          verification_phone?: string | null
        }
        Update: {
          claimant_user_id?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          notes?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_at_business?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          verification_doc_paths?: string[] | null
          verification_email?: string | null
          verification_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          blurb: string | null
          collection_id: string
          created_at: string
          display_order: number
          headline: string | null
          id: string
          listing_id: string
        }
        Insert: {
          blurb?: string | null
          collection_id: string
          created_at?: string
          display_order?: number
          headline?: string | null
          id?: string
          listing_id: string
        }
        Update: {
          blurb?: string | null
          collection_id?: string
          created_at?: string
          display_order?: number
          headline?: string | null
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_sections: {
        Row: {
          body: string | null
          collection_id: string
          created_at: string
          display_order: number
          heading: string
          id: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          collection_id: string
          created_at?: string
          display_order?: number
          heading: string
          id?: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          collection_id?: string
          created_at?: string
          display_order?: number
          heading?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_sections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          body: string | null
          cover_image_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          slug: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          slug: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          slug?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      editorial_articles: {
        Row: {
          author_name: string
          body: string | null
          cover_image_path: string | null
          created_at: string
          created_by: string | null
          id: string
          meta_description: string | null
          published_at: string | null
          slug: string
          status: string
          subtitle: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string
          body?: string | null
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meta_description?: string | null
          published_at?: string | null
          slug: string
          status?: string
          subtitle?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          body?: string | null
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meta_description?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          subtitle?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      entity_analytics_daily: {
        Row: {
          created_at: string
          cta_clicks: number
          id: string
          listing_id: string
          page_views: number
          saves: number
          search_impressions: number
          shares: number
          snapshot_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_clicks?: number
          id?: string
          listing_id: string
          page_views?: number
          saves?: number
          search_impressions?: number
          shares?: number
          snapshot_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_clicks?: number
          id?: string
          listing_id?: string
          page_views?: number
          saves?: number
          search_impressions?: number
          shares?: number
          snapshot_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_analytics_daily_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_edges: {
        Row: {
          id: string
          source_node_id: string
          target_node_id: string
          total_amount_cents: number
          transaction_count: number
        }
        Insert: {
          id?: string
          source_node_id: string
          target_node_id: string
          total_amount_cents?: number
          transaction_count?: number
        }
        Update: {
          id?: string
          source_node_id?: string
          target_node_id?: string
          total_amount_cents?: number
          transaction_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "flow_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_nodes: {
        Row: {
          entity_id: string
          id: string
          last_transaction_at: string | null
          node_type: string
          total_amount_cents: number
          transaction_count: number
        }
        Insert: {
          entity_id: string
          id?: string
          last_transaction_at?: string | null
          node_type: string
          total_amount_cents?: number
          transaction_count?: number
        }
        Update: {
          entity_id?: string
          id?: string
          last_transaction_at?: string | null
          node_type?: string
          total_amount_cents?: number
          transaction_count?: number
        }
        Relationships: []
      }
      guide_sections: {
        Row: {
          body: string | null
          created_at: string
          display_order: number
          guide_id: string
          heading: string
          id: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          display_order?: number
          guide_id: string
          heading: string
          id?: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          display_order?: number
          guide_id?: string
          heading?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_sections_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guides: {
        Row: {
          city: string | null
          cover_image_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          meta_description: string | null
          published_at: string | null
          slug: string
          status: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          meta_description?: string | null
          published_at?: string | null
          slug: string
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          meta_description?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      listing_details_business: {
        Row: {
          accepts_reservations: boolean | null
          address_line_1: string | null
          address_line_2: string | null
          city_text: string | null
          created_at: string
          cta_label_override: string | null
          cta_type: string
          cta_url: string | null
          description: string | null
          email: string | null
          founded_year: number | null
          hours: Json | null
          hours_notes: string | null
          lat: number | null
          listing_id: string
          lng: number | null
          phone: string | null
          price_range: string | null
          ships_nationwide: boolean
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_tiktok: string | null
          social_twitter: string | null
          social_youtube: string | null
          state: string | null
          updated_at: string
          website_url: string | null
          zip: string | null
        }
        Insert: {
          accepts_reservations?: boolean | null
          address_line_1?: string | null
          address_line_2?: string | null
          city_text?: string | null
          created_at?: string
          cta_label_override?: string | null
          cta_type?: string
          cta_url?: string | null
          description?: string | null
          email?: string | null
          founded_year?: number | null
          hours?: Json | null
          hours_notes?: string | null
          lat?: number | null
          listing_id: string
          lng?: number | null
          phone?: string | null
          price_range?: string | null
          ships_nationwide?: boolean
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          social_youtube?: string | null
          state?: string | null
          updated_at?: string
          website_url?: string | null
          zip?: string | null
        }
        Update: {
          accepts_reservations?: boolean | null
          address_line_1?: string | null
          address_line_2?: string | null
          city_text?: string | null
          created_at?: string
          cta_label_override?: string | null
          cta_type?: string
          cta_url?: string | null
          description?: string | null
          email?: string | null
          founded_year?: number | null
          hours?: Json | null
          hours_notes?: string | null
          lat?: number | null
          listing_id?: string
          lng?: number | null
          phone?: string | null
          price_range?: string | null
          ships_nationwide?: boolean
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          social_youtube?: string | null
          state?: string | null
          updated_at?: string
          website_url?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_details_business_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_hours: {
        Row: {
          closes_at: string
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean
          listing_id: string
          opens_at: string
          updated_at: string
        }
        Insert: {
          closes_at: string
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          listing_id: string
          opens_at: string
          updated_at?: string
        }
        Update: {
          closes_at?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          listing_id?: string
          opens_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_hours_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_links: {
        Row: {
          created_at: string
          display_order: number
          id: string
          label: string | null
          link_type: string
          listing_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          label?: string | null
          link_type: string
          listing_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          label?: string | null
          link_type?: string
          listing_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_links_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          admin_notes: string | null
          auto_archive_at: string | null
          auto_expire_at: string | null
          avg_rating: number | null
          canonical_url: string | null
          category_id: string
          certification_auto_granted_at: string | null
          city_id: string | null
          claim_id: string | null
          cover_image_path: string | null
          created_at: string
          deleted_at: string | null
          entity_type: string
          flag_status: string
          id: string
          is_featured: boolean
          is_sponsored: boolean
          is_vendor: boolean
          json_ld_type: string | null
          last_admin_updated_at: string | null
          last_edited_by_owner_at: string | null
          location_type: string
          logo_path: string | null
          meta_description: string | null
          meta_title: string | null
          moderation_notes: string | null
          name: string
          noindex: boolean
          og_image_path: string | null
          owner_user_id: string | null
          ownership_attested: boolean
          ownership_attested_at: string | null
          published_at: string | null
          review_count: number
          save_count: number
          search_vector: unknown
          service_area_description: string | null
          ships_nationwide: boolean
          sitemap_include: boolean
          slug: string
          source: string
          sponsored_expires_at: string | null
          sponsored_placement_type: string | null
          stale_flagged_at: string | null
          status: string
          subcategory_ids: string[] | null
          submitted_by: string | null
          tagline: string | null
          tier: string
          trust_tier: string
          updated_at: string
          updated_by: string | null
          verification_docs: string[] | null
          verification_notes: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
          view_count: number
        }
        Insert: {
          admin_notes?: string | null
          auto_archive_at?: string | null
          auto_expire_at?: string | null
          avg_rating?: number | null
          canonical_url?: string | null
          category_id: string
          certification_auto_granted_at?: string | null
          city_id?: string | null
          claim_id?: string | null
          cover_image_path?: string | null
          created_at?: string
          deleted_at?: string | null
          entity_type: string
          flag_status?: string
          id?: string
          is_featured?: boolean
          is_sponsored?: boolean
          is_vendor?: boolean
          json_ld_type?: string | null
          last_admin_updated_at?: string | null
          last_edited_by_owner_at?: string | null
          location_type?: string
          logo_path?: string | null
          meta_description?: string | null
          meta_title?: string | null
          moderation_notes?: string | null
          name: string
          noindex?: boolean
          og_image_path?: string | null
          owner_user_id?: string | null
          ownership_attested?: boolean
          ownership_attested_at?: string | null
          published_at?: string | null
          review_count?: number
          save_count?: number
          search_vector?: unknown
          service_area_description?: string | null
          ships_nationwide?: boolean
          sitemap_include?: boolean
          slug: string
          source?: string
          sponsored_expires_at?: string | null
          sponsored_placement_type?: string | null
          stale_flagged_at?: string | null
          status?: string
          subcategory_ids?: string[] | null
          submitted_by?: string | null
          tagline?: string | null
          tier?: string
          trust_tier?: string
          updated_at?: string
          updated_by?: string | null
          verification_docs?: string[] | null
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          view_count?: number
        }
        Update: {
          admin_notes?: string | null
          auto_archive_at?: string | null
          auto_expire_at?: string | null
          avg_rating?: number | null
          canonical_url?: string | null
          category_id?: string
          certification_auto_granted_at?: string | null
          city_id?: string | null
          claim_id?: string | null
          cover_image_path?: string | null
          created_at?: string
          deleted_at?: string | null
          entity_type?: string
          flag_status?: string
          id?: string
          is_featured?: boolean
          is_sponsored?: boolean
          is_vendor?: boolean
          json_ld_type?: string | null
          last_admin_updated_at?: string | null
          last_edited_by_owner_at?: string | null
          location_type?: string
          logo_path?: string | null
          meta_description?: string | null
          meta_title?: string | null
          moderation_notes?: string | null
          name?: string
          noindex?: boolean
          og_image_path?: string | null
          owner_user_id?: string | null
          ownership_attested?: boolean
          ownership_attested_at?: string | null
          published_at?: string | null
          review_count?: number
          save_count?: number
          search_vector?: unknown
          service_area_description?: string | null
          ships_nationwide?: boolean
          sitemap_include?: boolean
          slug?: string
          source?: string
          sponsored_expires_at?: string | null
          sponsored_placement_type?: string | null
          stale_flagged_at?: string | null
          status?: string
          subcategory_ids?: string[] | null
          submitted_by?: string | null
          tagline?: string | null
          tier?: string
          trust_tier?: string
          updated_at?: string
          updated_by?: string | null
          verification_docs?: string[] | null
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_products: {
        Row: {
          category_id: string | null
          compare_at_price_cents: number | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          external_purchase_url: string | null
          global_slug: string
          id: string
          listing_id: string
          name: string
          price_cents: number | null
          price_display_text: string | null
          return_policy_note: string | null
          shipping_options: string
          slug: string
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          compare_at_price_cents?: number | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_purchase_url?: string | null
          global_slug: string
          id?: string
          listing_id: string
          name: string
          price_cents?: number | null
          price_display_text?: string | null
          return_policy_note?: string | null
          shipping_options?: string
          slug: string
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          compare_at_price_cents?: number | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_purchase_url?: string | null
          global_slug?: string
          id?: string
          listing_id?: string
          name?: string
          price_cents?: number | null
          price_display_text?: string | null
          return_policy_note?: string | null
          shipping_options?: string
          slug?: string
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_products_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_services: {
        Row: {
          booking_url: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          delivery_mode: string
          description: string | null
          duration_text: string | null
          global_slug: string
          id: string
          listing_id: string
          name: string
          package_options: Json | null
          price_display_text: string | null
          slug: string
          starting_price_cents: number | null
          status: string
          updated_at: string
        }
        Insert: {
          booking_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          delivery_mode?: string
          description?: string | null
          duration_text?: string | null
          global_slug: string
          id?: string
          listing_id: string
          name: string
          package_options?: Json | null
          price_display_text?: string | null
          slug: string
          starting_price_cents?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          booking_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          delivery_mode?: string
          description?: string | null
          duration_text?: string | null
          global_slug?: string
          id?: string
          listing_id?: string
          name?: string
          package_options?: Json | null
          price_display_text?: string | null
          slug?: string
          starting_price_cents?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_services_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_services_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      media_attachments: {
        Row: {
          alt_text: string | null
          created_at: string
          display_order: number
          entity_id: string
          entity_type: string
          file_path: string
          file_size_bytes: number
          file_type: string
          height: number | null
          id: string
          is_approved: boolean
          is_portfolio_primary: boolean
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          entity_id: string
          entity_type: string
          file_path: string
          file_size_bytes: number
          file_type: string
          height?: number | null
          id?: string
          is_approved?: boolean
          is_portfolio_primary?: boolean
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          entity_id?: string
          entity_type?: string
          file_path?: string
          file_size_bytes?: number
          file_type?: string
          height?: number | null
          id?: string
          is_approved?: boolean
          is_portfolio_primary?: boolean
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: []
      }
      moderation_queue: {
        Row: {
          assigned_to: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          priority: number
          queue_type: string
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          priority?: number
          queue_type: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          priority?: number
          queue_type?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          display_order: number
          features: Json
          id: string
          is_active: boolean
          name: string
          plan_key: string | null
          price_monthly: number
          price_yearly: number
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          plan_key?: string | null
          price_monthly?: number
          price_yearly?: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          plan_key?: string | null
          price_monthly?: number
          price_yearly?: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city_id: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city_id?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_uploads: {
        Row: {
          aggregate_opt_out: boolean
          amount_cents: number
          client_idempotency_key: string
          created_at: string
          file_path: string | null
          id: string
          listing_id: string | null
          notes: string | null
          purchase_date: string
          raw_business_name: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aggregate_opt_out?: boolean
          amount_cents: number
          client_idempotency_key: string
          created_at?: string
          file_path?: string | null
          id?: string
          listing_id?: string | null
          notes?: string | null
          purchase_date: string
          raw_business_name?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aggregate_opt_out?: boolean
          amount_cents?: number
          client_idempotency_key?: string
          created_at?: string
          file_path?: string | null
          id?: string
          listing_id?: string | null
          notes?: string | null
          purchase_date?: string
          raw_business_name?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_uploads_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_verified_purchase: boolean
          listing_id: string
          owner_responded_at: string | null
          owner_response: string | null
          published_at: string | null
          rating: number
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_user_id: string | null
          status: string
          title: string | null
          updated_at: string
          visit_date: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_verified_purchase?: boolean
          listing_id: string
          owner_responded_at?: string | null
          owner_response?: string | null
          published_at?: string | null
          rating: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_user_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          visit_date?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_verified_purchase?: boolean
          listing_id?: string
          owner_responded_at?: string | null
          owner_response?: string | null
          published_at?: string | null
          rating?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_user_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      search_events: {
        Row: {
          city_id: string | null
          clicked_listing_id: string | null
          clicked_result_position: number | null
          created_at: string
          filters: Json
          id: string
          query: string
          result_count: number
          user_id: string | null
        }
        Insert: {
          city_id?: string | null
          clicked_listing_id?: string | null
          clicked_result_position?: number | null
          created_at?: string
          filters?: Json
          id?: string
          query: string
          result_count: number
          user_id?: string | null
        }
        Update: {
          city_id?: string | null
          clicked_listing_id?: string | null
          clicked_result_position?: number | null
          created_at?: string
          filters?: Json
          id?: string
          query?: string
          result_count?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_events_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_events_clicked_listing_id_fkey"
            columns: ["clicked_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_featured: boolean
          listing_id: string
          name: string
          price_display: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_featured?: boolean
          listing_id: string
          name: string
          price_display?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_featured?: boolean
          listing_id?: string
          name?: string
          price_display?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      spend_events: {
        Row: {
          aggregate_opt_out: boolean
          amount_cents: number
          city_id: string | null
          created_at: string
          id: string
          listing_id: string | null
          purchase_date: string
          receipt_upload_id: string | null
          source: string
        }
        Insert: {
          aggregate_opt_out?: boolean
          amount_cents: number
          city_id?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          purchase_date: string
          receipt_upload_id?: string | null
          source?: string
        }
        Update: {
          aggregate_opt_out?: boolean
          amount_cents?: number
          city_id?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          purchase_date?: string
          receipt_upload_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "spend_events_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spend_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spend_events_receipt_upload_id_fkey"
            columns: ["receipt_upload_id"]
            isOneToOne: false
            referencedRelation: "receipt_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_campaigns: {
        Row: {
          budget_cents: number | null
          campaign_type: string
          contact_email: string
          created_at: string
          ends_at: string | null
          id: string
          notes: string | null
          sponsor_name: string
          starts_at: string | null
          status: string
          target_cities: string[] | null
          updated_at: string
        }
        Insert: {
          budget_cents?: number | null
          campaign_type: string
          contact_email: string
          created_at?: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          sponsor_name: string
          starts_at?: string | null
          status?: string
          target_cities?: string[] | null
          updated_at?: string
        }
        Update: {
          budget_cents?: number | null
          campaign_type?: string
          contact_email?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          sponsor_name?: string
          starts_at?: string | null
          status?: string
          target_cities?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      sponsored_placements: {
        Row: {
          category_id: string | null
          city_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          listing_id: string
          placement_type: string
          placement_zone: string | null
          position: number | null
          price_cents: number | null
          starts_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          city_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          listing_id: string
          placement_type: string
          placement_zone?: string | null
          position?: number | null
          price_cents?: number | null
          starts_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          city_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          listing_id?: string
          placement_type?: string
          placement_zone?: string | null
          position?: number | null
          price_cents?: number | null
          starts_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_placements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_placements_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_placements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      states: {
        Row: {
          code: string
          country: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          country?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          country?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          listing_id: string
          plan_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          listing_id: string
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          listing_id?: string
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          listing_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          listing_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          listing_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aggregate_entity_analytics: {
        Args: { target_date?: string }
        Returns: Json
      }
      auto_grant_certified: { Args: never; Returns: Json }
      get_top_listings_by_views: {
        Args: { days_back?: number; limit_n?: number }
        Returns: {
          city_name: string
          listing_id: string
          listing_name: string
          total_views: number
        }[]
      }
      get_top_search_queries: {
        Args: { days_back?: number; limit_n?: number }
        Returns: {
          avg_results: number
          query: string
          search_count: number
        }[]
      }
      has_role: { Args: { p_role: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      owns_entity: { Args: { p_entity_id: string }; Returns: boolean }
      owns_listing: { Args: { p_listing_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

