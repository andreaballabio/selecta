export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      labels: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          website_url: string | null
          demo_submission_url: string | null
          primary_genre: string
          secondary_genres: string[] | null
          bpm_min: number | null
          bpm_max: number | null
          typical_key_signatures: string[] | null
          audio_embedding: string | null
          avg_energy_mean: number | null
          avg_energy_variance: number | null
          commercial_score: number | null
          underground_score: number | null
          target_artist_level: string | null
          estimated_monthly_releases: number | null
          years_active: number | null
          spotify_followers: number | null
          beatport_label_page_url: string | null
          accepts_unsolicited_demos: boolean
          response_time_days_avg: number | null
          signing_rate_estimate: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          website_url?: string | null
          demo_submission_url?: string | null
          primary_genre?: string
          secondary_genres?: string[] | null
          bpm_min?: number | null
          bpm_max?: number | null
          typical_key_signatures?: string[] | null
          audio_embedding?: string | null
          avg_energy_mean?: number | null
          avg_energy_variance?: number | null
          commercial_score?: number | null
          underground_score?: number | null
          target_artist_level?: string | null
          estimated_monthly_releases?: number | null
          years_active?: number | null
          spotify_followers?: number | null
          beatport_label_page_url?: string | null
          accepts_unsolicited_demos?: boolean
          response_time_days_avg?: number | null
          signing_rate_estimate?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          website_url?: string | null
          demo_submission_url?: string | null
          primary_genre?: string
          secondary_genres?: string[] | null
          bpm_min?: number | null
          bpm_max?: number | null
          typical_key_signatures?: string[] | null
          audio_embedding?: string | null
          avg_energy_mean?: number | null
          avg_energy_variance?: number | null
          commercial_score?: number | null
          underground_score?: number | null
          target_artist_level?: string | null
          estimated_monthly_releases?: number | null
          years_active?: number | null
          spotify_followers?: number | null
          beatport_label_page_url?: string | null
          accepts_unsolicited_demos?: boolean
          response_time_days_avg?: number | null
          signing_rate_estimate?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_tracks: {
        Row: {
          id: string
          user_id: string
          title: string
          is_instrumental: boolean
          description: string | null
          storage_path: string
          file_name: string
          file_size_bytes: number | null
          file_format: string | null
          bpm: number | null
          key: string | null
          scale: string | null
          duration_seconds: number | null
          lufs: number | null
          audio_embedding: string | null
          energy_curve: Json | null
          features: Json | null
          analysis_status: string
          analysis_error: string | null
          is_public: boolean
          created_at: string
          analyzed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          is_instrumental?: boolean
          description?: string | null
          storage_path: string
          file_name: string
          file_size_bytes?: number | null
          file_format?: string | null
          bpm?: number | null
          key?: string | null
          scale?: string | null
          duration_seconds?: number | null
          lufs?: number | null
          audio_embedding?: string | null
          energy_curve?: Json | null
          features?: Json | null
          analysis_status?: string
          analysis_error?: string | null
          is_public?: boolean
          created_at?: string
          analyzed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          is_instrumental?: boolean
          description?: string | null
          storage_path?: string
          file_name?: string
          file_size_bytes?: number | null
          file_format?: string | null
          bpm?: number | null
          key?: string | null
          scale?: string | null
          duration_seconds?: number | null
          lufs?: number | null
          audio_embedding?: string | null
          energy_curve?: Json | null
          features?: Json | null
          analysis_status?: string
          analysis_error?: string | null
          is_public?: boolean
          created_at?: string
          analyzed_at?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          artist_name: string | null
          location: string | null
          website_url: string | null
          spotify_artist_url: string | null
          soundcloud_url: string | null
          career_level: string | null
          years_producing: number | null
          releases_count: number
          primary_genres: string[] | null
          favorite_labels: string[] | null
          subscription_tier: string
          subscription_expires_at: string | null
          monthly_analysis_quota: number
          monthly_analysis_used: number
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          artist_name?: string | null
          location?: string | null
          website_url?: string | null
          spotify_artist_url?: string | null
          soundcloud_url?: string | null
          career_level?: string | null
          years_producing?: number | null
          releases_count?: number
          primary_genres?: string[] | null
          favorite_labels?: string[] | null
          subscription_tier?: string
          subscription_expires_at?: string | null
          monthly_analysis_quota?: number
          monthly_analysis_used?: number
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          artist_name?: string | null
          location?: string | null
          website_url?: string | null
          spotify_artist_url?: string | null
          soundcloud_url?: string | null
          career_level?: string | null
          years_producing?: number | null
          releases_count?: number
          primary_genres?: string[] | null
          favorite_labels?: string[] | null
          subscription_tier?: string
          subscription_expires_at?: string | null
          monthly_analysis_quota?: number
          monthly_analysis_used?: number
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      analysis_results: {
        Row: {
          id: string
          track_id: string
          user_id: string
          overall_quality_score: number | null
          production_readiness: number | null
          ar_feedback: string | null
          strengths: string[] | null
          weaknesses: string[] | null
          recommended_genre: string | null
          commercial_potential: number | null
          underground_credibility: number | null
          analysis_version: string
          created_at: string
        }
        Insert: {
          id?: string
          track_id: string
          user_id: string
          overall_quality_score?: number | null
          production_readiness?: number | null
          ar_feedback?: string | null
          strengths?: string[] | null
          weaknesses?: string[] | null
          recommended_genre?: string | null
          commercial_potential?: number | null
          underground_credibility?: number | null
          analysis_version?: string
          created_at?: string
        }
        Update: {
          id?: string
          track_id?: string
          user_id?: string
          overall_quality_score?: number | null
          production_readiness?: number | null
          ar_feedback?: string | null
          strengths?: string[] | null
          weaknesses?: string[] | null
          recommended_genre?: string | null
          commercial_potential?: number | null
          underground_credibility?: number | null
          analysis_version?: string
          created_at?: string
        }
      }
      label_matches: {
        Row: {
          id: string
          track_id: string
          label_id: string
          sound_match_score: number
          accessibility_score: number
          trend_alignment_score: number
          final_probability: number
          match_reasoning: string | null
          rank: number
          fit_analysis: string | null
          created_at: string
        }
        Insert: {
          id?: string
          track_id: string
          label_id: string
          sound_match_score: number
          accessibility_score: number
          trend_alignment_score: number
          final_probability: number
          match_reasoning?: string | null
          rank: number
          fit_analysis?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          track_id?: string
          label_id?: string
          sound_match_score?: number
          accessibility_score?: number
          trend_alignment_score?: number
          final_probability?: number
          match_reasoning?: string | null
          rank?: number
          fit_analysis?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
