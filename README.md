# JalurEkspor (Expora)

Asisten kesiapan ekspor untuk UMKM Indonesia — menilai kesiapan ekspor lintas enam dimensi, memberi draf rekomendasi AI yang bisa ditelusuri sumbernya, lalu **memaksa petugas manusia meninjau sebelum rencana pendampingan dikirim**. AI menulis narasi, bukan yang memutuskan.

**🔴 Demo live:** https://expora-nine.vercel.app
**🎥 Video demo (5 menit):** https://youtu.be/0snbV1VZoXI

---

## Masalah yang diselesaikan

UMKM yang siap ekspor sering tersendat bukan karena produknya kurang bagus, tapi karena tidak tahu persis di mana mereka berhenti — legalitas, dokumen, atau klasifikasi barang. Skor kesiapan tunggal menyembunyikan masalah itu. JalurEkspor memetakan enam dimensi kesiapan secara terpisah, dan menjaga agar keputusan penting (klasifikasi HS, status Lartas, persetujuan PEB) tetap di tangan petugas — AI hanya menulis penjelasan berbasis fakta yang sudah dihitung mesin aturan deterministik.

## Lima fitur inti (PRD)

1. **Assessment kesiapan adaptif** — enam dimensi (legalitas usaha, produk & kapasitas, pasar tujuan, HS & Lartas, dokumen ekspor, eksekusi ekspor), pertanyaan bercabang sesuai jawaban, tanpa skor tunggal.
2. **Next action personal** — maksimal tiga aksi prioritas per kasus, dipilih mesin aturan (bukan AI), dengan alasan dan bukti yang dibutuhkan.
3. **Draf AI yang bisa ditelusuri** — setiap rekomendasi menyertakan fakta pendukung, informasi yang belum diketahui, tingkat keyakinan, dan referensi sumber. AI tidak pernah menyebut HS Code final, status Lartas final, atau PEB disetujui.
4. **Officer-in-the-loop wajib** — mengirim rencana pendampingan **ditolak (422)** kalau ada dimensi yang perlu keahlian petugas belum benar-benar disentuh. Ini bukan bug, ini fitur inti (25% bobot penilaian brief).
5. **Riwayat & progres tersimpan** — seluruh perjalanan kasus (assessment, tinjauan, permintaan info, tugas selesai) tersimpan sebagai satu linimasa, UMKM tidak pernah mulai dari nol.

## Akun demo

Buka `/masuk` dan klik kartu akun demo untuk isi otomatis, atau pakai kredensial berikut:

| Peran | Email | Password |
|---|---|---|
| UMKM (Lereng Lawu Foods) | `umkm@jalurekspor.id` | `Demo1234!` |
| Petugas | `petugas@jalurekspor.id` | `Demo1234!` |

Dua akun UMKM tambahan (`kriya@jalurekspor.id`, `batik@jalurekspor.id`) tersedia untuk melihat kasus di status lain (`MENUNGGU_TINJAUAN`, `ESKALASI`).

## Tumpukan teknologi

- **Next.js 16** (App Router, Turbopack) + **React 19** + TypeScript
- **Tailwind CSS v4**
- **Supabase** — Postgres, Auth (email/password), Storage (bucket privat untuk bukti, signed URL)
- **Prisma** — schema `public` saja, RLS deny-all di database, otorisasi ditegakkan di lapisan API
- **OpenRouter** (`minimax/minimax-m3:free`) untuk narasi draf AI, dengan retry otomatis dan **fallback deterministik** kalau LLM gagal/lambat/mati — demo tetap jalan tanpa API AI

## Struktur proyek

```
docs/                    Dokumen produk & kontrak — mulai dari sini
  prd.md                 PRD ringkas (5 fitur wajib)
  user-flow.md            Alur, mesin status, skenario seed & demo
  data-contract.md        Kontrak tipe & endpoint API + log keputusan PM
  demo-video-script.md    Skrip video demo 5 menit, per-halaman
web/                      Aplikasi Next.js
  app/                    Rute (App Router) — layar + app/api/**
  lib/server/             Logika server: mesin aturan, auth, lapisan AI
  lib/server/engine/      Mesin kesiapan deterministik (tanpa LLM)
  prisma/                 Schema, migrasi, seed
  scripts/verify-engine.ts  Skrip verifikasi mesin aturan (jalan tanpa DB)
```

## Menjalankan lokal

```bash
cd web
pnpm install
cp .env.example .env   # isi kredensial Supabase, DB, dan OpenRouter — lihat komentar di file
pnpm exec prisma migrate dev
pnpm exec prisma db seed
pnpm dev
```

Verifikasi cepat tanpa perlu database:

```bash
pnpm exec tsx scripts/verify-engine.ts   # mesin aturan, 29 pemeriksaan
pnpm build                               # build produksi
```

## Catatan desain

- **Tidak ada skor kesiapan tunggal** — dilarang eksplisit oleh PRD.
- Setiap perubahan status kasus tercatat sebagai satu `caseEvent`; transisi status divalidasi terhadap satu tabel di `lib/server/case-state.ts`, tidak tersebar di tiap rute.
- Catatan internal petugas tidak pernah masuk respons UMKM.
- Kasus milik pengguna lain mengembalikan `404`, bukan `403` — tidak membocorkan keberadaan data.
