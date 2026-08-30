# JalurEkspor — Kontrak Data & API

> **Dibaca oleh frontend DAN backend.** Ini perjanjian antara keduanya.
> Turunan dari [`user-flow.md`](./user-flow.md).
>
> Bentuk TypeScript-nya ada di **`web/lib/types.ts`** — file itu **dibekukan**.
> Kedua agent mengimpor darinya; **tidak ada agent yang boleh mengubahnya**.
> Kalau tipe terasa salah, hentikan pekerjaan dan laporkan ke PM.
>
> Status: **v1.0 · 30 Agustus 2026**

---

## 1. Aturan umum

- Base path: `/api`. Semua di `web/app/api/**/route.ts`.
- Semua request & response `application/json`, kecuali unggah berkas (`multipart/form-data`).
- Semua tanggal-waktu **ISO 8601 UTC** (`2026-08-30T09:14:00.000Z`). **Backend tidak pernah mengirim tanggal yang sudah diformat.** Frontend yang memformat ke `id-ID`.
- Uang dan angka dikirim sebagai `number`, bukan string berformat.
- Autentikasi lewat **cookie sesi Supabase httpOnly**. Frontend tidak pernah menyentuh token, tidak pernah mengirim header `Authorization`.
- Semua request `fetch` dari klien memakai `credentials: "include"`.
- `[kode]` di URL adalah **kode kasus huruf kecil** (`le-0248`). Backend menerima huruf besar/kecil.

### Amplop respons

Sukses — payload langsung, tanpa pembungkus:

```json
{ "id": "...", "kode": "LE-0248" }
```

Gagal — selalu bentuk ini:

```json
{
  "error": {
    "code": "TRANSISI_TIDAK_VALID",
    "message": "Kasus sudah dikirim dan tidak bisa dikirim ulang.",
    "details": { "statusSaatIni": "MENUNGGU_TINJAUAN" }
  }
}
```

`message` **selalu Bahasa Indonesia dan layak ditampilkan apa adanya ke pengguna.** Frontend menampilkannya langsung; frontend tidak menyusun teks error sendiri.

### Kode status

| Kode | Kapan |
|---|---|
| `200` | Sukses |
| `201` | Sumber daya dibuat |
| `400` | Body/param tidak valid (`VALIDASI_GAGAL`, `details` berisi isu per field dari Zod) |
| `401` | Belum login (`BELUM_MASUK`) |
| `403` | Role salah (`AKSES_DITOLAK`) |
| `404` | Tidak ada, **atau ada tapi bukan milik pengguna** (`TIDAK_DITEMUKAN`) |
| `409` | Transisi status tidak sah (`TRANSISI_TIDAK_VALID`) |
| `422` | Aturan bisnis menolak (`ATURAN_BISNIS`) — mis. kirim rencana sebelum meninjau dimensi `officer` |
| `500` | Kesalahan tak terduga (`KESALAHAN_SERVER`) |

**404 dipakai untuk kasus milik orang lain**, bukan 403. Jangan bocorkan keberadaan kasus.

---

## 2. Enum — string persis

Salah ketik di sini = bug diam-diam. Semua berasal dari `web/lib/types.ts`.

```ts
Role            = "UMKM" | "PETUGAS"
CaseStatus      = "DRAFT" | "MENUNGGU_TINJAUAN" | "MENUNGGU_UMKM"
                | "ESKALASI" | "RENCANA_TERKIRIM" | "SELESAI"
NextActionBy    = "UMKM" | "PETUGAS" | null
Dimension       = "legalitas" | "produk" | "pasar" | "hs-lartas" | "dokumen" | "eksekusi"
DimensionStatus = "ready" | "pending" | "working" | "officer" | "blocked" | "idle"
QuestionType    = "text" | "number" | "select" | "yesno" | "multi"
TaskStatus      = "OPEN" | "IN_PROGRESS" | "READY_FOR_REVIEW" | "COMPLETED"
TaskOwner       = "UMKM" | "PETUGAS" | "UMKM_DAN_PENDAMPING"
RecommendationSource = "AI" | "OFFICER"
Confidence      = "rendah" | "sedang" | "tinggi"
InfoRequestStatus = "TERBUKA" | "DIJAWAB"
CaseEventType   = "KASUS_DIBUAT" | "ASSESSMENT_SELESAI" | "DIKIRIM_TINJAUAN"
                | "DRAFT_AI_DIBUAT" | "CATATAN_PETUGAS" | "INFO_DIMINTA"
                | "INFO_DIJAWAB" | "REKOMENDASI_DIEDIT" | "KASUS_DIESKALASI"
                | "RENCANA_DIKIRIM" | "TUGAS_SELESAI" | "BUKTI_DIUNGGAH"
```

