-- Mi Mensajero — Migración inicial
-- Correr en: Supabase → SQL Editor

-- Tabla de usuarios (extiende auth.users)
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  phone         text unique,
  email         text unique,
  username      text unique not null,
  display_name  text not null,
  avatar_url    text,
  bio           text,
  is_bot        boolean default false,
  is_active     boolean default true,
  last_seen_at  timestamp with time zone,
  created_at    timestamp with time zone default now(),
  updated_at    timestamp with time zone default now()
);

-- Configuración de privacidad
create table if not exists public.user_settings (
  user_id                   uuid primary key references public.users(id) on delete cascade,
  who_can_message_me        text default 'everyone',
  who_can_add_to_groups     text default 'everyone',
  show_phone_to             text default 'nobody',
  show_last_seen_to         text default 'everyone',
  show_avatar_to            text default 'everyone',
  notifications_enabled     boolean default true,
  created_at                timestamp with time zone default now(),
  updated_at                timestamp with time zone default now()
);

-- Bloqueos
create table if not exists public.user_blocks (
  id          uuid primary key default gen_random_uuid(),
  blocker_id  uuid not null references public.users(id) on delete cascade,
  blocked_id  uuid not null references public.users(id) on delete cascade,
  created_at  timestamp with time zone default now(),
  unique(blocker_id, blocked_id)
);

-- Conversaciones privadas (1:1)
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamp with time zone default now()
);

create table if not exists public.conversation_members (
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  user_id          uuid not null references public.users(id) on delete cascade,
  last_read_at     timestamp with time zone,
  is_archived      boolean default false,
  primary key (conversation_id, user_id)
);

-- Comunidades
create table if not exists public.communities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  avatar_url   text,
  invite_link  text unique,
  is_public    boolean default false,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamp with time zone default now(),
  updated_at   timestamp with time zone default now()
);

create table if not exists public.community_members (
  community_id  uuid not null references public.communities(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  role          text not null default 'member',
  joined_at     timestamp with time zone default now(),
  primary key (community_id, user_id)
);

-- Grupos / canales
create table if not exists public.groups (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid references public.communities(id) on delete set null,
  name          text not null,
  description   text,
  avatar_url    text,
  invite_link   text unique,
  is_channel    boolean default false,
  is_archived   boolean default false,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamp with time zone default now(),
  updated_at    timestamp with time zone default now()
);

create table if not exists public.group_members (
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  role       text not null default 'member',
  is_banned  boolean default false,
  is_muted   boolean default false,
  joined_at  timestamp with time zone default now(),
  primary key (group_id, user_id)
);

-- Mensajes
create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid references public.conversations(id) on delete cascade,
  group_id         uuid references public.groups(id) on delete cascade,
  sender_id        uuid references public.users(id) on delete set null,
  reply_to_id      uuid references public.messages(id) on delete set null,
  content          text,
  type             text not null default 'text',
  is_edited        boolean default false,
  is_deleted       boolean default false,
  deleted_for_all  boolean default false,
  pinned_at        timestamp with time zone,
  created_at       timestamp with time zone default now(),
  updated_at       timestamp with time zone default now(),
  check (
    (conversation_id is not null and group_id is null) or
    (group_id is not null and conversation_id is null)
  )
);

-- Reacciones
create table if not exists public.message_reactions (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamp with time zone default now(),
  unique(message_id, user_id, emoji)
);

-- Adjuntos
create table if not exists public.attachments (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references public.messages(id) on delete cascade,
  storage_path  text not null,
  file_name     text not null,
  file_type     text not null,
  file_size     bigint,
  width         integer,
  height        integer,
  duration      integer,
  created_at    timestamp with time zone default now()
);

-- Estado de entrega/lectura
create table if not exists public.message_status (
  message_id    uuid not null references public.messages(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  delivered_at  timestamp with time zone,
  read_at       timestamp with time zone,
  primary key (message_id, user_id)
);

-- Bots
create table if not exists public.bots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  name        text not null,
  description text,
  webhook_url text,
  is_active   boolean default true,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamp with time zone default now(),
  updated_at  timestamp with time zone default now()
);

create table if not exists public.bot_tokens (
  id           uuid primary key default gen_random_uuid(),
  bot_id       uuid not null references public.bots(id) on delete cascade,
  token_hash   text not null unique,
  label        text,
  last_used_at timestamp with time zone,
  expires_at   timestamp with time zone,
  revoked_at   timestamp with time zone,
  created_at   timestamp with time zone default now()
);

-- Reportes
create table if not exists public.reports (
  id                   uuid primary key default gen_random_uuid(),
  reporter_id          uuid not null references public.users(id) on delete cascade,
  reported_user_id     uuid references public.users(id) on delete cascade,
  reported_message_id  uuid references public.messages(id) on delete cascade,
  reason               text not null,
  description          text,
  status               text default 'pending',
  created_at           timestamp with time zone default now(),
  reviewed_at          timestamp with time zone
);

-- Notificaciones
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  data        jsonb,
  is_read     boolean default false,
  created_at  timestamp with time zone default now()
);

-- Índices
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at desc);
create index if not exists idx_messages_group on public.messages(group_id, created_at desc);
create index if not exists idx_notifications_user on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_users_username on public.users(username);
create index if not exists idx_group_members_group on public.group_members(group_id);
create index if not exists idx_groups_community on public.groups(community_id);

-- Función para crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, phone, email, username, display_name)
  values (
    new.id,
    new.phone,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substring(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'display_name', 'Usuario')
  );

  insert into public.user_settings (user_id)
  values (new.id);

  return new;
end;
$$;

-- Trigger: crear perfil cuando se registra un usuario
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS: habilitar en todas las tablas
alter table public.users enable row level security;
alter table public.user_settings enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.notifications enable row level security;

-- Políticas básicas RLS
create policy "Usuarios pueden ver su propio perfil"
  on public.users for select using (auth.uid() = id);

create policy "Usuarios pueden actualizar su propio perfil"
  on public.users for update using (auth.uid() = id);

create policy "Usuarios pueden ver otros perfiles"
  on public.users for select using (true);

create policy "Ver notificaciones propias"
  on public.notifications for select using (auth.uid() = user_id);

create policy "Ver conversaciones propias"
  on public.conversation_members for select using (auth.uid() = user_id);

create policy "Ver mensajes de mis conversaciones"
  on public.messages for select using (
    (conversation_id is not null and exists (
      select 1 from public.conversation_members
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )) or
    (group_id is not null and exists (
      select 1 from public.group_members
      where group_id = messages.group_id and user_id = auth.uid()
    ))
  );

create policy "Enviar mensajes"
  on public.messages for insert with check (auth.uid() = sender_id);

create policy "Ver grupos donde soy miembro"
  on public.groups for select using (
    exists (
      select 1 from public.group_members
      where group_id = groups.id and user_id = auth.uid()
    )
  );
