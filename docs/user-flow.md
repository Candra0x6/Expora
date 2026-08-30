# JalurEkspor — User Flow (Sumber Kebenaran)

> Dokumen ini adalah **sumber kebenaran alur**. Handoff frontend & backend menurunkan dari sini.
> Kalau ada konflik antara dokumen ini dan kode, dokumen ini yang menang — laporkan konfliknya.
>
> Status: **v1.0 · disetujui PM · 30 Agustus 2026**

---

## 1. Kenapa dokumen ini ada

Frontend saat ini punya 7 halaman yang bagus secara visual, tapi **tidak punya alur**:

- Tidak ada login, tidak ada pemisahan role — siapa pun bisa membuka ruang petugas.
- Setelah UMKM menekan "Kirim untuk ditinjau", tidak ada tempat mendarat. Kasusnya hilang.
- Petugas bisa menekan "Request Information", tapi UMKM tidak punya layar untuk menjawabnya. Loop putus.
- `/umkm/plan` ada tapi tidak pernah tercapai dari mana pun.
- Assessment mengklaim adaptif; kenyataannya semua 13 pertanyaan selalu tampil.

Dokumen ini menutup lima lubang itu.

---

## 2. Dua peran

| Peran | Siapa | Masuk lewat | Mendarat di |
|---|---|---|---|
| `UMKM` | Pemilik usaha yang ingin ekspor | `/masuk` (bisa daftar sendiri di `/daftar`) | `/umkm` |
| `PETUGAS` | Petugas/pendamping yang memvalidasi | `/masuk` (akun di-seed, **tidak ada self-register**) | `/petugas/antrian` |

Tidak ada peran ketiga di MVP. Admin, analitik, dan multi-petugas per kasus adalah stretch.

---

## 3. Status kasus — mesin keadaan

Ini kosakata bersama. **Frontend dan backend wajib memakai string yang sama persis.**

```
                 ┌──────────────────────────────────────────────┐
                 │                                              │
  [buat kasus]   ▼                                              │
      ──────► DRAFT ──────[UMKM kirim]──────► MENUNGGU_TINJAUAN │
               ▲                                    │           │
               │                                    │           │
        (assessment belum selesai)                  │           │
                                    ┌───────────────┼───────────┴──────┐
                                    │               │                  │
                        [petugas minta info]  [petugas kirim]   [petugas eskalasi]
                                    │           rencana]              │
                                    ▼               ▼                  ▼
                            MENUNGGU_UMKM   RENCANA_TERKIRIM      ESKALASI
                                    │               │                  │
                          [UMKM jawab]     [semua task selesai]  [petugas lanjut]
                                    │               │                  │
                                    └──► MENUNGGU_TINJAUAN            │
                                                    ▼                  │
                                                 SELESAI ◄─────────────┘
```

| Status | Arti | `nextActionBy` |
|---|---|---|
| `DRAFT` | UMKM masih mengisi assessment, belum dikirim | `UMKM` |
| `MENUNGGU_TINJAUAN` | Sudah dikirim, ada di antrean petugas | `PETUGAS` |
| `MENUNGGU_UMKM` | Petugas meminta informasi tambahan | `UMKM` |
| `ESKALASI` | Petugas eskalasi ke spesialis | `PETUGAS` |
| `RENCANA_TERKIRIM` | Rencana final sudah dikirim, UMKM mengerjakan task | `UMKM` |
| `SELESAI` | Semua task selesai | `—` |

**`nextActionBy` diturunkan dari status, tidak disimpan terpisah.** Ini yang menjawab pertanyaan PRD #5: *"siapa yang harus bertindak sekarang harus selalu terlihat."*

### Aturan transisi (backend menegakkan, frontend tidak menebak)

| Dari | Aksi | Oleh | Ke |
|---|---|---|---|
| `DRAFT` | kirim untuk ditinjau | UMKM | `MENUNGGU_TINJAUAN` |
| `MENUNGGU_TINJAUAN` | minta informasi | PETUGAS | `MENUNGGU_UMKM` |
| `MENUNGGU_TINJAUAN` | eskalasi | PETUGAS | `ESKALASI` |
| `MENUNGGU_TINJAUAN` | tinjau & kirim rencana | PETUGAS | `RENCANA_TERKIRIM` |
| `MENUNGGU_UMKM` | jawab permintaan | UMKM | `MENUNGGU_TINJAUAN` |
| `ESKALASI` | minta informasi | PETUGAS | `MENUNGGU_UMKM` |
| `ESKALASI` | tinjau & kirim rencana | PETUGAS | `RENCANA_TERKIRIM` |
| `RENCANA_TERKIRIM` | task terakhir selesai | UMKM | `SELESAI` |
| `RENCANA_TERKIRIM` | perbarui informasi | UMKM | `MENUNGGU_TINJAUAN` |