**Label tampilan adalah urusan frontend.** Backend tidak pernah mengirim `"Siap Ditinjau"`; ia mengirim `"ready"`. Peta label ada di `web/lib/labels.ts` (milik frontend).

---

## 3. Endpoint

### 3.1 Autentikasi

| Method | Path | Role | Keterangan |
|---|---|---|---|
| `POST` | `/api/auth/daftar` | publik | Daftar UMKM baru |
| `POST` | `/api/auth/masuk` | publik | Login |
| `POST` | `/api/auth/keluar` | login | Logout |
| `GET` | `/api/saya` | login | Profil pengguna saat ini |

**`POST /api/auth/daftar`**
```jsonc
// request
{ "namaPemilik": "Budi Santoso", "namaUsaha": "Lereng Lawu Foods",
  "email": "budi@contoh.id", "password": "Rahasia123!" }
// 201 — cookie sesi ikut di-set
{ "role": "UMKM", "redirectTo": "/umkm" }
```
Membuat auth user + `profile` (role `UMKM`) + `business` dalam satu transaksi. Password minimal 8 karakter. Email duplikat → `400` `EMAIL_SUDAH_DIPAKAI`.

**`POST /api/auth/masuk`**
```jsonc
{ "email": "...", "password": "..." }
// 200
{ "role": "PETUGAS", "redirectTo": "/petugas/antrian" }
// 400 KREDENSIAL_SALAH — "Email atau password salah."
```
`redirectTo` ditentukan server berdasarkan role. Frontend mengikuti, tidak menghitung sendiri.

**`GET /api/saya`** → `SessionUser`
```jsonc
{ "id": "uuid", "email": "...", "role": "UMKM",
  "namaLengkap": "Budi Santoso",
  "usaha": { "id": "uuid", "nama": "Lereng Lawu Foods" }  // null untuk PETUGAS
}
```

---

### 3.2 Kasus

| Method | Path | Role | Keterangan |
|---|---|---|---|
| `GET` | `/api/kasus` | keduanya | UMKM: kasus miliknya. PETUGAS: antrean + filter |
| `POST` | `/api/kasus` | UMKM | Buat kasus baru (mulai assessment) |
| `GET` | `/api/kasus/[kode]` | keduanya | Detail; bentuk berbeda per role |
| `POST` | `/api/kasus/[kode]/kirim` | UMKM | Kirim untuk ditinjau |

**`GET /api/kasus`** — untuk PETUGAS menerima query param:
`q`, `status`, `blocker` (Dimension), `waiting` (`lt3` | `gte3`), `target` (`ada` | `tanpa`).

Respons:
```jsonc
{
  "ringkasan": { "perluDitinjau": 2, "menungguUmkm": 0, "eskalasi": 1, "terlambat": 0 },
  "kasus": [ /* CaseListItem[] */ ]
}
```
`ringkasan` dihitung atas **seluruh** antrean, tidak terpengaruh filter. UMKM juga menerima `ringkasan` tapi boleh diabaikan frontend.

