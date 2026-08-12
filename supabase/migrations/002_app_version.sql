-- Tabla de versiones de la app
create table if not exists public.app_versions (
  id          uuid primary key default gen_random_uuid(),
  version     text not null,
  is_current  boolean default false,
  force_update boolean default false,  -- si es true, el usuario DEBE actualizar
  changelog   text,
  created_at  timestamp with time zone default now()
);

-- Solo una versión puede ser la actual
create unique index if not exists idx_app_versions_current
  on public.app_versions(is_current) where is_current = true;

-- Insertar versión inicial
insert into public.app_versions (version, is_current, changelog)
values ('1.0.0', true, 'Primera versión — chat privado, búsqueda de usuarios');

-- Acceso público para leer la versión (sin auth)
alter table public.app_versions enable row level security;

create policy "Cualquiera puede ver la versión actual"
  on public.app_versions for select using (true);
