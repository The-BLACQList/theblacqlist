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
      attribute_groups: {
        Row: {
          applies_to: string[]
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          input_type: string
          is_active: boolean
          is_filterable: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          applies_to?: string[]
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          input_type?: string
          is_active?: boolean
          is_filterable?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          applies_to?: string[]
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          input_type?: string
          is_active?: boolean
          is_filterable?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      attribute_values: {
        Row: {
          created_at: string
          display_order: number
          group_id: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          display_order?: number
          group_id: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          display_order?: number
          group_id?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "attribute_values_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "attribute_groups"
            referencedColumns: ["id"]
          },
        ]
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
      failed_webhooks: {
        Row: {
          created_at: string
          error_message: string
          event_type: string
          id: string
          payload_json: Json | null
          resolved_at: string | null
          stripe_event_id: string | null
        }
        Insert: {
          created_at?: string
          error_message: string
          event_type: string
          id?: string
          payload_json?: Json | null
          resolved_at?: string | null
          stripe_event_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string
          event_type?: string
          id?: string
          payload_json?: Json | null
          resolved_at?: string | null
          stripe_event_id?: string | null
        }
        Relationships: []
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
      job_posting_purchases: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          entitlement_key: string | null
          expires_at: string | null
          id: string
          listing_id: string
          paid_at: string | null
          purchased_by: string | null
          source: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          entitlement_key?: string | null
          expires_at?: string | null
          id?: string
          listing_id: string
          paid_at?: string | null
          purchased_by?: string | null
          source?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          entitlement_key?: string | null
          expires_at?: string | null
          id?: string
          listing_id?: string
          paid_at?: string | null
          purchased_by?: string | null
          source?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_posting_purchases_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_subscribe_attempts: {
        Row: {
          attempted_at: string
          id: string
          ip_hash: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip_hash: string
        }
        Update: {
          attempted_at?: string
          id?: string
          ip_hash?: string
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
      listing_attributes: {
        Row: {
          created_at: string
          listing_id: string
          value_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          value_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          value_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_attributes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_attributes_value_id_fkey"
            columns: ["value_id"]
            isOneToOne: false
            referencedRelation: "attribute_values"
            referencedColumns: ["id"]
          },
        ]
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
          video_embed_url: string | null
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
          video_embed_url?: string | null
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
          video_embed_url?: string | null
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
      listing_details_event: {
        Row: {
          city_text: string | null
          created_at: string
          cta_type: string
          cta_url: string | null
          description: string | null
          ends_at: string | null
          is_online: boolean
          listing_id: string
          organizer_listing_id: string | null
          price_text: string | null
          starts_at: string
          state: string | null
          ticket_url: string | null
          timezone: string | null
          updated_at: string
          venue_address: string | null
          venue_name: string | null
          zip: string | null
        }
        Insert: {
          city_text?: string | null
          created_at?: string
          cta_type?: string
          cta_url?: string | null
          description?: string | null
          ends_at?: string | null
          is_online?: boolean
          listing_id: string
          organizer_listing_id?: string | null
          price_text?: string | null
          starts_at: string
          state?: string | null
          ticket_url?: string | null
          timezone?: string | null
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          zip?: string | null
        }
        Update: {
          city_text?: string | null
          created_at?: string
          cta_type?: string
          cta_url?: string | null
          description?: string | null
          ends_at?: string | null
          is_online?: boolean
          listing_id?: string
          organizer_listing_id?: string | null
          price_text?: string | null
          starts_at?: string
          state?: string | null
          ticket_url?: string | null
          timezone?: string | null
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_details_event_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_details_event_organizer_listing_id_fkey"
            columns: ["organizer_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_details_job: {
        Row: {
          apply_email: string | null
          apply_url: string | null
          closes_at: string | null
          created_at: string
          cta_type: string
          cta_url: string | null
          description: string | null
          employment_type: string
          hiring_listing_id: string | null
          listing_id: string
          posted_at: string
          salary_currency: string
          salary_max: number | null
          salary_min: number | null
          salary_period: string | null
          updated_at: string
          workplace_type: string
        }
        Insert: {
          apply_email?: string | null
          apply_url?: string | null
          closes_at?: string | null
          created_at?: string
          cta_type?: string
          cta_url?: string | null
          description?: string | null
          employment_type: string
          hiring_listing_id?: string | null
          listing_id: string
          posted_at?: string
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          updated_at?: string
          workplace_type?: string
        }
        Update: {
          apply_email?: string | null
          apply_url?: string | null
          closes_at?: string | null
          created_at?: string
          cta_type?: string
          cta_url?: string | null
          description?: string | null
          employment_type?: string
          hiring_listing_id?: string | null
          listing_id?: string
          posted_at?: string
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          updated_at?: string
          workplace_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_details_job_hiring_listing_id_fkey"
            columns: ["hiring_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_details_job_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_faqs: {
        Row: {
          answer: string
          created_at: string
          display_order: number
          id: string
          is_visible: boolean
          listing_id: string
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          display_order?: number
          id?: string
          is_visible?: boolean
          listing_id: string
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          display_order?: number
          id?: string
          is_visible?: boolean
          listing_id?: string
          question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_faqs_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
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
      listing_tags: {
        Row: {
          created_at: string
          listing_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_tags_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
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
          ownership_label: string
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
          ownership_label?: string
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
          ownership_label?: string
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
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          priority: number
          queue_type: string
          resolved_at: string | null
          status: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          priority?: number
          queue_type: string
          resolved_at?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          priority?: number
          queue_type?: string
          resolved_at?: string | null
          status?: string
          submitted_by?: string | null
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
      problem_reports: {
        Row: {
          body: string
          created_at: string
          id: string
          page_path: string
          pr_ref: string | null
          role: string | null
          status: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          page_path: string
          pr_ref?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          page_path?: string
          pr_ref?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
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
      rate_limit_counters: {
        Row: {
          bucket: string
          hits: number
          key_hash: string
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          key_hash: string
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          key_hash?: string
          window_start?: string
        }
        Relationships: []
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
      review_criteria: {
        Row: {
          applies_to: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          applies_to?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          applies_to?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      review_ratings: {
        Row: {
          created_at: string
          criterion_id: string
          rating: number
          review_id: string
        }
        Insert: {
          created_at?: string
          criterion_id: string
          rating: number
          review_id: string
        }
        Update: {
          created_at?: string
          criterion_id?: string
          rating?: number
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_ratings_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "review_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_ratings_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
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
      saved_list_items: {
        Row: {
          created_at: string
          list_id: string
          save_id: string
        }
        Insert: {
          created_at?: string
          list_id: string
          save_id: string
        }
        Update: {
          created_at?: string
          list_id?: string
          save_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "saved_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_list_items_save_id_fkey"
            columns: ["save_id"]
            isOneToOne: false
            referencedRelation: "saves"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          group_label: string | null
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
          group_label?: string | null
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
          group_label?: string | null
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
      stripe_events_processed: {
        Row: {
          event_type: string
          id: string
          processed_at: string
          stripe_event_id: string
        }
        Insert: {
          event_type: string
          id?: string
          processed_at?: string
          stripe_event_id: string
        }
        Update: {
          event_type?: string
          id?: string
          processed_at?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
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
          canceled_at?: string | null
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
          canceled_at?: string | null
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
      tags: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      tour_enrollments: {
        Row: {
          completed_at: string | null
          created_at: string
          ended_at: string | null
          id: string
          invited_by: string | null
          listing_id: string
          started_at: string
          stripe_checkout_session_id: string | null
          tester_user_id: string
          trial_granted_at: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          invited_by?: string | null
          listing_id: string
          started_at?: string
          stripe_checkout_session_id?: string | null
          tester_user_id: string
          trial_granted_at?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          invited_by?: string | null
          listing_id?: string
          started_at?: string
          stripe_checkout_session_id?: string | null
          tester_user_id?: string
          trial_granted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_enrollments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_step_completions: {
        Row: {
          completed_at: string
          created_at: string
          enrollment_id: string
          id: string
          reflected_at: string | null
          reflection: string | null
          step_key: string
          updated_at: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          enrollment_id: string
          id?: string
          reflected_at?: string | null
          reflection?: string | null
          step_key: string
          updated_at?: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          reflected_at?: string | null
          reflection?: string | null
          step_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_step_completions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "tour_enrollments"
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
      check_rate_limit: {
        Args: {
          p_bucket: string
          p_key_hash: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      facet_counts: {
        Args: {
          p_attribute_values?: string[]
          p_category_id?: string
          p_city_id?: string
          p_entity_type?: string
          p_lat?: number
          p_lng?: number
          p_location_type?: string
          p_location_types?: string[]
          p_open_now?: boolean
          p_price_ranges?: string[]
          p_q?: string
          p_radius_miles?: number
          p_trust_tier?: string
        }
        Returns: {
          facet_count: number
          facet_key: string
          facet_kind: string
        }[]
      }
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
      haversine_miles: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      is_open_now: { Args: { p_listing_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      owns_entity: { Args: { p_entity_id: string }; Returns: boolean }
      owns_listing: { Args: { p_listing_id: string }; Returns: boolean }
      prune_launch_subscribe_attempts: { Args: never; Returns: undefined }
      prune_rate_limit_counters: { Args: never; Returns: undefined }
      search_listings_faceted: {
        Args: {
          p_attribute_values?: string[]
          p_category_id?: string
          p_city_id?: string
          p_entity_type?: string
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_location_type?: string
          p_location_types?: string[]
          p_offset?: number
          p_open_now?: boolean
          p_ownership_label?: string
          p_price_ranges?: string[]
          p_q?: string
          p_radius_miles?: number
          p_sort?: string
          p_trust_tier?: string
        }
        Returns: {
          id: string
          total_count: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sponsored_placement_delivery: {
        Args: { p_placement_ids: string[] }
        Returns: {
          clicks: number
          impressions: number
          placement_id: string
        }[]
      }
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
    Enums: {},
  },
} as const