`CaseListItem`:
```jsonc
{
  "id": "uuid",
  "kode": "LE-0248",
  "namaUsaha": "Lereng Lawu Foods",
  "produk": "Keripik Singkong",
  "tujuan": "Singapura",
  "status": "MENUNGGU_TINJAUAN",
  "nextActionBy": "PETUGAS",
  "tahap": "Pemetaan hambatan",
  "blocker": { "dimensi": "hs-lartas", "ringkas": "HS & Lartas",
               "alasan": "Informasi HS masih rendah keyakinannya; perlu petugas memeriksa klasifikasi." },
  "dikirimPada": "2026-08-30T02:14:00.000Z",   // null saat DRAFT
  "hariMenunggu": 6,
  "targetEkspor": "2026-09-18",                 // null kalau belum ada
  "terlambat": false,
  "permintaanInfoTerbukaId": null,              // diisi saat MENUNGGU_UMKM
  "aksiBerikutnya": "Petugas sedang meninjau kasusmu."  // satu kalimat untuk dashboard UMKM
}
```

**`POST /api/kasus`**
```jsonc
{ "produk": "Keripik Singkong Original 100 g", "tujuan": "Singapura" }  // dua-duanya opsional
// 201
{ "kode": "LE-0249", "redirectTo": "/assessment/le-0249" }
```
Kode dibuat server: dua huruf inisial nama usaha + `-` + urutan 4 digit. Tabrakan → naikkan urutan.
UMKM boleh punya beberapa kasus. Menolak `409` kalau sudah ada kasus `DRAFT` — arahkan ke kasus itu (`details.kode`).

**`GET /api/kasus/[kode]`** → `CaseDetail`. Field yang **hanya untuk PETUGAS** dan wajib dihapus dari respons UMKM:
`catatanInternal[]`, `fakta[].confirmed` mentah, `eskalasi`.
Field yang **hanya muncul untuk UMKM** saat status `RENCANA_TERKIRIM`/`SELESAI`: `rencana`.

**Penyaringan dilakukan di server**, bukan dengan menyembunyikannya di UI.

**`POST /api/kasus/[kode]/kirim`**
```jsonc
// 200
{ "status": "MENUNGGU_TINJAUAN", "dikirimPada": "2026-08-30T02:14:00.000Z" }
// 409 kalau bukan DRAFT
// 422 ATURAN_BISNIS kalau ada pertanyaan wajib yang terlihat belum terjawab
//     details: { "belumTerjawab": ["hs-code", "lartas-check"] }
```
Efek samping: hitung ulang readiness, buat draft AI (`AI-DRAFT-01`), tulis `case_event` `DIKIRIM_TINJAUAN` + `DRAFT_AI_DIBUAT`.

---

### 3.3 Assessment

| Method | Path | Role | Keterangan |
|---|---|---|---|
| `GET` | `/api/kasus/[kode]/assessment` | UMKM | Pertanyaan terlihat + jawaban tersimpan |
| `PUT` | `/api/kasus/[kode]/assessment/jawaban` | UMKM | Simpan satu jawaban (autosave) |

**`GET`** → `AssessmentState`:
```jsonc
{
  "versi": "v1.0",
  "pertanyaan": [ /* Question[] — HANYA yang lolos syarat */ ],
  "jawaban": { "legal-entity": "NIB + perorangan", "export-docs": ["Belum punya"] },
  "progress": { "terjawab": 8, "total": 15 },
  "sisaWajib": 3,                // pertanyaan WAJIB yang terlihat & belum terjawab (bukan total-terjawab)
  "indeksBerikutnya": 8,        // pertanyaan belum terjawab pertama; -1 kalau semua selesai
  "bolehLihatHasil": false,
  "disimpanPada": "2026-08-30T02:10:00.000Z"  // null kalau belum pernah
}
```

`Question` — **cerminan tipe yang sudah dipakai frontend**, minus `condition` (syarat dievaluasi di server, tidak pernah dikirim):
```jsonc
{
  "id": "hs-code",
  "dimensi": "hs-lartas",
  "section": "HS Code & Lartas",
  "title": "Apakah sudah mengetahui HS Code produk?",
  "description": null,
  "type": "yesno",
  "options": null,
  "placeholder": null,
  "glossary": [{ "term": "HS Code", "definition": "Kode klasifikasi barang..." }],
  "supportsUnknown": true,
  "supportsNotOwned": false,
  "wajib": true
}
```

