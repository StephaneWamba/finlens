// API Response Types

export interface User {
  id: string;
  email: string;
  full_name?: string;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  subscription_status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  monthly_query_limit: number;
  queries_used_this_month: number;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  query: string;
  session_id?: string;
  messages?: ChatMessage[];
}

export interface ChartData {
  type: 'line' | 'bar' | 'doughnut' | 'pie';
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string;
      borderWidth?: number;
    }>;
  };
  options?: Record<string, unknown>;
}

export interface Source {
  company: string;
  year: number;
  page: number;
}

export interface ChatResponse {
  text: string;
  charts?: ChartData[];
  sources?: Source[];
  metadata?: {
    companies?: string[];
    year?: number;
    session_id?: string;
    retrieval_attempts?: number;
    self_heal_attempts?: number;
    query_cost?: number;
    [key: string]: unknown;
  };
}

export interface UsageStats {
  queries_used_this_month: number;
  monthly_query_limit: number;
  queries_remaining: number;
  has_queries_remaining: boolean;
  subscription_tier: string;
  subscription_status: string;
  period_stats: {
    total_queries: number;
    successful_queries: number;
    failed_queries: number;
    success_rate: number;
    total_cost_usd: number;
    average_cost_per_query: number;
    total_tokens: number;
    period_days: number;
  };
}

export interface QueryHistoryItem {
  id: string;
  query_text: string;
  cost_usd: number;
  tokens_used: number;
  success: boolean;
  error_message?: string;
  created_at: string;
}

export interface UsageTrend {
  date: string;
  queries: number;
  successful_queries: number;
  failed_queries: number;
  total_cost_usd: number;
  total_tokens: number;
}

export interface Subscription {
  tier: 'free' | 'pro' | 'enterprise';
  tier_name: string;
  status: string;
  monthly_query_limit: number;
  queries_used_this_month: number;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
}

// Document types
export type DocumentStatus = 
  | 'uploaded' 
  | 'validating' 
  | 'indexed' 
  | 'failed';

export interface Document {
  id: string;
  filename: string;
  original_filename: string;
  file_extension: string;
  file_size: number;
  status: DocumentStatus;
  page_count?: number;
  mime_type: string;
  created_at: string;
  updated_at: string;
  indexed_at?: string;
  error_message?: string;
  original_pdf_url?: string;
}

export interface DocumentUploadResponse {
  document_id: string;
  status: string;
  message: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
  limit: number;
  offset: number;
}

export interface DocumentDeleteResponse {
  message: string;
}

export interface BatchUploadResponse {
  total: number;
  successful: number;
  failed: number;
  results: DocumentUploadResponse[];
}


