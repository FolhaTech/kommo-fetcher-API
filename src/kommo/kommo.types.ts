export interface KommoAccount {
  id?: number;
  name?: string;
  drive_url?: string;
  [key: string]: unknown;
}

export interface KommoLink {
  href: string;
}

export interface KommoLinks {
  self?: KommoLink;
  next?: KommoLink;
}

export interface KommoTag {
  id: number;
  name: string;
  color?: string | null;
}

export interface KommoContact {
  id?: number | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  responsible_user_id?: number | null;
  group_id?: number | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_at?: number | null;
  updated_at?: number | null;
  closest_task_at?: number | null;
  is_deleted?: boolean | null;
  is_unmerged?: boolean | null;
  account_id?: number | null;
  custom_fields_values?: unknown[] | null;
  _embedded?: Record<string, unknown> | null;
  _links?: KommoLinks | null;
  tags?: KommoTag[] | null;
}

export interface KommoPaginatedResponse<T> {
  _page?: number;
  _links?: KommoLinks;
  _embedded?: Record<string, T[] | undefined>;
}

export interface KommoFileMeta {
  extension?: string | null;
  mime_type?: string | null;
}

export interface KommoFileLinks {
  download?: KommoLink;
  download_version?: KommoLink;
  self?: KommoLink;
}

export interface KommoFile {
  file_uuid?: string | null;
  uuid?: string | null;
  id?: number | null;
  name?: string | null;
  sanitized_name?: string | null;
  size?: number | null;
  type?: string | null;
  is_trashed?: boolean | null;
  has_multiple_versions?: boolean | null;
  metadata?: KommoFileMeta | null;
  _links?: KommoFileLinks | null;
  created_at?: number | null;
  updated_at?: number | null;
  created_by?: { type: string; id: number } | null;
  updated_by?: { type: string; id: number } | null;
  source_id?: number | null;
  previews?: unknown[] | null;
}

export interface KommoLeadEmbedded {
  tags?: KommoTag[];
  companies?: unknown[];
  contacts?: KommoContact;
}

export interface KommoLead {
  id: number;
  name: string;
  price?: number;
  responsible_user_id?: number;
  group_id?: number;
  status_id?: number;
  pipeline_id?: number;
  loss_reason_id?: number | null;
  created_by?: number;
  updated_by?: number;
  created_at?: number;
  updated_at?: number;
  closed_at?: number | null;
  closest_task_at?: number | null;
  is_deleted?: boolean;
  custom_fields_values?: unknown[] | null;
  score?: number | null;
  account_id?: number;
  labor_cost?: number | null;
  _embedded?: KommoLeadEmbedded;
  _links?: KommoLinks;
}

export interface KommoPaginatedLeads {
  _page?: number;
  _links: KommoLinks;
  _embedded: {
    leads: KommoLead[];
  };
}

export interface KommoDriveFilesResponse {
  _count?: number;
  _page?: number;
  _links?: KommoLinks;
  _embedded?: {
    files: KommoFile[];
  };
}

export interface KommoLeadWithFiles {
  lead: KommoLead;
  files: KommoFile[];
}