**`PUT .../jawaban`**
```jsonc
// request
{ "questionId": "hs-code", "jawaban": "Ya" }   // string | string[]
// 200 — kirim balik state penuh, karena percabangan bisa berubah
{ /* AssessmentState yang sama persis bentuknya */ }
```

Ini titik paling penting untuk sifat adaptif: **respons berisi daftar pertanyaan setelah jawaban diterapkan.** Frontend mengganti state-nya dengan respons ini, tidak menggabung manual.

Jawaban untuk pertanyaan yang tidak lagi terlihat **disimpan tapi ditandai `aktif = false`** dan tidak dipakai perhitungan apa pun. Kalau syaratnya terpenuhi lagi, jawaban lama muncul kembali.

---

### 3.4 Kesiapan & rekomendasi

| Method | Path | Role | Keterangan |
|---|---|---|---|
| `GET` | `/api/kasus/[kode]/kesiapan` | keduanya | 6 dimensi + ringkasan + next actions |

```jsonc
{
  "ringkasan": "Fondasi usaha sudah ada. Fokus berikutnya adalah melengkapi bukti produk...",
  "tahap": "Persiapan dasar",
  "tahapPenjelasan": "Menata data dan bukti sebelum validasi bersama petugas.",
  "sumber": "AI",                        // "AI" | "OFFICER"
  "ditinjauOleh": null,                  // { nama, pada } kalau sumber = OFFICER
  "dihitungPada": "2026-08-30T02:15:00.000Z",
  "dimensi": [
    {
      "dimensi": "legalitas",
      "status": "ready",
      "alasan": "Bentuk usaha sudah teridentifikasi dan dapat menjadi dasar pemeriksaan dokumen.",
      "fakta": ["NIB + perorangan", "Usaha berjalan 3 tahun"],
      "belumAda": "NPWP dan dokumen legal pendukung belum dikonfirmasi."
    }
    // ... enam, selalu enam, selalu urutan kanonis
  ],
  "nextActions": [
    {
      "id": "uuid",
      "urutan": 1,
      "dimensi": "produk",
      "judul": "Lengkapi bukti kesiapan produk",
      "kenapa": "Buyer perlu melihat bahwa kualitas dan pasokan bisa konsisten...",
      "owner": "UMKM",
      "buktiDibutuhkan": "Spesifikasi produk, umur simpan, kapasitas bulanan",
      "prioritas": "Menutup informasi paling penting di dimensi Produk & Kapasitas",
      "status": "OPEN"
    }
    // maksimal 3 — TIDAK PERNAH lebih
  ]
}
```

**`dimensi` selalu berisi enam elemen**, dalam urutan kanonis, walau semuanya `idle`. Frontend tidak perlu menangani array pendek.

**Tidak ada field skor.** Jangan tambahkan.

---

### 3.5 Aksi petugas

| Method | Path | Keterangan |
|---|---|---|
| `GET` | `/api/kasus/[kode]/draft` | Draft AI + fakta/unknown/sumber/keyakinan |
| `POST` | `/api/kasus/[kode]/catatan` | Catatan internal |
| `POST` | `/api/kasus/[kode]/permintaan-info` | Minta informasi ke UMKM |
| `PUT` | `/api/kasus/[kode]/rekomendasi` | Simpan versi petugas |
| `POST` | `/api/kasus/[kode]/eskalasi` | Eskalasi |
| `POST` | `/api/kasus/[kode]/rencana` | Tinjau & kirim rencana |

Semua `403` untuk role `UMKM`.