Transisi di luar tabel ini **ditolak `409`**. Tidak ada aksi yang mengembalikan kasus ke `DRAFT` setelah dikirim.

**Aturan keras (PRD #3 & #4):** rencana hanya boleh terlihat oleh UMKM di status `RENCANA_TERKIRIM` atau `SELESAI`. Sebelum itu, yang ada hanyalah **draft AI yang belum ditinjau** dan wajib berlabel demikian.

---

## 4. Peta rute

```
PUBLIK
  /                       Landing — value prop + CTA
  /masuk                  Login (email + password)
  /daftar                 Registrasi UMKM

UMKM  (role = UMKM)
  /umkm                   Dashboard — daftar kasus + status + next action
  /assessment/[kode]      Assessment adaptif (autosave ke server)
  /hasil/[kode]           Profil kesiapan 6 dimensi + max 3 next actions
  /kirim-untuk-ditinjau/[kode]   Review sebelum kirim
  /umkm/permintaan/[id]   Inbox: jawab permintaan informasi petugas   ← BARU
  /umkm/plan/[kode]       Rencana pendampingan final + task + riwayat

PETUGAS  (role = PETUGAS)
  /petugas/antrian        Antrean kasus + filter
  /petugas/kasus/[kode]   Ruang review kasus
```

**`[kode]` adalah kode kasus dalam huruf kecil** — contoh `le-0248`. Ditampilkan huruf besar (`LE-0248`). Konvensi ini sudah dipakai frontend sekarang (`item.id.toLowerCase()` di antrean), jadi dipertahankan.

### Perubahan rute dari kondisi sekarang

| Sekarang | Menjadi | Alasan |
|---|---|---|
| `/` = assessment | `/` = landing, assessment pindah ke `/assessment/[kode]` | Tidak ada entry point; assessment butuh konteks kasus |
| `/hasil` | `/hasil/[kode]` | Satu UMKM bisa punya >1 kasus |
| `/kirim-untuk-ditinjau` | `/kirim-untuk-ditinjau/[kode]` | idem |
| `/umkm/plan` | `/umkm/plan/[kode]` | idem |
| `/officer/cases/[id]` | **dihapus** | Duplikat persis `/petugas/kasus/[id]` |
| — | `/masuk`, `/daftar`, `/umkm`, `/umkm/permintaan/[id]` | Baru |

### Perlindungan rute

Middleware menolak sebelum halaman render:

- Belum login + buka rute UMKM/PETUGAS → redirect `/masuk?next=<path>`
- Role `UMKM` buka `/petugas/**` → redirect `/umkm`
- Role `PETUGAS` buka `/umkm/**`, `/assessment/**`, `/hasil/**`, `/kirim-untuk-ditinjau/**` → redirect `/petugas/antrian`
- Sudah login buka `/masuk` atau `/daftar` → redirect ke dashboard sesuai role
- Kasus bukan milik UMKM tersebut → `404` (bukan `403`, jangan bocorkan keberadaan kasus)

---

## 5. Alur UMKM (jalur utama)

### 5.1 Masuk

```
/  ──[Mulai assessment / Masuk]──►  /masuk
                                      │
                       belum punya akun ├──► /daftar ──► (auto login) ──┐
                                      │                                 │
                                      └────────────────────────────────►▼
                                                                     /umkm
```

**`/daftar`** meminta: nama pemilik, nama usaha, email, password. Membuat sekaligus `profile` (role `UMKM`) + `business`. Setelah daftar langsung login, tidak ada verifikasi email di MVP.

**`/masuk`** meminta email + password. Setelah sukses, redirect berdasarkan role — `UMKM` → `/umkm`, `PETUGAS` → `/petugas/antrian`. Kalau ada `?next=`, hormati selama role-nya cocok.

### 5.2 Dashboard `/umkm`

Layar ini **belum ada** dan wajib dibuat. Isinya:

- Sapaan + nama usaha.
- **Kartu kasus** untuk tiap kasus: kode, produk → tujuan, badge status, `nextActionBy`, dan satu kalimat "apa yang harus dilakukan sekarang".
- Tombol utama pada tiap kartu, ditentukan status:

| Status | Label tombol | Menuju |
|---|---|---|
| `DRAFT` | "Lanjutkan assessment" | `/assessment/[kode]` |
| `MENUNGGU_TINJAUAN` | "Lihat hasil kesiapan" | `/hasil/[kode]` |
| `MENUNGGU_UMKM` | "Jawab permintaan petugas" | `/umkm/permintaan/[id]` |
| `ESKALASI` | "Lihat hasil kesiapan" | `/hasil/[kode]` |
| `RENCANA_TERKIRIM` | "Buka rencana pendampingan" | `/umkm/plan/[kode]` |
| `SELESAI` | "Lihat rencana" | `/umkm/plan/[kode]` |

- Kalau belum ada kasus sama sekali: empty state + CTA "Mulai assessment pertama" → `POST /api/kasus` → redirect `/assessment/[kode]`.
- Banner menonjol kalau ada kasus berstatus `MENUNGGU_UMKM` — ini yang membuat UMKM tidak menggantung.

### 5.3 Assessment `/assessment/[kode]`

Struktur visual dipertahankan (sidebar 6 dimensi + satu pertanyaan per layar + progress bar). Yang berubah:

1. **Pertanyaan datang dari server**, bukan array hardcoded. Server sudah menyaring mana yang relevan.
2. **Autosave ke server**, bukan `localStorage`. Setiap jawaban → `PUT .../jawaban`. Indikator "Disimpan otomatis pukul HH:MM" memakai waktu respons server.
3. **Benar-benar adaptif.** Respons autosave mengembalikan daftar pertanyaan yang terlihat **setelah** jawaban itu diterapkan. Jawaban bisa memunculkan atau menghapus pertanyaan lanjutan di tengah jalan.
4. Tombol akhir "Lihat hasil" aktif hanya jika semua pertanyaan wajib yang terlihat sudah terjawab. Kalau belum, tombol menjelaskan sisa berapa.

**Perilaku saat pertanyaan menghilang:** kalau UMKM mengubah jawaban sehingga pertanyaan lanjutan tidak relevan lagi, jawaban lanjutan itu **disimpan tapi ditandai tidak aktif** — supaya kalau ia mengubah kembali, jawabannya tidak hilang. Server tidak memakai jawaban tidak aktif untuk menghitung apa pun.

**Kalau indeks pertanyaan saat ini ikut terhapus,** pindahkan fokus ke pertanyaan belum terjawab pertama, jangan lempar ke awal.

### 5.4 Hasil `/hasil/[kode]`

Menampilkan enam dimensi + maksimal tiga next action, semuanya dari server.

- **Tidak ada skor tunggal.** PRD melarangnya secara eksplisit. Jangan tambahkan persentase kesiapan, bintang, atau grade.
- Label sumber wajib jujur:
  - Status `DRAFT` / `MENUNGGU_TINJAUAN` / `MENUNGGU_UMKM` / `ESKALASI` → badge **"Draft AI — belum ditinjau petugas"**
  - Status `RENCANA_TERKIRIM` / `SELESAI` → badge **"Telah ditinjau petugas"** + nama petugas & waktu
- Dua aksi: "Update informasi" → `/assessment/[kode]`, "Ajukan ke petugas" → `/kirim-untuk-ditinjau/[kode]`.
- Tombol "Ajukan ke petugas" **hanya muncul saat status `DRAFT`**. Di status lain diganti teks status ("Sedang ditinjau petugas sejak 30 Agu 2026").

### 5.5 Kirim `/kirim-untuk-ditinjau/[kode]`

Halaman konfirmasi. Menampilkan ringkasan kasus, hitungan area selesai/belum lengkap/aksi, daftar apa saja yang akan dikirim, dan disclaimer.

- Tombol "Kirim untuk ditinjau" → `POST /api/kasus/[kode]/kirim`.
- Sukses → tampilkan layar "Menunggu tinjauan petugas" (komponen `AfterSubmission` yang sudah ada), lalu CTA utama **"Kembali ke dashboard"** → `/umkm`. Link `#riwayat` yang buntu sekarang diganti ini.
- Kalau status bukan `DRAFT`, halaman langsung menampilkan keadaan "sudah dikirim", tidak menampilkan tombol kirim lagi.

### 5.6 Permintaan informasi `/umkm/permintaan/[id]` — LAYAR BARU

Ini yang menutup loop officer-in-the-loop. Isinya:

- Konteks kasus (kode, produk → tujuan).
- Kartu permintaan dari petugas: judul, pesan, nama petugas, waktu.
- Form jawaban: textarea + unggah bukti (opsional, multi-file).
- Tombol "Kirim jawaban" → `POST /api/permintaan/[id]/jawab` → status kasus kembali `MENUNGGU_TINJAUAN` → redirect `/umkm` dengan toast.
- Kalau permintaan sudah dijawab, tampilkan jawaban sebelumnya dalam keadaan read-only.

### 5.7 Rencana `/umkm/plan/[kode]`

Hanya bisa diakses saat status `RENCANA_TERKIRIM` atau `SELESAI`. Selain itu → redirect `/hasil/[kode]` dengan pesan "Rencana belum tersedia; petugas masih meninjau."

- Ringkasan petugas, badge "Telah ditinjau petugas" + nama & waktu asli.
- Daftar task: "Tandai selesai" → `PATCH /api/tugas/[id]`, "Lampirkan bukti" → unggah nyata (bukan `notice` teks).
- Riwayat pendampingan diisi dari `case_event`, kronologis. Ini realisasi PRD #5.
- Catatan batasan (bukan keputusan kepabeanan) tetap tampil.

---

## 6. Alur Petugas

### 6.1 Antrean `/petugas/antrian`

- Empat kartu statistik dihitung server: **Perlu Ditinjau** (`MENUNGGU_TINJAUAN`), **Menunggu UMKM** (`MENUNGGU_UMKM`), **Eskalasi** (`ESKALASI`), **Terlambat**.
- **Definisi "Terlambat":** `nextActionBy = PETUGAS` **dan** `waitingDays > 5`. Kasus terlambat tetap ikut terhitung di kartu statusnya sendiri.
- Filter (query, status, blocker, durasi tunggu, ada/tanpa target) dikirim ke server sebagai query param — bukan filter di klien. Alasannya antrean nyata bisa ratusan kasus.
- Urutan default: `nextActionBy = PETUGAS` dulu, lalu `waitingDays` menurun.
- **`blocker` bukan kolom yang diketik manusia.** Diturunkan: dimensi dengan bobot keparahan tertinggi. Lihat §7.3.
- "Alasan perhatian" adalah `reason` dari dimensi blocker itu — teks yang dapat dijelaskan, bukan skor prioritas buram. Ini poin nilai; jangan diganti angka.

### 6.2 Ruang review `/petugas/kasus/[kode]`

Lima blok, semuanya dari server:

1. **Konteks kasus** — status buyer, pengalaman ekspor, metode kirim, target tanggal.
2. **Readiness profile** — enam dimensi, masing-masing dengan status, alasan, dan fakta pendukung.
3. **AI draft** — teks rekomendasi, label keyakinan (`Keyakinan rendah/sedang/tinggi`), waktu dibuat, alasan kenapa perlu review.
4. **Data pendukung** — tabel fakta (nilai, asal, dikonfirmasi/belum), kotak *unknown information*, kotak *source references*. Ini realisasi PRD #3.
5. **Timeline kasus** — dari `case_event`.

Panel aksi di sisi kanan:

| Aksi | Efek | Status setelahnya |
|---|---|---|
| Simpan catatan internal | `POST .../catatan` — **tidak pernah terlihat UMKM** | tidak berubah |
| Request Information | `POST .../permintaan-info` — buat permintaan | `MENUNGGU_UMKM` |
| Edit Recommendation | `PUT .../rekomendasi` — simpan versi `OFFICER-nn`, versi AI tetap tersimpan | tidak berubah |
| Escalate | `POST .../eskalasi` — kategori + alasan | `ESKALASI` |
| Tinjau & kirim rencana | `POST .../rencana` — kunci rencana, buat task | `RENCANA_TERKIRIM` |

**Aturan keras:** "Tinjau & kirim rencana" **ditolak `422`** kalau ada dimensi berstatus `officer` yang belum petugas sentuh (belum ada catatan, belum ada edit rekomendasi, atau belum ada permintaan info terkait dimensi itu). Petugas harus benar-benar meninjau, bukan sekadar klik kirim. Frontend menampilkan alasan penolakannya dengan jelas.

**Edit Recommendation tidak menimpa.** Draft AI disimpan permanen sebagai `AI-DRAFT-nn`. Versi petugas jadi baris baru `OFFICER-nn` dengan `editReason`. Jejak ini yang membuktikan officer-in-the-loop ke juri.

---

## 7. Mesin: adaptif, status, next action

Tiga hal ini **deterministik dan berbasis aturan**. LLM tidak menentukannya. LLM hanya menulis narasi di §7.4.

Alasannya dua: hasil demo selalu sama, dan setiap status bisa dijelaskan ke juri baris per baris.

### 7.1 Pertanyaan adaptif

13 pertanyaan dasar yang sudah ada dipertahankan apa adanya (id, teks, tipe, opsi, glosarium). Ditambah **7 pertanyaan lanjutan bersyarat**:

| id | dimensi | Muncul kalau | Pertanyaan |
|---|---|---|---|
| `npwp` | legalitas | `legal-entity` ≠ "Belum punya" | "Apakah usaha sudah memiliki NPWP?" (yesno, +belum tahu) |
| `standard-detail` | produk | `has-standard` = "Ya" | "Standar atau sertifikasi apa yang sudah dimiliki?" (multi: BPOM/PIRT, Halal, HACCP, ISO 22000, Uji umur simpan, Lainnya) |
| `target-date` | pasar | `buyer-status` ∈ {"Sudah ada PO / permintaan", "Sudah ada percakapan"} | "Kapan target pengiriman pertama?" (text, +belum tahu) |
| `hs-code-value` | hs-lartas | `hs-code` = "Ya" | "Berapa HS Code produknya?" (text, contoh 2005.20.00) |
| `lartas-detail` | hs-lartas | `lartas-check` = "Ya" | "Apa hasil pengecekan ketentuan Lartas?" (select: Tidak termasuk Lartas / Termasuk — perlu izin / Belum jelas) |
| `peb-method` | dokumen | `peb-familiar` = "Ya" | "Bagaimana PEB sebelumnya diurus?" (select: Sendiri via CEISA / Melalui PPJK atau forwarder / Melalui pihak lain) |
| `forwarder-name` | eksekusi | `export-partner` memuat "PPJK / forwarder" | "Siapa nama PPJK / forwarder-nya?" (text, +belum tahu) |

Hasilnya: UMKM yang sudah tahu HS Code menjawab ~19 pertanyaan; yang belum tahu apa-apa menjawab ~13. **Dua UMKM berbeda melihat assessment yang berbeda** — persis yang diminta PRD #1.

### 7.2 Status enam dimensi

Enam nilai status, sama dengan `tone` yang sudah dipakai frontend:

| kode | label tampilan |
|---|---|
| `ready` | Siap Ditinjau |
| `pending` | Perlu Dilengkapi |
| `working` | Sedang Dikerjakan |
| `officer` | Perlu Petugas |
| `blocked` | Ada Hambatan |
| `idle` | Belum Dimulai |

Aturan, dievaluasi berurutan, yang pertama cocok menang:

**legalitas**
1. `legal-entity` = "Belum punya" → `blocked`
2. `legal-entity` terisi **dan** `business-age` terisi (bukan "Saya belum tahu") → `ready`
3. `legal-entity` terisi → `pending`
4. selain itu → `idle`

**produk**
1. `product-ready` kosong → `idle`
2. `has-standard` = "Ya" **dan** `monthly-capacity` berupa angka → `ready`
3. `product-ready` terisi → `pending`

**pasar**
1. `target-market` kosong atau "Belum tahu" → `idle`
2. `buyer-status` = "Sudah ada PO / permintaan" → `ready`
3. `buyer-status` = "Sudah ada percakapan" → `working`
4. selain itu → `pending`

**hs-lartas**
1. `hs-code` dan `lartas-check` dua-duanya kosong → `idle`
2. `lartas-detail` = "Termasuk — perlu izin" → `blocked`
3. selain itu → `officer`

> Dimensi ini **tidak pernah bernilai `ready` dari jawaban UMKM saja.** HS Code dan Lartas yang dilaporkan sendiri tetap perlu validasi petugas. PRD #3 melarang sistem menyajikan HS Code atau keputusan Lartas final. Aturan ini penegakannya.

**dokumen**
1. `export-docs` kosong → `idle`
2. `export-docs` memuat "Belum punya" **dan** `peb-familiar` ≠ "Ya" → `blocked`
3. `export-docs` punya ≥3 item nyata **dan** `peb-familiar` = "Ya" → `ready`
4. selain itu → `pending`

**eksekusi**
1. `shipping-method` dan `export-partner` dua-duanya kosong → `idle`
2. `shipping-method` = "Belum tahu" **dan** `export-partner` memuat "Belum punya" → `idle`
3. `shipping-method` terisi nyata **dan** `export-partner` punya partner nyata → `ready`
4. selain itu → `working`

**Verifikasi:** dengan jawaban seed (§8), keenam aturan ini menghasilkan `ready, pending, working, officer, blocked, idle` — persis status yang sekarang ditampilkan mock `/hasil`. Demo akan terlihat identik, bedanya datanya nyata.

### 7.3 Pemilihan next action (maksimal tiga)

Bobot keparahan: `blocked`=5, `officer`=4, `pending`=3, `working`=2, `idle`=1, `ready`=0.

1. **Pilih** tiga dimensi dengan bobot tertinggi (bobot 0 tidak pernah dipilih).
2. Seri diputus dengan urutan kanonis: legalitas → produk → pasar → hs-lartas → dokumen → eksekusi.
3. **Urutkan** tiga yang terpilih memakai urutan kanonis yang sama.
4. Ambil template aksi dari tabel `(dimensi, status)` → `title`, `why`, `owner`, `evidenceNeeded`, `priorityReason`.

Dimensi blocker untuk antrean petugas = dimensi berbobot tertinggi (aturan seri sama).

**Verifikasi seed:** dokumen(5), hs-lartas(4), produk(3) terpilih; diurutkan kanonis jadi produk → hs-lartas → dokumen. Persis ketiga aksi di mock `/hasil` sekarang, dalam urutan yang sama.

Aksi yang dimiliki `owner = "Petugas / pendamping"` **tidak bisa** ditandai selesai oleh UMKM.

### 7.4 Bagian LLM

LLM hanya menulis, tidak memutuskan. Inputnya: jawaban assessment + enam status dimensi + tiga aksi terpilih (semua sudah dihitung aturan). Outputnya JSON terstruktur:

- `summary` — satu paragraf Bahasa Indonesia sederhana, maksimal 2 kalimat.
- `reason` per dimensi — kenapa statusnya begitu, bahasa awam.
- `missing` per dimensi — apa yang belum ada.
- `facts[]` — fakta yang dipakai, beserta asal (`Jawaban assessment` / `Wawancara UMKM` / `Catatan produksi`) dan `confirmed`.
- `unknowns[]` — yang belum diketahui + dimensi terkait.
- `confidence` — `rendah` | `sedang` | `tinggi`.
- `sources[]` — referensi sumber.

**Batasan wajib di prompt:** dilarang menyebut HS Code spesifik sebagai kesimpulan, dilarang menyatakan status Lartas final, dilarang menyatakan PEB disetujui, dilarang memakai istilah teknis tanpa penjelasan awam.

**Fallback:** kalau LLM gagal/timeout, pakai template deterministik per `(dimensi, status)` dan set `confidence = "rendah"`. Halaman tidak boleh kosong atau error hanya karena LLM mati. Ini titik gagal demo yang paling mungkin.

---

## 8. Skenario seed — satu versi kebenaran

Frontend sekarang memuat data yang **saling bertentangan** antar layar. Ini akan terlihat saat demo. Nilai di bawah ini menang di semua tempat.

| Kolom | Nilai kanonis | Sebelumnya salah di |
|---|---|---|
| Nama usaha | Lereng Lawu Foods | — |
| Produk | Keripik Singkong Original 100 g | — |
| Tujuan | Singapura | — |
| Kode kasus | `LE-0248` | — |
| Kapasitas | **1.000 kemasan / bulan** | officer-case ("120 kg/minggu"), submission ("500 pack/bulan") |
| Usia usaha | 3 tahun | — |
| Tahun | **2026** | umkm-plan (pakai 2025) |
| Petugas | **Rina Kartika** | officer-case ("D. Pratama") |
| Versi assessment | **v1.0** | submission ("v1.4") |
| Versi rekomendasi AI | **AI-DRAFT-01** | "AI-DRAFT-03", "draft-2026.08", "REC-2025.03" |
| Versi rekomendasi petugas | **OFFICER-01** | — |
| Target ekspor | 18 Sep 2026 | — |
| Dikirim | 30 Agu 2026, 09.14 | — |

Jawaban seed untuk `LE-0248`:

```
legal-entity     = "NIB + perorangan"
business-age     = "3"
npwp             = "Saya belum tahu"
product-ready    = "Keripik singkong original 100 g"
monthly-capacity = "1000"
has-standard     = "Tidak"
target-market    = "Singapura"
buyer-status     = "Sudah ada percakapan"
target-date      = "18 September 2026"
hs-code          = "Saya belum tahu"
lartas-check     = "Tidak"
export-docs      = ["Belum punya"]
peb-familiar     = "Tidak"
shipping-method  = "Belum tahu"
export-partner   = ["Belum punya"]
```

Dua kasus seed lain dari antrean dipertahankan supaya antrean tidak kosong: **`KA-0172`** Kriya Aruna Solo (Tas Anyaman Pandan → Jepang, blocker Legalitas, `MENUNGGU_TINJAUAN`) dan **`BS-0311`** Batik Sembada (Kain Batik Tulis → Malaysia, blocker Dokumen, `ESKALASI`).

Akun seed:

| Email | Password | Role |
|---|---|---|
| `umkm@jalurekspor.id` | `Demo1234!` | UMKM (pemilik Lereng Lawu Foods) |
| `petugas@jalurekspor.id` | `Demo1234!` | PETUGAS (Rina Kartika) |

Ditambah pemilik untuk Kriya Aruna dan Batik Sembada supaya kasusnya punya induk.

---

## 9. Skenario demo (7 menit)

Alur yang harus mulus tanpa satu pun layar buntu:

1. `/` → "Masuk" → login `umkm@jalurekspor.id` → mendarat `/umkm`, kasus `LE-0248` berstatus **Draft**.
2. "Lanjutkan assessment" → jawab beberapa pertanyaan. **Tunjukkan adaptifnya:** jawab `hs-code` = "Ya" → pertanyaan HS Code muncul; ubah ke "Saya belum tahu" → pertanyaan itu hilang.
3. "Lihat hasil" → enam dimensi dengan status berbeda-beda, tiga aksi. Badge **"Draft AI — belum ditinjau petugas"**.
4. "Ajukan ke petugas" → kirim → "Menunggu tinjauan petugas" → kembali ke `/umkm`, status berubah **Menunggu Tinjauan**, next action **Petugas**.
5. Login sebagai petugas → `/petugas/antrian`, `LE-0248` ada di puncak dengan alasan yang terbaca.
6. Buka kasus → tunjukkan **fakta, unknown, keyakinan, sumber** → ini PRD #3.
7. Klik "Tinjau & kirim rencana" → **ditolak**, karena dimensi HS & Lartas belum disentuh. Ini justru bagus untuk ditunjukkan.
8. "Request Information" → minta bukti buyer → kasus jadi **Menunggu UMKM**.
9. Login UMKM → banner permintaan → jawab + unggah bukti → kasus kembali **Menunggu Tinjauan**.
10. Login petugas → "Edit Recommendation" (tunjukkan `AI-DRAFT-01` tetap tersimpan di samping `OFFICER-01`) → "Tinjau & kirim rencana".
11. Login UMKM → `/umkm/plan/le-0248` → rencana final, badge **"Telah ditinjau petugas · Rina Kartika"**, tiga task, riwayat lengkap dari langkah 1.

Langkah 11 adalah bukti PRD #5: perjalanan tersimpan utuh, tidak mulai dari nol.

---

## 10. Yang sengaja TIDAK dibuat

Ditulis supaya tidak ada yang diam-diam menambahkannya:

- OCR dokumen, integrasi INSW/CEISA, notifikasi WhatsApp/email
- Dashboard analitik, panel admin, manajemen pengguna
- Multi-petugas per kasus, penugasan otomatis, SLA berjenjang
- Chat realtime antara UMKM dan petugas
- Skor kesiapan tunggal — **dilarang PRD**
- Verifikasi email, reset password, 2FA
- Ekspor PDF rencana

Kalau salah satu terasa perlu, angkat ke PM dulu. Jangan kerjakan diam-diam.
