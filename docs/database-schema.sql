-- Supabase/Postgres assumptions for the cloud version.
-- The current MVP uses browser local storage with the same core object names.

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key,
  email text unique not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'helper', 'viewer')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  parent_location_id uuid references locations(id) on delete set null,
  name text not null,
  type text not null,
  notes text,
  photo_url text,
  qr_code_value text,
  last_reviewed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table containers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  location_id uuid not null references locations(id) on delete restrict,
  name text not null,
  container_code text not null,
  category text,
  notes text,
  outside_photo_url text,
  inside_photo_url text,
  qr_code_value text,
  last_reviewed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, container_code)
);

create table items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  location_id uuid not null references locations(id) on delete restrict,
  container_id uuid references containers(id) on delete set null,
  name text not null,
  normalized_name text not null,
  category text not null,
  brand text,
  model_number text,
  serial_number text,
  barcode text,
  quantity_status text not null,
  quantity_number numeric,
  unit text,
  condition text,
  notes text,
  photo_url text,
  expiration_date date,
  purchase_date date,
  purchase_price numeric,
  estimated_value numeric,
  warranty_expiration_date date,
  manual_url text,
  receipt_url text,
  preferred_store text,
  replacement_url text,
  disposition_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_list_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  name text not null,
  quantity text,
  urgency text not null,
  preferred_brand text,
  preferred_store text,
  estimated_price numeric,
  replacement_url text,
  notes text,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  store_name text,
  purchased_at date,
  receipt_url text,
  receipt_photo_url text,
  digital_receipt_url text,
  order_number text,
  total_amount numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table purchase_records (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  receipt_id uuid references receipts(id) on delete set null,
  purchased_at date,
  store_name text,
  seller_name text,
  product_name text not null,
  brand text,
  quantity_purchased numeric,
  unit_size text,
  total_price numeric,
  unit_price numeric,
  tax numeric,
  shipping numeric,
  product_url text,
  order_number text,
  notes text,
  purchase_preference text check (purchase_preference in ('preferred', 'acceptable', 'do_not_buy_again', 'unknown')),
  reorder_recommendation text check (reorder_recommendation in ('reorder_same', 'compare_first', 'substitute_okay', 'avoid', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table task_flags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  color text not null,
  shape text not null,
  symbol text,
  meaning text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table task_tags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  task_project_id uuid,
  title text not null,
  notes text,
  status text not null,
  star_count integer not null default 0,
  due_date date,
  reminder_at timestamptz,
  effort text not null default 'Unsorted',
  related_item_id uuid references items(id) on delete set null,
  related_order_entry_id uuid references order_list_entries(id) on delete set null,
  related_purchase_record_id uuid references purchase_records(id) on delete set null,
  help_requested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table task_projects (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  parent_task_project_id uuid references task_projects(id) on delete set null,
  name text not null,
  description text,
  view_preference text check (view_preference in ('tree', 'branch', 'flowchart', 'list')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tasks
  add constraint tasks_task_project_id_fkey
  foreign key (task_project_id) references task_projects(id) on delete set null;

create table task_dependencies (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  prerequisite_task_id uuid not null references tasks(id) on delete cascade,
  dependency_type text not null default 'must_finish_first',
  notes text,
  created_at timestamptz not null default now(),
  unique (task_id, prerequisite_task_id)
);

create table task_flag_assignments (
  task_id uuid not null references tasks(id) on delete cascade,
  task_flag_id uuid not null references task_flags(id) on delete cascade,
  primary key (task_id, task_flag_id)
);

create table task_tag_assignments (
  task_id uuid not null references tasks(id) on delete cascade,
  task_tag_id uuid not null references task_tags(id) on delete cascade,
  primary key (task_id, task_tag_id)
);

create table energy_journal (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recorded_at date not null,
  energy_label text,
  notes text,
  created_at timestamptz not null default now()
);

create table supplement_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  brand text,
  bottle_photo_url text,
  dose_instructions text,
  pills_per_bottle numeric,
  pills_remaining numeric,
  reorder_threshold numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table supplement_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  supplement_item_id uuid not null references supplement_items(id) on delete cascade,
  taken_at timestamptz not null default now(),
  amount_taken numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table helper_access_grants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  helper_user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('admin', 'helper', 'viewer')),
  vault_access_allowed boolean not null default false,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table help_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  requested_by_user_id uuid references users(id) on delete set null,
  message text,
  urgency text not null default 'normal',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table alert_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  triggered_by_user_id uuid references users(id) on delete set null,
  alert_type text not null,
  message text,
  status text not null default 'sent',
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create table encrypted_vault_records (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  encrypted_payload bytea not null,
  encryption_metadata jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table vault_recovery_keys (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  holder_user_id uuid references users(id) on delete set null,
  public_key text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table replacement_searches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  purchase_record_id uuid references purchase_records(id) on delete set null,
  search_query text not null,
  target_stores text[],
  user_constraints text,
  provider text,
  status text not null default 'draft',
  checked_at timestamptz,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table replacement_options (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  replacement_search_id uuid not null references replacement_searches(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  product_name text not null,
  store_name text,
  brand text,
  product_url text,
  image_url text,
  current_price numeric,
  unit_price numeric,
  pack_size text,
  availability_summary text,
  option_type text check (option_type in ('same_item', 'close_match', 'similar_price', 'cheaper_alternative', 'premium_alternative', 'outlier', 'avoid')),
  match_confidence numeric,
  substitute_confidence numeric,
  reason text,
  warning text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audit_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  started_by_user_id uuid references users(id) on delete set null,
  status text not null,
  notes text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  related_type text not null,
  related_id uuid not null,
  photo_url text not null,
  caption text,
  created_at timestamptz not null default now()
);

create table ai_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  provider text not null,
  prompt_type text not null,
  user_prompt text,
  response_summary text,
  actions_suggested jsonb,
  actions_confirmed jsonb,
  created_at timestamptz not null default now()
);