**`GET .../draft`** → realisasi PRD #3:
```jsonc
{
  "versi": "AI-DRAFT-01",
  "sumber": "AI",
  "isi": "Mulai dengan memvalidasi HS Code produk keripik singkong dan periksa ketentuan Lartas...",
  "keyakinan": "rendah",
  "alasanReview": "Klasifikasi HS belum cukup pasti untuk menjadi arahan final.",
  "dibuatPada": "2026-08-30T02:15:00.000Z",
  "fakta": [
    { "label": "Kapasitas", "nilai": "1.000 kemasan per bulan",
      "asal": "Jawaban assessment", "dikonfirmasi": true }
  ],
  "belumDiketahui": [
    { "teks": "HS Code yang tepat, status buyer, dan metode pengiriman.",
      "dimensiTerkait": ["hs-lartas", "pasar", "eksekusi"] }
  ],
  "sumberReferensi": [
    { "judul": "Direktorat Teknis Kepabeanan", "penerbit": "Bea Cukai", "tahun": 2026,
      "mendukung": "Pemeriksaan HS dan ketentuan lartas.", "url": null }
  ],
  "versiSebelumnya": [ { "versi": "AI-DRAFT-01", "sumber": "AI", "dibuatPada": "..." } ]
}
```

**`POST .../permintaan-info`**
```jsonc
{ "judul": "Bukti komunikasi dengan buyer", "pesan": "Mohon lampirkan email atau chat..." }
// 201
{ "id": "uuid", "statusKasus": "MENUNGGU_UMKM" }
```

**`PUT .../rekomendasi`**
```jsonc
{ "isi": "teks yang sudah diedit petugas", "alasanPerubahan": "HS Code perlu diverifikasi manual" }
// 200
{ "versi": "OFFICER-01", "sumber": "OFFICER" }
```
**Membuat baris baru, tidak menimpa.** `AI-DRAFT-01` tetap ada dan tetap bisa diambil.

**`POST .../eskalasi`**
```jsonc
{ "kategori": "hs-lartas", "alasan": "Perlu konfirmasi klasifikasi dari spesialis." }
// 200 { "statusKasus": "ESKALASI" }
```

**`POST .../rencana`**
```jsonc
{ "ringkasanPetugas": "Mulai dari fondasi dokumen, lalu validasi produk.",
  "tugas": [ { "judul": "...", "penjelasan": "...", "owner": "UMKM",
               "buktiDibutuhkan": "...", "targetSelesai": "2026-09-15" } ] }
// 200
{ "statusKasus": "RENCANA_TERKIRIM", "versi": "OFFICER-01",
  "ditinjauOleh": { "nama": "Rina Kartika", "pada": "..." } }

// 422 ATURAN_BISNIS — gerbang officer-in-the-loop
{ "error": { "code": "ATURAN_BISNIS",
  "message": "Dimensi HS & Lartas belum ditinjau. Tambahkan catatan, edit rekomendasi, atau minta informasi terlebih dulu.",
  "details": { "dimensiBelumDitinjau": ["hs-lartas"] } } }
```

Gerbang `422` adalah **fitur, bukan penghalang.** Dia yang membuktikan petugas benar-benar meninjau.

---

### 3.6 Permintaan informasi (sisi UMKM)

| Method | Path | Role | Keterangan |
|---|---|---|---|
| `GET` | `/api/permintaan/[id]` | UMKM | Detail permintaan |
| `POST` | `/api/permintaan/[id]/jawab` | UMKM | Jawab (+ bukti) |

```jsonc
// GET → 200
{ "id": "uuid", "kodeKasus": "LE-0248", "judul": "Bukti komunikasi dengan buyer",
  "pesan": "Mohon lampirkan...", "dariPetugas": "Rina Kartika",
  "dibuatPada": "...", "status": "TERBUKA",
  "jawaban": null   // { pesan, dijawabPada, bukti[] } kalau sudah DIJAWAB
}

// POST jawab — multipart/form-data: pesan (text) + berkas[] (File, opsional, maks 5 × 5 MB)
// 200
{ "statusKasus": "MENUNGGU_TINJAUAN", "redirectTo": "/umkm" }
```

