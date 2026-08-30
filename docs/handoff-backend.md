# Handoff — Backend

> **Baca lebih dulu, berurutan:**
> 1. [`prd.md`](../prd.md) — lima fitur wajib
> 2. [`user-flow.md`](./user-flow.md) — alur, mesin status, aturan mesin readiness
> 3. [`data-contract.md`](./data-contract.md) — endpoint & bentuk data
> 4. [`web/lib/types.ts`](../web/lib/types.ts) — tipe, **beku, hanya baca**
>
> Dari PM · v1.0 · 30 Agustus 2026

---

## 0. Ringkas

Frontend punya tujuh layar bagus yang semua datanya hardcoded. Tugasmu: bikin datanya nyata.

Kamu membangun **Supabase + Prisma + Next.js Route Handlers** di dalam `web/`. Bukan repo terpisah, bukan server kedua. Frontend memanggil `/api/**` di origin yang sama.

**Kamu tidak menyentuh satu pun berkas UI.** Agent frontend sedang bekerja bersamaan di direktori yang sama. Batas kepemilikan ada di `data-contract.md` §4 — patuhi ketat.

Yang kamu miliki:

```
web/prisma/**          web/app/api/**        web/lib/server/**
web/lib/supabase/**    web/middleware.ts     web/.env.example
web/package.json       web/supabase/**
```

Yang **haram** kamu sentuh: `web/components/**`, `web/app/**` selain `app/api/**`, `web/lib/types.ts`, `web/lib/api-client.ts`, `web/lib/labels.ts`, `web/hooks/**`.

---

## 1. Stack — sudah diputuskan, jangan ditawar

| Bagian | Pilihan |
|---|---|
| Database | **Supabase Postgres** |
| Auth | **Supabase Auth** — email + password |
| ORM & migrasi | **Prisma**, schema `public` saja |
| API | **Next.js 16 Route Handlers** di `web/app/api/**` |
| Penyimpanan berkas | **Supabase Storage**, bucket privat `bukti` |
| Validasi | **Zod** (sudah ada di `package.json`) |
| LLM | Claude API (`@anthropic-ai/sdk`), model `claude-sonnet-5` |

Dependency yang perlu ditambahkan: `@supabase/supabase-js`, `@supabase/ssr`, `prisma` (dev), `@prisma/client`, `@anthropic-ai/sdk`, `tsx` (dev, untuk seed).

### Pembagian tugas Prisma vs Supabase Auth — penting

- **Supabase Auth memiliki schema `auth`.** Prisma tidak boleh mengelolanya. Jangan pernah menulis model untuk `auth.users`.
- **Prisma hanya mengelola schema `public`.**
- `profile.id` adalah UUID yang **nilainya sama dengan** `auth.users.id`, tanpa relasi Prisma. Tambahkan foreign key-nya lewat migrasi SQL manual:
  ```sql
  alter table public.profile
    add constraint profile_id_fkey
    foreign key (id) references auth.users(id) on delete cascade;
  ```
- Dua URL koneksi: `DATABASE_URL` (pooler, port 6543, `?pgbouncer=true`) untuk runtime, `DIRECT_URL` (port 5432) untuk migrasi. Kalau salah, `prisma migrate` akan menggantung — ini jebakan paling umum di Supabase.

### RLS

Aktifkan RLS di semua tabel `public` dengan kebijakan **deny-all**. Semua akses lewat Route Handler memakai service-role key, yang melewati RLS. Otorisasi ditegakkan **di lapisan API**, bukan RLS.

Alasannya: menulis kebijakan RLS yang benar untuk sepuluh tabel dengan dua peran memakan waktu berjam-jam dan gagal secara diam-diam. Otorisasi di API bisa dibaca, diuji, dan dijelaskan ke juri. Deny-all RLS tetap menutup kebocoran kalau ada yang tak sengaja memakai anon key.

**Service-role key tidak boleh menyentuh klien.** Hanya di Route Handler, hanya dari `process.env.SUPABASE_SERVICE_ROLE_KEY`, tanpa prefix `NEXT_PUBLIC_`.

---

## 2. Skema database

Prisma, schema `public`. Nama field pakai `camelCase`, `@@map` ke `snake_case`.

