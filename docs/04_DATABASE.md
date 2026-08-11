# 04 — Modelo de Base de Datos

**Versión:** 0.1
**Estado:** Definición inicial para MVP
**Motor:** PostgreSQL (via Supabase)

---

## Convenciones

- Todos los IDs son `uuid` generados por la base de datos (`gen_random_uuid()`).
- Todas las tablas tienen `created_at timestamp with time zone default now()`.
- Los campos de texto usan `text` salvo que se indique un límite explícito.
- Las relaciones usan claves foráneas con `on delete cascade` o `set null` según corresponda.
- Row Level Security (RLS) de Supabase se aplica en todas las tablas.

---

## Diagrama general

```
users
  ├── profiles (1:1)
  ├── conversations (many-to-many via conversation_members)
  ├── messages (1:many)
  ├── group_members (many-to-many)
  └── community_members (many-to-many)

conversations
  └── messages (1:many)

groups
  ├── group_members (1:many)
  ├── messages (1:many)
  └── community_id (FK → communities, opcional)

communities
  ├── community_members (1:many)
  ├── channels (1:many)  ← grupos dentro de la comunidad
  └── bots (many-to-many via community_bots)

bots
  └── bot_tokens (1:many)

messages
  ├── attachments (1:many)
  └── reactions (1:many)
```

---

## Tablas

---

### `users`
Cuenta de cada usuario. Manejada principalmente por Supabase Auth.

```sql
create table users (
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
```

**Notas:**
- `id` referencia al usuario en `auth.users` de Supabase.
- `phone` puede ser null si en el futuro se permite registro solo por email.
- `username` es único y público (`@usuario`).
- `is_bot` distingue cuentas de bots de usuarios reales.

---

### `user_settings`
Configuración de privacidad y preferencias de cada usuario.

```sql
create table user_settings (
  user_id                   uuid primary key references users(id) on delete cascade,
  who_can_message_me        text default 'everyone',  -- 'everyone' | 'contacts' | 'nobody'
  who_can_add_to_groups     text default 'everyone',  -- 'everyone' | 'contacts' | 'nobody'
  show_phone_to             text default 'nobody',    -- 'everyone' | 'contacts' | 'nobody'
  show_last_seen_to         text default 'everyone',
  show_avatar_to            text default 'everyone',
  notifications_enabled     boolean default true,
  created_at                timestamp with time zone default now(),
  updated_at                timestamp with time zone default now()
);
```

---

### `user_blocks`
Usuarios bloqueados.

```sql
create table user_blocks (
  id           uuid primary key default gen_random_uuid(),
  blocker_id   uuid not null references users(id) on delete cascade,
  blocked_id   uuid not null references users(id) on delete cascade,
  created_at   timestamp with time zone default now(),
  unique(blocker_id, blocked_id)
);
```

---

### `conversations`
Chat privado entre dos usuarios (1:1).

```sql
create table conversations (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamp with time zone default now()
);
```

### `conversation_members`
Los dos participantes de cada conversación.

```sql
create table conversation_members (
  conversation_id   uuid not null references conversations(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  last_read_at      timestamp with time zone,
  is_archived       boolean default false,
  primary key (conversation_id, user_id)
);
```

---

### `groups`
Grupos de chat (múltiples miembros).

```sql
create table groups (
  id             uuid primary key default gen_random_uuid(),
  community_id   uuid references communities(id) on delete set null,  -- null si es grupo independiente
  name           text not null,
  description    text,
  avatar_url     text,
  invite_link    text unique,
  is_channel     boolean default false,   -- true: solo admins/bots publican (canal de avisos)
  is_archived    boolean default false,
  created_by     uuid references users(id) on delete set null,
  created_at     timestamp with time zone default now(),
  updated_at     timestamp with time zone default now()
);
```

**Notas:**
- `community_id` permite que un grupo pertenezca a una comunidad.
- `is_channel = true` → canal de solo lectura para miembros (avisos).

---

### `group_members`
Miembros de cada grupo con su rol.

```sql
create table group_members (
  group_id    uuid not null references groups(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  role        text not null default 'member',  -- 'admin' | 'moderator' | 'member' | 'bot'
  is_banned   boolean default false,
  is_muted    boolean default false,
  joined_at   timestamp with time zone default now(),
  primary key (group_id, user_id)
);
```

---

### `communities`
Estructura que agrupa múltiples grupos/canales bajo una organización.

```sql
create table communities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  avatar_url    text,
  invite_link   text unique,
  is_public     boolean default false,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamp with time zone default now(),
  updated_at    timestamp with time zone default now()
);
```

---

### `community_members`
Miembros de cada comunidad.

```sql
create table community_members (
  community_id   uuid not null references communities(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  role           text not null default 'member',  -- 'owner' | 'admin' | 'moderator' | 'member'
  joined_at      timestamp with time zone default now(),
  primary key (community_id, user_id)
);
```

---

### `messages`
Todos los mensajes: chats privados, grupos y canales.