---

### 3.7 Tugas, bukti, riwayat

| Method | Path | Role | Keterangan |
|---|---|---|---|
| `GET` | `/api/kasus/[kode]/tugas` | keduanya | Daftar tugas |
| `PATCH` | `/api/tugas/[id]` | UMKM | Ubah status tugas |
| `POST` | `/api/tugas/[id]/bukti` | UMKM | Lampirkan bukti |
| `GET` | `/api/kasus/[kode]/riwayat` | keduanya | Timeline |

**`PATCH /api/tugas/[id]`**
```jsonc
{ "status": "COMPLETED" }
// 200 { "status": "COMPLETED", "statusKasus": "RENCANA_TERKIRIM" }
// 403 kalau owner tugas = PETUGAS — "Tugas ini dikerjakan petugas."
```
Kalau ini tugas terakhir yang tuntas, `statusKasus` jadi `SELESAI`.

**`POST /api/tugas/[id]/bukti`** — `multipart/form-data`, field `berkas[]`. Maks 5 berkas × 5 MB. Diterima: `pdf, jpg, jpeg, png, zip`. Disimpan ke Supabase Storage bucket `bukti` (privat), respons berisi metadata + signed URL berumur 1 jam.

**`GET .../riwayat`** → `CaseEvent[]`, terbaru dulu:
```jsonc
[ { "id": "uuid", "tipe": "RENCANA_DIKIRIM",
    "judul": "Rencana pendampingan dikirim",
    "aktor": "Rina Kartika", "peranAktor": "PETUGAS",
    "ringkasan": "Rencana pendampingan disetujui dengan catatan",
    "versi": "OFFICER-01", "pada": "2026-08-30T07:08:00.000Z" } ]
```

Timeline UMKM **menghilangkan** event `CATATAN_PETUGAS` (internal). Disaring di server.

---

## 4. Kepemilikan berkas

Dua agent bekerja di direktori yang sama. Batas ini tegas — **jangan pernah menyunting berkas milik agent lain.**

| Berkas / folder | Pemilik |
|---|---|
| `web/lib/types.ts` | **PM — dibekukan, hanya baca** |
| `web/prisma/**` | Backend |
| `web/app/api/**` | Backend |
| `web/lib/server/**` | Backend |
| `web/lib/supabase/**` | Backend |
| `web/middleware.ts` | Backend |
| `web/.env.example` | Backend |
| `web/package.json` | **Backend** (frontend minta lewat PM kalau butuh dependency) |
| `web/app/**` kecuali `app/api/**` | Frontend |
| `web/components/**` | Frontend |
| `web/lib/api-client.ts` | Frontend |
| `web/lib/labels.ts` | Frontend |
| `web/hooks/**` | Frontend |
| `docs/**` | PM (agent boleh menambah catatan di bagian "Catatan implementasi" saja) |

Backend membuat `web/lib/api-client.ts`? **Tidak.** Itu milik frontend. Backend hanya menyediakan endpoint sesuai dokumen ini.

---

## 5. Cara kerja paralel

Kedua agent bekerja bersamaan. Frontend **tidak menunggu** backend selesai.

- Frontend menulis kode terhadap kontrak ini seolah endpoint sudah ada. Jangan buat mock JSON di dalam komponen — itu mengulang masalah yang sedang kita perbaiki.
- Sampai backend mendarat, `fetch` akan gagal. Setiap layar wajib punya **state loading, empty, dan error** yang layak — itu memang pekerjaannya, bukan penghalang.
- Kalau kontrak ini terasa kurang untuk sebuah layar, **jangan mengarang field.** Catat di bagian "Pertanyaan terbuka" di handoff masing-masing dan lanjutkan bagian lain.

---

## 6. Catatan implementasi

*(Agent boleh menambahkan temuan di bawah ini. Jangan mengubah bagian di atas.)*

### 6.1 `CaseDetail.bukti` — ditambahkan, additive only

