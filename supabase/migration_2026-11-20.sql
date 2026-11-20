-- ============================================================
-- Le Petit Shortt Cake — limpieza de datos de pago/entrega
-- Ejecutar UNA SOLA VEZ en Supabase → SQL Editor.
-- Borra los campos que el sitio ya no usa.
-- ============================================================

alter table public.ordenes
  drop column if exists delivery_service,
  drop column if exists delivery_contact,
  drop column if exists payment_reference,
  drop column if exists payment_extra;

-- Verificación rápida: estas columnas ya NO deben aparecer.
-- select column_name
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'ordenes'
--   and column_name in (
--     'delivery_service',
--     'delivery_contact',
--     'payment_reference',
--     'payment_extra'
--   );
