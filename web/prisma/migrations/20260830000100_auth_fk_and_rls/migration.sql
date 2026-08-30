-- JalurEkspor — migrasi manual.
--
-- Dua hal yang tidak bisa dinyatakan lewat schema.prisma:
--   1. Foreign key dari public.profile ke auth.users (schema `auth` milik Supabase
--      Auth; Prisma tidak boleh memodelkannya).
--   2. Row Level Security deny-all di seluruh tabel public.
--
-- Otorisasi sebenarnya ditegakkan di lapisan API (lib/server/auth.ts).
-- RLS deny-all di sini adalah jaring pengaman: kalau ada kode yang tidak sengaja
-- memakai anon key, ia tidak bisa membaca apa pun.
-- Route Handler memakai service-role key yang melewati RLS by design.

-- ---------------------------------------------------------------------------
-- 1. profile.id === auth.users.id
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'auth' AND table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profile_id_fkey')
  THEN
    ALTER TABLE public.profile
      ADD CONSTRAINT profile_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. RLS deny-all. Tidak ada satu pun POLICY yang dibuat — itu memang tujuannya.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profile              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."case"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_answer    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readiness_dimension  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rec_fact             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rec_unknown          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rec_source           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.info_request         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.info_response        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officer_note         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_event           ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Bucket privat `bukti` untuk unggahan bukti.
--    Kalau blok ini gagal karena izin, seed akan membuat bucket lewat
--    Storage API sebagai cadangan (prisma/seed.ts).
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'storage' AND table_name = 'buckets')
  THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('bukti', 'bukti', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Lewati pembuatan bucket storage; akan dibuat oleh seed.';
END
$$;