Frontend menemukan lubang: bukti yang UMKM unggah lewat `POST /api/permintaan/[id]/jawab`
tidak punya jalan untuk terlihat petugas di ruang review sebelum rencana dikirim —
kontrak lama hanya punya bukti per-tugas (`Task.bukti`, hanya ada setelah rencana
dikirim) dan per-jawaban-permintaan (`InfoResponse.bukti`, hanya lewat
`GET /api/permintaan/[id]`). Ini menyumbat skenario demo langkah 9→10
(`user-flow.md` §9).

**Keputusan (PM):** tambah field baru `bukti: EvidenceFile[]` pada `CaseDetail`
(`web/lib/types.ts`) — murni penambahan, tidak mengubah atau menghapus field
manapun yang sudah dipakai frontend. Isinya gabungan SEMUA `Evidence` milik
kasus (baik yang tertaut ke `InfoResponse` maupun ke `Task`), urut
`diunggahPada` menaik. Tampil untuk kedua role lewat `GET /api/kasus/[kode]`
(dan turut terisi di draft petugas) — tidak disaring seperti `catatanInternal`
karena bukan data internal, hanya berkas yang UMKM sendiri unggah.

### 6.2 Gerbang officer-in-the-loop — definisi "tersentuh"

`handoff-backend.md` §3.6 tidak merinci butir-per-butir apa arti "petugas
sudah menyentuh" sebuah dimensi `officer`. Implementasi (`lib/server/officer-gate.ts`):
dimensi dianggap tersentuh kalau ada `OfficerNote` bertag dimensi itu (atau
catatan umum tanpa tag), `InfoRequest` bertag dimensi itu (atau permintaan
umum), ATAU sudah ada `Recommendation` bersumber `OFFICER` sama sekali
(mengedit rekomendasi dianggap tinjauan menyeluruh, berlaku untuk semua
dimensi). Konsisten dengan skenario demo §9 langkah 7–10.

### 6.3 `POST .../rencana` — OFFICER recommendation otomatis kalau belum ada

Gerbang officer-in-the-loop bisa terpenuhi hanya lewat `OfficerNote` atau
`InfoRequest`, tanpa petugas pernah memanggil `PUT .../rekomendasi`. Tapi
`buildMentoringPlan` (`lib/server/plan.ts`) mensyaratkan baris `Recommendation`
bersumber `OFFICER` untuk bisa membangun rencana. Kalau belum ada satu pun saat
`POST .../rencana` dipanggil, endpoint ini membuat satu baris `OFFICER-01`
(atau versi berikutnya) dengan menyalin isi draft terakhir apa adanya, ditandai
`alasanPerubahan: "Ditinjau dan disetujui tanpa perubahan teks sebelum rencana
dikirim."` — bukan penyimpangan kontrak, hanya memastikan invarian "rencana
selalu bersumber OFFICER" selalu terpenuhi.

### 6.4 `AssessmentState.sisaWajib` — ditambahkan, additive only

`handoff-frontend.md` §9 pertanyaan 6: frontend memakai `total - terjawab`
sebagai "sisa pertanyaan", tapi itu menghitung SEMUA pertanyaan terlihat,
bukan hanya yang `wajib`. **Keputusan (PM):** tambah `sisaWajib: number` ke
`AssessmentState` — murni penambahan. Nilainya `unansweredRequired(answers).length`
(fungsi yang sudah ada di `lib/server/engine/visible-questions.ts`, dipakai
ulang, bukan logika baru). Frontend perlu memakai field ini alih-alih
`total - terjawab` untuk "sisa N wajib".

### 6.5 Jawaban PM atas `handoff-frontend.md` §9 lainnya

- **#1 Bukti tingkat kasus** → selesai, lihat §6.1 di atas. Frontend perlu
  memakai `CaseDetail.bukti` di blok "Evidence tersedia" (`/petugas/kasus/[kode]`)
  alih-alih hanya menggabungkan `Task.bukti` dari `GET .../tugas`.