```
profile            id(uuid, = auth.users.id) · role · namaLengkap · telepon? · dibuatPada
business           id · ownerId→profile · nama · bentukLegal? · usiaTahun? · dibuatPada

case               id · kode(unik) · businessId→business · produk · tujuan
                   status · tahap · versiAssessment · targetEkspor?
                   dikirimPada? · ditinjauOlehId?→profile · ditinjauPada?
                   dibuatPada · diperbaruiPada

assessmentAnswer   id · caseId→case · questionId · dimensi
                   nilai(Json)  -- string | string[]
                   aktif(bool, default true)   -- false = pertanyaan tak lagi relevan
                   dijawabPada
                   @@unique([caseId, questionId])

readinessDimension id · caseId→case · dimensi · status · alasan
                   fakta(String[]) · belumAda · dihitungPada
                   @@unique([caseId, dimensi])

recommendation     id · caseId→case · versi · sumber(AI|OFFICER) · isi
                   ringkasan · tahap · tahapPenjelasan
                   keyakinan · alasanReview · alasanPerubahan?
                   dibuatOlehId?→profile · dibuatPada
                   @@unique([caseId, versi])

recFact            id · recommendationId→recommendation · label · nilai · asal · dikonfirmasi
recUnknown         id · recommendationId→recommendation · teks · dimensiTerkait(String[])
recSource          id · recommendationId→recommendation · judul · penerbit · tahun · mendukung · url?

task               id · caseId→case · recommendationId?→recommendation · urutan
                   dimensi? · judul · penjelasan · owner · buktiDibutuhkan
                   targetSelesai? · status · versi · dibuatPada · selesaiPada?

infoRequest        id · caseId→case · officerId→profile · judul · pesan
                   status · dibuatPada · dijawabPada?
infoResponse       id · requestId→infoRequest(unik) · pesan · olehId→profile · dibuatPada

evidence           id · caseId→case · taskId?→task · infoResponseId?→infoResponse
                   namaBerkas · storagePath · tipe · ukuranBytes
                   dikonfirmasi · diunggahOlehId→profile · diunggahPada

officerNote        id · caseId→case · officerId→profile · isi · dibuatPada
escalation         id · caseId→case · officerId→profile · kategori · alasan · dibuatPada

caseEvent          id · caseId→case · tipe · judul · aktorId?→profile · aktorLabel
                   ringkasan · versi? · internal(bool, default false) · pada
```

Catatan:

- `caseEvent.internal = true` untuk `CATATAN_PETUGAS`. Timeline UMKM menyaringnya keluar.
- `recommendation` **append-only.** `PUT .../rekomendasi` menyisipkan baris baru, tidak pernah `UPDATE`. Ini bukti officer-in-the-loop.
- `assessmentAnswer.aktif` menjaga jawaban lama saat percabangan berubah — lihat `user-flow.md` §5.3.
- Indeks: `case(status)`, `case(businessId)`, `case(kode)`, `caseEvent(caseId, pada)`, `assessmentAnswer(caseId)`.

---

## 3. Yang harus dibangun

### 3.1 Fondasi

- [ ] `prisma/schema.prisma` + migrasi awal + migrasi SQL untuk FK ke `auth.users`
- [ ] `lib/supabase/server.ts` — klien server (cookie-based, `@supabase/ssr`)
- [ ] `lib/supabase/admin.ts` — klien service-role, hanya untuk Route Handler
- [ ] `lib/server/db.ts` — singleton Prisma (pola global, aman untuk hot reload)
- [ ] `lib/server/auth.ts` — `getSessionUser()`, `requireUser()`, `requireRole(role)`, `requireCaseAccess(kode, user)`
- [ ] `lib/server/response.ts` — `ok(data)`, `fail(code, message, details?)` yang menghasilkan amplop di `data-contract.md` §1
- [ ] `middleware.ts` — refresh sesi + jaga rute (`user-flow.md` §4)
- [ ] `.env.example` — semua variabel, tanpa nilai rahasia

