-- Therapists table
create table therapists (
  id uuid references auth.users primary key,
  name text,
  business_name text,
  created_at timestamp with time zone default now()
);

-- Referring Providers table (doctors, chiropractors, PTs, etc.)
create table referring_providers (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid references therapists(id) on delete cascade,
  name text not null,
  practice_name text,
  specialty text,
  phone text,
  email text,
  fax text,
  address text,
  notes text,
  created_at timestamp with time zone default now()
);

-- Clients table
create table clients (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid references therapists(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text,
  referring_provider_id uuid references referring_providers(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- Migration: If tables already exist, run these:
-- create table if not exists referring_providers (...);
-- alter table clients add column if not exists referring_provider_id uuid references referring_providers(id) on delete set null;
-- alter table clients drop column if exists referred_by;

-- Sessions table
create table sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  therapist_id uuid references therapists(id) on delete cascade,
  audio_url text,
  transcript text,
  soap_note jsonb,
  raw_soap_text text,
  session_date timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table therapists enable row level security;
alter table referring_providers enable row level security;
alter table clients enable row level security;
alter table sessions enable row level security;

-- RLS Policies
create policy "Users can view own therapist profile" on therapists for select using (auth.uid() = id);
create policy "Users can update own therapist profile" on therapists for update using (auth.uid() = id);
create policy "Users can insert own therapist profile" on therapists for insert with check (auth.uid() = id);

create policy "Therapists can manage own referring providers" on referring_providers for all using (auth.uid() = therapist_id);
create policy "Therapists can manage own clients" on clients for all using (auth.uid() = therapist_id);
create policy "Therapists can manage own sessions" on sessions for all using (auth.uid() = therapist_id);

-- Referrals table (medical referral documents from doctors)
create table referrals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  therapist_id uuid references therapists(id) on delete cascade not null,
  referring_provider_id uuid references referring_providers(id) on delete set null,
  provider_name text not null,
  referral_date date not null,
  diagnosis text,
  icd_code text,
  visits_authorized integer,
  expiration_date date,
  document_url text,
  document_name text,
  notes text,
  created_at timestamp with time zone default now()
);

alter table referrals enable row level security;
create policy "Therapists can manage own referrals" on referrals for all using (auth.uid() = therapist_id);

-- Create storage bucket for recordings
insert into storage.buckets (id, name, public) values ('recordings', 'recordings', true);

-- Create storage bucket for referral documents
insert into storage.buckets (id, name, public) values ('referral-documents', 'referral-documents', false);

-- Storage policies
create policy "Authenticated users can upload recordings"
on storage.objects for insert
with check (bucket_id = 'recordings' and auth.role() = 'authenticated');

create policy "Authenticated users can read own recordings"
on storage.objects for select
using (bucket_id = 'recordings' and auth.uid()::text = (storage.foldername(name))[1]);

-- Referral documents storage policies
create policy "Authenticated users can upload referral documents"
on storage.objects for insert
with check (bucket_id = 'referral-documents' and auth.role() = 'authenticated');

create policy "Authenticated users can read own referral documents"
on storage.objects for select
using (bucket_id = 'referral-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Authenticated users can delete own referral documents"
on storage.objects for delete
using (bucket_id = 'referral-documents' and auth.uid()::text = (storage.foldername(name))[1]);