- **#2 Bentuk `GET .../tugas`** → dikonfirmasi: `Task[]` telanjang, sesuai
  asumsi frontend. Tidak ada perubahan.
- **#3 Bentuk `POST /api/tugas/[id]/bukti`** → tidak relevan, frontend sudah
  mengabaikan body dan memuat ulang `GET .../tugas`. Tidak ada perubahan.
- **#4 Bentuk `POST .../catatan`** → dikonfirmasi: backend mengirim
  `catatanInternal[]` lengkap di `CaseDetail` untuk role PETUGAS
  (`lib/server/case-detail.ts`), jadi memuat ulang `GET /api/kasus/[kode]`
  sudah cukup. Tidak ada perubahan.
- **#5 Versi rekomendasi di sisi UMKM** → keputusan PM: workaround frontend
  ("Status kasus" + "Giliran bertindak" menggantikan kartu "Versi rekomendasi")
  **diterima sebagai final**, bukan sementara. UMKM tidak perlu melihat versi
  rekomendasi mentah. Tidak ada perubahan kontrak.
- **#6 `sisaWajib`** → selesai, lihat §6.4 di atas.
- **#7 `nextActionBy` untuk kasus `DRAFT` di antrean petugas** → dikonfirmasi:
  `GET /api/kasus` untuk role PETUGAS mengecualikan `DRAFT` secara paksa
  (`status: { not: "DRAFT" }`), terlepas dari filter yang diminta. `DRAFT`
  tidak akan pernah muncul di antrean petugas. Tidak ada perubahan.

### 6.6 Penyedia LLM diganti: Anthropic → OpenRouter (`minimax/minimax-m3:free`)

**Keputusan (PM), 30 Agustus 2026:** `lib/server/ai/draft.ts` sekarang memanggil
OpenRouter (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`) lewat `fetch` langsung ke
`chat/completions`, menggantikan `@anthropic-ai/sdk`. `ANTHROPIC_API_KEY` /
`ANTHROPIC_MODEL` tidak lagi dipakai berkas ini. Ketiga lapis pengaman (Zod,
penjaga kata terlarang, fallback deterministik) tidak berubah sama sekali —
hanya mekanisme pemanggilan API yang diganti.

Diverifikasi manual lewat `curl` langsung ke OpenRouter sebelum dipakai:
model gratis ini **mengabaikan** `response_format: json_schema` (skema tidak
ditegakkan, keluaran dibungkus pagar markdown, sempat terpotong `finish_reason:
"length"`), tapi patuh dengan `response_format: json_object` dikombinasikan
instruksi skema di `SYSTEM_PROMPT` — itu yang dipakai. Kode juga melucuti
pagar markdown sebelum `JSON.parse` sebagai jaring tambahan. Karena ini model
gratis (rate limit tidak terjamin, kualitas bisa naik-turun), fallback
deterministik tetap satu-satunya jaminan produk — jangan bergantung pada
LLM untuk demo.

**Update, 30 Agustus 2026 (keputusan PM):** karena model gratis ini sering
gagal validasi di percobaan pertama (bentuk keluaran tidak konsisten — lihat
`toleransiKeluaran` di atas), `generateDraft` sekarang **mengulang sampai 10
kali** (`MAX_PERCOBAAN`, jeda 500ms antar percobaan) sebelum jatuh ke fallback
deterministik — bukan langsung fallback di kegagalan pertama seperti semula.
Diverifikasi lewat skrip uji nyata: percobaan 1 & 2 gagal Zod, percobaan 3
berhasil dengan draft AI sungguhan (bukan fallback), total ±34 detik. Timeout
per percobaan (20 detik) tidak berubah — risiko terburuk kalau semua 10
percobaan benar-benar timeout adalah ±200 detik, tapi pada praktiknya
kegagalan validasi (bukan timeout jaringan) yang mendominasi dan itu kembali
dalam hitungan detik, bukan 20 detik penuh. Fallback deterministik tetap satu-
satunya jaminan kalau OpenRouter benar-benar mati.