Variabel lingkungan:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=          # pooler :6543 ?pgbouncer=true
DIRECT_URL=            # langsung :5432
ANTHROPIC_API_KEY=
```

### 3.2 Mesin aturan — `lib/server/engine/`

Ini inti produk. **Deterministik, tanpa LLM.** Semua aturan ada lengkap di `user-flow.md` §7 — implementasikan persis, jangan berimprovisasi.

- [ ] `questions.ts` — 13 pertanyaan dasar (salin persis dari `components/jalurekspor-assessment.tsx` baris 37–51: id, title, type, options, glossary, placeholder, description, supportsUnknown, supportsNotOwned) + 7 pertanyaan bersyarat dari `user-flow.md` §7.1. Setiap pertanyaan bersyarat punya predikat `condition(answers)`.
- [ ] `visible-questions.ts` — evaluasi syarat → daftar pertanyaan terlihat, urut kanonis dimensi lalu urutan definisi.
- [ ] `readiness.ts` — enam fungsi status, satu per dimensi, aturan berurutan dari `user-flow.md` §7.2.
- [ ] `next-actions.ts` — pemilihan berbobot + urutan kanonis + tabel template `(dimensi, status) → {judul, kenapa, owner, buktiDibutuhkan, prioritas}`. **Maksimal tiga, dijaga oleh kode, bukan oleh niat baik.**
- [ ] `blocker.ts` — dimensi berbobot tertinggi untuk antrean petugas.

**Uji sanitasi wajib:** masukkan jawaban seed dari `user-flow.md` §8, keluarannya harus persis
`legalitas=ready, produk=pending, pasar=working, hs-lartas=officer, dokumen=blocked, eksekusi=idle`
dan next action `produk → hs-lartas → dokumen`. Kalau tidak cocok, aturanmu salah, bukan dokumennya. Tulis ini sebagai skrip kecil yang bisa dijalankan (`pnpm tsx scripts/verify-engine.ts`) dan laporkan hasilnya.

### 3.3 Lapisan LLM — `lib/server/ai/`

- [ ] `draft.ts` — terima jawaban + enam status dimensi + tiga aksi terpilih, hasilkan JSON terstruktur (`ringkasan`, `alasan`/`belumAda` per dimensi, `fakta[]`, `belumDiketahui[]`, `keyakinan`, `sumberReferensi[]`).
- [ ] Batasan wajib di prompt: dilarang menyebut HS Code spesifik sebagai kesimpulan, dilarang menyatakan status Lartas final, dilarang menyatakan PEB disetujui, wajib Bahasa Indonesia awam, wajib menjelaskan istilah teknis.
- [ ] Validasi keluaran LLM dengan Zod. Kalau tidak lolos → fallback.
- [ ] **`fallback.ts` — template deterministik per `(dimensi, status)`, `keyakinan = "rendah"`.** Dipakai saat API mati, timeout (batasi 20 detik), atau keluaran tak valid.

> LLM **tidak pernah** menentukan status dimensi, pemilihan next action, atau transisi status. Ia hanya menulis narasi. Kalau kamu tergoda memberinya keputusan, jangan — itu melanggar PRD #3 dan membuat demo tidak dapat diulang.

Fallback bukan pilihan opsional. Demo akan berjalan di WiFi hackathon.

### 3.4 Endpoint

Bangun **persis** seperti `data-contract.md` §3. Urutan yang saya sarankan — tiap kelompok membuka satu layar frontend:

1. **Auth** — `POST /api/auth/daftar`, `/masuk`, `/keluar`, `GET /api/saya`
2. **Kasus** — `GET /api/kasus`, `POST /api/kasus`, `GET /api/kasus/[kode]`, `POST .../kirim`
3. **Assessment** — `GET .../assessment`, `PUT .../assessment/jawaban`
4. **Kesiapan** — `GET .../kesiapan`
5. **Petugas** — `GET .../draft`, `POST .../catatan`, `POST .../permintaan-info`, `PUT .../rekomendasi`, `POST .../eskalasi`, `POST .../rencana`
6. **Permintaan info** — `GET /api/permintaan/[id]`, `POST .../jawab`
7. **Tugas & riwayat** — `GET .../tugas`, `PATCH /api/tugas/[id]`, `POST /api/tugas/[id]/bukti`, `GET .../riwayat`

Kirim kabar ke PM setelah kelompok 1–2 mendarat, jangan tunggu semuanya selesai — frontend butuh tahu kapan bisa mulai uji nyata.

### 3.5 Seed — `prisma/seed.ts`

Reproduksi **persis** `user-flow.md` §8. Ini yang menentukan demo terlihat benar.

- Empat akun (1 petugas, 3 UMKM), password `Demo1234!`, dibuat lewat Supabase Admin API lalu `profile` + `business`-nya di Prisma.
- `LE-0248` Lereng Lawu Foods dengan 15 jawaban seed, status **`DRAFT`**.
- `KA-0172` Kriya Aruna Solo → Jepang, blocker Legalitas, status `MENUNGGU_TINJAUAN`, `hariMenunggu` 2.
- `BS-0311` Batik Sembada → Malaysia, blocker Dokumen, status `ESKALASI`, `hariMenunggu` 4.
- Untuk dua kasus terakhir: jalankan mesin aturan sungguhan supaya dimensi & next action-nya konsisten. Jangan tulis tangan.
- `LE-0248` dibiarkan `DRAFT` supaya demo bisa dimulai dari langkah pertama (`user-flow.md` §9).
- Seed harus **idempoten** — dijalankan dua kali tidak menggandakan apa pun.

### 3.6 Aturan bisnis yang mudah terlewat

- [ ] **Gerbang officer-in-the-loop.** `POST .../rencana` menolak `422` kalau ada dimensi `officer` yang belum petugas sentuh — belum ada `officerNote`, belum ada `recommendation` bersumber `OFFICER`, dan belum ada `infoRequest` untuk kasus itu. `details.dimensiBelumDitinjau` berisi daftarnya. Ini demo poin, jangan dilewat.
- [ ] **Kasus milik orang lain → `404`, bukan `403`.**
- [ ] **`catatanInternal` tidak pernah masuk respons UMKM.** Saring di server.
- [ ] **`caseEvent` internal tidak pernah masuk riwayat UMKM.**
- [ ] **`rencana` hanya untuk status `RENCANA_TERKIRIM`/`SELESAI`.**
- [ ] **`PATCH /api/tugas/[id]` menolak `403`** kalau `owner = "PETUGAS"`.
- [ ] **Transisi status divalidasi terhadap tabel** di `user-flow.md` §3. Di luar tabel → `409`. Taruh di satu tempat (`lib/server/case-state.ts`), jangan tersebar di tiap route.
- [ ] **Setiap aksi yang mengubah keadaan menulis satu `caseEvent`.** Tanpa ini PRD #5 kosong.
- [ ] Unggah berkas: maks 5 × 5 MB, tipe `pdf, jpg, jpeg, png, zip`. Tolak `400` kalau melanggar. Signed URL 1 jam.

---

## 4. Cara kerja

- **Jangan menunggu frontend.** Kamu punya kontrak lengkap.
- Uji tiap endpoint dengan `curl` setelah selesai. Sertakan contoh perintah + keluaran nyata di laporan akhirmu — bukan klaim "sudah bekerja".
- **Jangan menyunting berkas UI, walau kelihatan rusak.** Catat, laporkan ke PM.
- Kalau butuh dependency, kamu memiliki `package.json` — silakan pasang.
- Kalau kontrak terasa keliru: **jangan diam-diam menyimpang.** Implementasikan sesuai kontrak, catat keberatanmu di §6 laporan, biar PM yang memutuskan. Frontend sedang menulis kode terhadap bentuk yang sama; menyimpang sepihak akan merusak dua sisi sekaligus.
- Jalankan `pnpm build` sebelum lapor. Harus lolos.

---

## 5. Selesai berarti

- `pnpm build` lolos tanpa error TypeScript.
- `prisma migrate dev` dan `prisma db seed` jalan bersih di database kosong.
- Skrip verifikasi mesin aturan lolos untuk skenario seed.
- Semua endpoint di `data-contract.md` §3 ada dan mengembalikan bentuk yang dijanjikan.
- Login dua peran bekerja; middleware benar-benar menolak akses lintas peran.
- Tidak ada satu pun berkas UI yang berubah (`git status` bersih di `components/` dan `app/` selain `app/api/`).

---

## 6. Laporan akhir — tulis ini untuk PM

1. Endpoint yang selesai vs yang belum
2. Hasil skrip verifikasi mesin aturan (tempelkan keluarannya)
3. Contoh `curl` untuk tiga alur utama: daftar+masuk, kirim kasus, kirim rencana
4. Langkah setup yang harus PM jalankan (proyek Supabase, isi `.env`, migrasi, seed)
5. **Penyimpangan dari kontrak, kalau ada, beserta alasannya**
6. Keberatan atau usulan perbaikan kontrak
7. Apa yang belum diuji

---

## 7. Pertanyaan terbuka

*(Tambahkan di sini kalau kontrak kurang untuk sebuah endpoint. Jangan mengarang field.)*
