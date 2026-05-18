-- Tabla para registrar fallos en generación/subida de PDFs.
-- Permite diagnosticar qué capa falló (Gotenberg, Supabase Storage, timeout) sin depender del navegador del cliente.

CREATE TABLE IF NOT EXISTS public.pdf_errors (
  id BIGSERIAL PRIMARY KEY,
  lead_name TEXT,
  lead_email TEXT,
  lead_phone TEXT,
  goal TEXT,
  stage TEXT NOT NULL,                -- 'gotenberg' | 'supabase_upload' | 'unknown'
  error_message TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdf_errors_created_at ON public.pdf_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdf_errors_stage ON public.pdf_errors(stage);

ALTER TABLE public.pdf_errors ENABLE ROW LEVEL SECURITY;

-- Permite que el navegador (anon key) inserte registros de error.
DROP POLICY IF EXISTS "anon_can_insert_pdf_errors" ON public.pdf_errors;
CREATE POLICY "anon_can_insert_pdf_errors"
  ON public.pdf_errors
  FOR INSERT
  TO anon
  WITH CHECK (true);
