-- Permite guardar hasta 3 capturas de pago por pedido.
-- proof_path se conserva para pedidos anteriores.

alter table public.ordenes
  add column if not exists proof_paths text[] not null default '{}';
