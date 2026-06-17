export interface KommoAccount {
	id: number;
	name: string;
	subdomain: string;
	language: string;
	created_at: number;
	created_by: number;
	updated_at: number;
	updated_by: number;
	current_user_id: number;
	country: string;
	currency: string;
	currency_symbol: string;
	customers_mode: string;
	is_unsorted_on: boolean;
	mobile_feature_version: number;
	is_loss_reason_enabled: boolean;
	is_helpbot_enabled: boolean;
	is_technical_account: boolean;
	contact_name_display_order: boolean;
	_links: {
		self: {
			href: string;
		};
	};
	drive_url: string | null;
}

export interface KommoTag {
	id: number;
	name: string;
	color?: string | null;
}

export interface KommoLink {
	href: string;
}

export interface KommoLinks {
	self?: KommoLink | null;
	next?: KommoLink | null;
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
	custom_fields_values?: KommoCustomFieldValue[] | null;
	_embedded?: Record<string, unknown> | null;
	_links?: KommoLinks | null;
	tags?: KommoTag[] | null;
}

export interface KommoCustomFieldValue {
	field_id?: number | null;
	field_name?: string | null;
	field_code?: string | null;
	field_type?: string | null;
	values?: KommoCustomFieldValueItem[] | null;
}

export interface KommoCustomFieldValueItem {
	value?: string | number | boolean | null;
	enum_id?: number | null;
	enum_code?: string | null;
}

export interface KommoEmbedded {
	contacts?: KommoContact[] | null;
	tags?: KommoTag[] | null;
	companies?: KommoCompany[] | null;
}

export interface KommoCompany {
	id?: number | null;
	name?: string | null;
	responsible_user_id?: number | null;
	created_at?: number | null;
	updated_at?: number | null;
}

export interface KommoFileMeta {
	extension: string;
	mime_type: string;
}

export interface KommoFileLinks {
	download: {
		href: string;
	};
	download_version: {
		href: string;
	};
	self?: {
		href: string;
	};
}

export interface KommoFile {
	file_uuid?: string | null;
	uuid?: string | null;
	id?: number | null;
	name?: string | null;
	size?: number | null;
	type?: string | null;
	metadata?: KommoFileMeta | null;
	_links?: KommoFileLinks | null;
	created_at?: number | null;
	created_by?: {
		type: string;
		id: number;
	} | null;
}

export interface KommoPaginatedResponse<T> {
	_page?: number | null;
	_links?: KommoLinks | null;
	_embedded?: {
		contacts?: T[] | null;
		files?: T[] | null;
		[key: string]: T[] | null;
	} | null;
}
