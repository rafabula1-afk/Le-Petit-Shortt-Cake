-- ============================================================
-- Le Petit Shortt Cake — esquema de Supabase
-- Ejecutar una sola vez en SQL Editor (Supabase Dashboard).
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Tablas ----------

create table if not exists public.ordenes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  created_at timestamptz not null default now(),
  delivery_date date not null,

  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  customer_address text,
  customer_notes text,

  delivery_type text,

  total numeric(10, 2) not null default 0,

  payment_method text not null,
  payment_note text,
  proof_path text,
  proof_paths text[] not null default '{}',

  status text not null default 'pendiente_verificacion',
  delivery_status text not null default 'por_asignar',
  history jsonb not null default '[]'::jsonb,
  delivery_history jsonb not null default '[]'::jsonb
);

create table if not exists public.orden_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.ordenes(id) on delete cascade,
  product_id text,
  name text not null,
  price numeric(10, 2) not null,
  qty integer not null
);

create index if not exists orden_items_order_id_idx on public.orden_items(order_id);
create index if not exists ordenes_delivery_date_idx on public.ordenes(delivery_date);

-- ---------- Numeración de pedidos ----------

create table if not exists public.order_counters (
  year integer primary key,
  last_value integer not null default 0
);

alter table public.order_counters enable row level security;

create or replace function public.next_order_number(p_prefix text default 'LPSC')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::integer;
  v_next integer;
begin
  insert into public.order_counters (year, last_value)
  values (v_year, 1)
  on conflict (year) do update
    set last_value = public.order_counters.last_value + 1
  returning last_value into v_next;

  return p_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 3, '0');
end;
$$;

revoke all on function public.next_order_number(text) from public;
grant execute on function public.next_order_number(text) to anon, authenticated;

-- ---------- Seguridad (RLS) ----------

alter table public.ordenes enable row level security;
alter table public.orden_items enable row level security;

-- Permite volver a ejecutar este archivo sin duplicar políticas.
drop policy if exists "publico_crea_pedidos" on public.ordenes;
drop policy if exists "publico_crea_items" on public.orden_items;
drop policy if exists "admin_lee_pedidos" on public.ordenes;
drop policy if exists "admin_edita_pedidos" on public.ordenes;
drop policy if exists "admin_borra_pedidos" on public.ordenes;
drop policy if exists "admin_lee_items" on public.orden_items;
drop policy if exists "admin_edita_items" on public.orden_items;
drop policy if exists "admin_borra_items" on public.orden_items;

-- El público puede CREAR pedidos, pero no leerlos.
create policy "publico_crea_pedidos"
  on public.ordenes for insert to anon
  with check (true);

create policy "publico_crea_items"
  on public.orden_items for insert to anon
  with check (true);

-- Solo la administradora autenticada puede ver, editar y borrar.
create policy "admin_lee_pedidos"
  on public.ordenes for select to authenticated using (true);
create policy "admin_edita_pedidos"
  on public.ordenes for update to authenticated using (true) with check (true);
create policy "admin_borra_pedidos"
  on public.ordenes for delete to authenticated using (true);

create policy "admin_lee_items"
  on public.orden_items for select to authenticated using (true);
create policy "admin_edita_items"
  on public.orden_items for update to authenticated using (true) with check (true);
create policy "admin_borra_items"
  on public.orden_items for delete to authenticated using (true);

-- Permisos de tabla (RLS sigue aplicando).
grant usage on schema public to anon, authenticated;
grant insert on public.ordenes, public.orden_items to anon;
grant select, insert, update, delete on public.ordenes, public.orden_items to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- ---------- Comprobantes (Storage privado) ----------

insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

drop policy if exists "cliente_sube_comprobante" on storage.objects;
drop policy if exists "admin_ve_comprobantes" on storage.objects;
drop policy if exists "admin_borra_comprobantes" on storage.objects;

-- El cliente puede subir su comprobante; solo el admin puede verlo/borrarlo.
create policy "cliente_sube_comprobante"
  on storage.objects for insert to anon
  with check (bucket_id = 'comprobantes');

create policy "admin_ve_comprobantes"
  on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes');

create policy "admin_borra_comprobantes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'comprobantes');

-- ---------- Realtime (para que el panel se actualice solo) ----------

do $$
begin
  alter publication supabase_realtime add table public.ordenes;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.orden_items;
exception
  when duplicate_object then null;
end $$;

-- ============================================================
-- Verificación rápida después de ejecutar:
--   select id, number, status from public.ordenes;
--   select id, name from storage.buckets where id = 'comprobantes';
-- ============================================================
