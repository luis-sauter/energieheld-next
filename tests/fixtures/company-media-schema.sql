create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated;
 grant select on storage.objects to anon,authenticated;
 grant insert,update,delete on storage.objects to authenticated;
 create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
 alter table company_profiles add column slug text, add column tagline text, add column description text,
 add column phone text, add column public_email text, add column website text, add column postal_code text,
 add column city text, add column region text, add column country text, add column logo_url text;