```sql
create table messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid references conversations(id) on delete cascade,
  group_id          uuid references groups(id) on delete cascade,
  sender_id         uuid not null references users(id) on delete set null,
  reply_to_id       uuid references messages(id) on delete set null,
  content           text,                          -- null si es solo multimedia
  type              text not null default 'text',  -- 'text' | 'image' | 'audio' | 'video' | 'file' | 'system'
  is_edited         boolean default false,
  is_deleted        boolean default false,
  deleted_for_all   boolean default false,
  pinned_at         timestamp with time zone,
  created_at        timestamp with time zone default now(),
  updated_at        timestamp with time zone default now(),
  check (
    (conversation_id is not null and group_id is null) or
    (group_id is not null and conversation_id is null)
  )
);
```

**Notas:**
- Un mensaje pertenece a una conversación privada **o** a un grupo, nunca a ambos.
- `is_deleted + deleted_for_all` maneja los dos modos de eliminación.
- `type = 'system'` para mensajes de sistema ("Juan se unió al grupo").

---

### `message_reactions`
Reacciones a mensajes.

```sql
create table message_reactions (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references messages(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  emoji        text not null,
  created_at   timestamp with time zone default now(),
  unique(message_id, user_id, emoji)
);
```

---

### `attachments`
Archivos adjuntos a mensajes (imágenes, audios, documentos, etc.).

```sql
create table attachments (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references messages(id) on delete cascade,
  storage_path  text not null,   -- path en Supabase Storage
  file_name     text not null,
  file_type     text not null,   -- MIME type
  file_size     bigint,          -- bytes
  width         integer,         -- para imágenes/videos
  height        integer,
  duration      integer,         -- segundos, para audios/videos
  created_at    timestamp with time zone default now()
);
```

---

### `message_status`
Estado de entrega y lectura por usuario (chats privados).

```sql
create table message_status (
  message_id    uuid not null references messages(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  delivered_at  timestamp with time zone,
  read_at       timestamp with time zone,
  primary key (message_id, user_id)
);
```

---

### `bots`
Cuentas de bots conectadas a la plataforma.

```sql
create table bots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,  -- la cuenta de usuario del bot
  name          text not null,
  description   text,
  webhook_url   text,          -- URL donde Mi Mensajero envía eventos
  is_active     boolean default true,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamp with time zone default now(),
  updated_at    timestamp with time zone default now()
);
```

---

### `bot_tokens`
Tokens de acceso a la API para cada bot.

```sql
create table bot_tokens (
  id           uuid primary key default gen_random_uuid(),
  bot_id       uuid not null references bots(id) on delete cascade,
  token_hash   text not null unique,   -- hash del token, nunca el token en claro
  label        text,
  last_used_at timestamp with time zone,
  expires_at   timestamp with time zone,
  revoked_at   timestamp with time zone,
  created_at   timestamp with time zone default now()
);
```

---

### `community_bots`
Bots habilitados en una comunidad con sus permisos.

```sql
create table community_bots (
  community_id   uuid not null references communities(id) on delete cascade,
  bot_id         uuid not null references bots(id) on delete cascade,
  can_post        boolean default true,
  can_post_announcements boolean default false,
  can_moderate    boolean default false,
  added_by       uuid references users(id) on delete set null,
  added_at       timestamp with time zone default now(),
  primary key (community_id, bot_id)
);
```

---

### `reports`
Reportes de usuarios o mensajes.

```sql
create table reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null references users(id) on delete cascade,
  reported_user_id uuid references users(id) on delete cascade,
  reported_message_id uuid references messages(id) on delete cascade,
  reason          text not null,   -- 'spam' | 'harassment' | 'inappropriate' | 'other'
  description     text,
  status          text default 'pending',   -- 'pending' | 'reviewed' | 'resolved' | 'dismissed'
  created_at      timestamp with time zone default now(),
  reviewed_at     timestamp with time zone
);
```

---

### `notifications`
Notificaciones pendientes de entrega.

```sql
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  type         text not null,   -- 'message' | 'mention' | 'reply' | 'group_invite' | 'community_invite' | 'announcement'
  title        text not null,
  body         text,
  data         jsonb,           -- payload extra (group_id, message_id, etc.)
  is_read      boolean default false,
  created_at   timestamp with time zone default now()
);
```

---

## Índices recomendados

```sql
-- Mensajes por conversación (paginación)
create index on messages(conversation_id, created_at desc);

-- Mensajes por grupo (paginación)
create index on messages(group_id, created_at desc);

-- Notificaciones por usuario
create index on notifications(user_id, is_read, created_at desc);

-- Búsqueda de usuario por username
create index on users(username);

-- Miembros de un grupo
create index on group_members(group_id);

-- Grupos de una comunidad
create index on groups(community_id);
```

---

## Notas de escalabilidad

- Para V1 (5–1.000 usuarios) esta estructura es más que suficiente.
- Los mensajes de grupos grandes podrían requerir particionado por `created_at` en el futuro.
- El historial de mensajes antiguo puede archivarse en cold storage pasado cierto tiempo.
- Si la tabla `messages` crece mucho, se puede separar `group_messages` de `private_messages`.

---

*Siguiente etapa: [05_SECURITY.md](./05_SECURITY.md)*
