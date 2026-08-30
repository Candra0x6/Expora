# Handoff — Frontend

> **Baca lebih dulu, berurutan:**
> 1. [`prd.md`](../prd.md) — lima fitur wajib
> 2. [`user-flow.md`](./user-flow.md) — alur, rute, mesin status, perilaku tiap layar
> 3. [`data-contract.md`](./data-contract.md) — endpoint & bentuk data
> 4. [`web/lib/types.ts`](../web/lib/types.ts) — tipe, **beku, hanya baca**
>
> Dari PM · v1.0 · 30 Agustus 2026

---

## 0. Ringkas

Tujuh layar yang ada sudah bagus secara visual. Masalahnya bukan tampilan — **masalahnya alur dan data**. Semua angka hardcoded, tidak ada login, dan tiga jalur berakhir buntu.

Tugasmu: sambungkan semuanya ke API nyata, tambah empat layar yang hilang, dan buat alurnya masuk akal dari ujung ke ujung.

**Pertahankan bahasa desain yang ada.** Palet (`#f5f4f0`, `#18251f`, `#e7ebe3`, `#a75128`, `#c47743`), tipografi, kelengkungan sudut, dan tata letak sudah konsisten dan enak dilihat. Layar baru harus terasa dari keluarga yang sama. **Ini bukan proyek redesain.**

**Kamu tidak menyentuh satu pun berkas backend.** Agent backend sedang bekerja bersamaan di direktori yang sama.

Yang kamu miliki:

```
web/app/**  (kecuali app/api/**)     web/components/**
web/lib/api-client.ts                web/lib/labels.ts
web/hooks/**
```

Yang **haram** kamu sentuh: `web/app/api/**`, `web/prisma/**`, `web/lib/server/**`, `web/lib/supabase/**`, `web/middleware.ts`, `web/lib/types.ts`, `web/package.json`.

Butuh dependency baru? Minta ke PM. Kemungkinan besar tidak perlu — `zod`, `react-hook-form`, `lucide-react`, `sonner`, dan seluruh shadcn/ui sudah terpasang.

---

## 1. Bersih-bersih dulu

Kerjakan ini pertama. Sepuluh menit, dan menghilangkan banyak kebisingan.

- [ ] Hapus `app/officer/cases/[id]/page.tsx` dan folder `app/officer/` — duplikat persis `/petugas/kasus/[id]`. Rute Indonesia yang menang.
- [ ] Hapus sepuluh komponen sisa template v0, nol referensi, sudah diverifikasi:
  `intro-animation.tsx`, `stacking-agent-cards.tsx`, `live-agent-feed.tsx`, `agent-interface.tsx`, `devex-section.tsx`, `glitch-background.tsx`, `reveal-text.tsx`, `pixel-icon.tsx`, `mobile-nav.tsx`, `theme-provider.tsx`
- [ ] Setelah itu, cek apakah `three`, `@react-three/fiber`, `three-stdlib`, `recharts` masih terpakai. Kalau tidak — **jangan hapus sendiri** (`package.json` milik backend), laporkan ke PM.
- [ ] `app/globals.css` dan `styles/globals.css` ada dua. Cek mana yang benar-benar diimpor (`app/layout.tsx` mengimpor `./globals.css`) dan hapus yang yatim.

---

## 2. Fondasi

### 2.1 `lib/api-client.ts` — milikmu, bikin lebih dulu

Satu pembungkus `fetch` yang dipakai seluruh aplikasi. Tanpa ini, penanganan error akan tersebar dan tidak konsisten.

Harus:
- selalu `credentials: "include"`
- mem-parse amplop error di `data-contract.md` §1 dan melempar objek yang membawa `code`, `message`, `details`
- **memakai `message` dari server apa adanya.** Server sudah mengirim Bahasa Indonesia yang layak tampil. Jangan menyusun teks error sendiri, jangan menampilkan "Something went wrong".
- `401` → arahkan ke `/masuk?next=<path saat ini>`
- diketik dengan tipe dari `lib/types.ts`

### 2.2 `lib/labels.ts` — milikmu

Backend mengirim kode (`"ready"`, `"MENUNGGU_TINJAUAN"`). Label Indonesia adalah urusanmu. Kumpulkan di satu berkas:

- `DIMENSION_STATUS_LABEL`: `ready` → "Siap Ditinjau", `pending` → "Perlu Dilengkapi", `working` → "Sedang Dikerjakan", `officer` → "Perlu Petugas", `blocked` → "Ada Hambatan", `idle` → "Belum Dimulai"
- `DIMENSION_STATUS_STYLE` — pindahkan `statusStyles` yang sudah ada di `jalurekspor-result.tsx` baris 21 ke sini
- `DIMENSION_LABEL` — pindahkan `dimensionLabels` dari `jalurekspor-assessment.tsx` baris 53
- `CASE_STATUS_LABEL`: `DRAFT` → "Draft", `MENUNGGU_TINJAUAN` → "Menunggu Tinjauan", `MENUNGGU_UMKM` → "Menunggu UMKM", `ESKALASI` → "Eskalasi", `RENCANA_TERKIRIM` → "Rencana Terkirim", `SELESAI` → "Selesai"
- `TASK_STATUS_LABEL` — pindahkan `statusLabel` dari `jalurekspor-umkm-plan.tsx` baris 32
- `TASK_OWNER_LABEL`: `UMKM` → "Pemilik usaha", `PETUGAS` → "Petugas / pendamping", `UMKM_DAN_PENDAMPING` → "UMKM + Pendamping"
- `formatTanggal(iso)`, `formatWaktu(iso)`, `formatTanggalWaktu(iso)` — **semua pemformatan ke `id-ID` terjadi di sini.** Backend hanya mengirim ISO 8601 UTC.

Jangan ada string label yang tersebar di komponen.

### 2.3 Tiga state di setiap layar

Setiap layar yang mengambil data wajib punya **loading, empty, error**. Tidak ada pengecualian.

- Loading → `components/ui/skeleton.tsx` (sudah ada), berbentuk seperti konten aslinya
- Empty → `components/ui/empty.tsx` (sudah ada) + satu CTA yang jelas
- Error → tampilkan `message` dari server + tombol "Coba lagi"

Backend belum tentu sudah mendarat saat kamu membangun. **`fetch` akan gagal, dan itu wajar.** Justru itu kesempatan memastikan state error-mu benar-benar layak. Jangan menambal dengan data mock di dalam komponen — itu persis masalah yang sedang kita hapus.

---

## 3. Layar baru

### 3.1 `/` — Landing

`app/page.tsx` sekarang me-render assessment. Ganti jadi landing.

Isinya cukup: nama produk, satu kalimat proposisi ("Pahami kesiapan ekspor usahamu, dengan pendampingan petugas yang nyata"), penjelasan singkat lima langkah (Assess → rekomendasi → penjelasan → petugas meninjau → progres terpantau), CTA "Mulai assessment" → `/daftar` dan "Masuk" → `/masuk`.

Ringkas dan tenang. Satu layar, tanpa animasi berat. Ini bukan halaman marketing.

### 3.2 `/masuk` — Login

Email + password. Kirim `POST /api/auth/masuk`, **ikuti `redirectTo` dari respons** — jangan hitung tujuan sendiri. Hormati `?next=` kalau ada.

Tampilkan `message` server apa adanya saat gagal. Sertakan tautan ke `/daftar`.

Karena ini demo kompetisi, tampilkan kredensial seed di kartu kecil di bawah form:
`umkm@jalurekspor.id` / `petugas@jalurekspor.id` — password `Demo1234!`.
Ini menghemat waktu juri, dan menandakan alurnya siap dicoba.

### 3.3 `/daftar` — Registrasi UMKM

Nama pemilik, nama usaha, email, password (min. 8). `POST /api/auth/daftar` → ikuti `redirectTo`. Tanpa verifikasi email.

Tidak ada registrasi petugas — akun petugas di-seed. Kalau ada yang bertanya, jelaskan di UI dengan satu baris.

### 3.4 `/umkm` — Dashboard UMKM

**Layar terpenting yang selama ini hilang.** Ini yang mewujudkan PRD #5 dan menjadi tempat mendarat setelah login.

- Sapaan + nama usaha dari `GET /api/saya`
- `GET /api/kasus` → kartu untuk tiap `CaseListItem`
- Tiap kartu: kode, produk → tujuan, badge status, badge `nextActionBy`, dan kalimat `aksiBerikutnya` **dari server** (jangan susun sendiri)
- Tombol utama per kartu ditentukan status — tabel lengkap ada di `user-flow.md` §5.2
- Kalau ada kasus `MENUNGGU_UMKM`: **banner menonjol di atas** yang menautkan ke `/umkm/permintaan/[permintaanInfoTerbukaId]`. Tanpa ini UMKM menggantung tanpa tahu harus apa.
- Empty state: "Belum ada kasus" + CTA "Mulai assessment pertama" → `POST /api/kasus` → `redirectTo`

### 3.5 `/umkm/permintaan/[id]` — Inbox permintaan informasi

**Layar yang menutup loop officer-in-the-loop (PRD #4, 25% penilaian).** Saat ini petugas bisa meminta informasi tapi UMKM tidak punya tempat menjawab.

- `GET /api/permintaan/[id]`
- Konteks kasus, lalu kartu permintaan: judul, pesan, nama petugas, waktu
- Form: textarea jawaban + unggah bukti (multi-file, maks 5 × 5 MB, `pdf/jpg/jpeg/png/zip`) dengan pratinjau nama berkas dan tombol hapus per berkas
- `POST /api/permintaan/[id]/jawab` sebagai `multipart/form-data` → toast → `redirectTo`
- Kalau `status === "DIJAWAB"`: tampilkan jawaban sebelumnya read-only, sembunyikan form
- Validasi ukuran & tipe **di klien juga**, jangan biarkan pengguna menunggu unggahan 20 MB hanya untuk ditolak server

---

## 4. Layar lama yang disambungkan

### 4.1 Assessment → `/assessment/[kode]`

Pindahkan dari `app/page.tsx` ke `app/assessment/[kode]/page.tsx`.

Perubahan pada `components/jalurekspor-assessment.tsx`:

- [ ] **Hapus array `questions` hardcoded** (baris 37–51) dan konstanta `SCENARIO_ID`/`VERSION`/`STORAGE_KEY`. Semua dari `GET /api/kasus/[kode]/assessment`.
- [ ] **Hapus seluruh `localStorage`** (baris 63–90). Autosave ke `PUT .../assessment/jawaban`.
- [ ] **Ganti state dengan respons autosave secara utuh.** Respons mengembalikan `AssessmentState` penuh karena percabangan bisa berubah setelah sebuah jawaban. Jangan menggabung manual, jangan menghitung ulang `pertanyaan` di klien.
- [ ] **Tangani pertanyaan yang hilang.** Kalau pertanyaan yang sedang dibuka lenyap dari daftar baru, pindah ke pertanyaan belum terjawab pertama (`indeksBerikutnya`) — jangan lempar ke awal, jangan crash.
- [ ] Indikator "Disimpan otomatis pukul HH:MM" memakai `disimpanPada` dari server. Tampilkan state "menyimpan…" saat request berjalan, dan state gagal yang bisa dicoba ulang.
- [ ] Tombol akhir aktif hanya saat `bolehLihatHasil`. Kalau belum, tampilkan sisa berapa pertanyaan, jangan hanya dinonaktifkan tanpa penjelasan.
- [ ] Sidebar (nama usaha, produk → tujuan, kode kasus) dari data kasus, bukan hardcode "Lereng Lawu Foods".
- [ ] Debounce autosave untuk input `text`/`number` (±500 ms). `select`/`yesno`/`multi` simpan langsung.

Sifat adaptif inilah demo PRD #1. Pastikan mulus: jawab `hs-code` = "Ya" → pertanyaan HS Code muncul di daftar; ubah ke "Saya belum tahu" → hilang.

### 4.2 Hasil → `/hasil/[kode]`

`components/jalurekspor-result.tsx`:

- [ ] Hapus array `dimensions` (baris 6–13) dan `actions` (baris 15–19) → `GET /api/kasus/[kode]/kesiapan`
- [ ] Pindahkan `statusStyles` ke `lib/labels.ts`
- [ ] Judul, produk → tujuan, tanggal dari data kasus
- [ ] **Badge sumber harus jujur** — ini kewajiban PRD #3, bukan detail kosmetik:
  - `sumber === "AI"` → "Draft AI — belum ditinjau petugas"
  - `sumber === "OFFICER"` → "Telah ditinjau petugas · {nama} · {tanggal}"
- [ ] **Tombol "Ajukan ke petugas" hanya saat status `DRAFT`.** Di status lain ganti dengan teks keadaan ("Sedang ditinjau petugas sejak 30 Agu 2026") + tautan ke `/umkm`.
- [ ] State `submitted` lokal (baris 24) dihapus — status datang dari server.
- [ ] Render enam dimensi apa adanya; server selalu mengirim enam.
- [ ] **Jangan menambahkan skor, persentase, atau grade apa pun.** PRD melarangnya eksplisit.

### 4.3 Kirim → `/kirim-untuk-ditinjau/[kode]`

`components/jalurekspor-submission.tsx`:

- [ ] Hapus `facts` (baris 7–13) dan `areas` (baris 15–22) → data kasus + `GET .../kesiapan`
- [ ] Tiga angka ringkasan dihitung dari `dimensi` nyata: "Area selesai" = jumlah `ready`, "Belum lengkap" = jumlah `pending`+`blocked`+`officer`, "Aksi disarankan" = `nextActions.length`
- [ ] Kode kasus `#LE-0248` hardcoded (baris 37) → dari data
- [ ] Tombol kirim → `POST /api/kasus/[kode]/kirim`; tangani `422` dengan menampilkan `details.belumTerjawab` sebagai daftar pertanyaan yang kurang + tautan kembali ke assessment
- [ ] `AfterSubmission` memakai `dikirimPada` dari respons, bukan `new Date()` klien
- [ ] **Perbaiki tautan buntu**: `#riwayat` (baris 60) diganti CTA utama **"Kembali ke dashboard"** → `/umkm`
- [ ] Kalau status bukan `DRAFT` saat halaman dibuka, langsung tampilkan keadaan "sudah dikirim" tanpa tombol kirim

### 4.4 Antrean petugas `/petugas/antrian`

`components/jalurekspor-officer-queue.tsx`:

- [ ] Hapus array `cases` (baris 9–13) → `GET /api/kasus`
- [ ] **Pindahkan penyaringan ke server.** `useMemo` yang menyaring di klien (baris 21–29) diganti query param: `q`, `status`, `blocker`, `waiting`, `target`. Debounce input pencarian ±300 ms.
- [ ] Simpan filter di URL search param supaya bisa di-refresh dan dibagikan
- [ ] Empat kartu statistik dari `ringkasan` — bukan angka hardcoded "2 / 0 / 1 / 0" (baris 31)
- [ ] Badge "Terlambat" pada kartu kasus saat `terlambat === true`
- [ ] Tautan kasus → `/petugas/kasus/${kode.toLowerCase()}` (konvensi lama dipertahankan)
- [ ] `blocker` sekarang objek `{dimensi, ringkas, alasan}` — "Blocker utama" pakai `ringkas`, "Alasan perhatian" pakai `alasan`
- [ ] Empty state yang ada (baris 31, akhir) dipertahankan — sudah bagus

### 4.5 Ruang review petugas `/petugas/kasus/[kode]`

`components/jalurekspor-officer-case.tsx` — komponen terberat. Semua array hardcoded (`dimensions` baris 7–14, `facts` baris 15) dihapus.

Sumber data: `GET /api/kasus/[kode]`, `GET .../kesiapan`, `GET .../draft`, `GET .../riwayat`.

- [ ] Header: nama, produk → tujuan, badge status, "Menunggu N hari", lima meta (skenario, assessment, rekomendasi, dikirim, target) — semua dari data
- [ ] Blok 01 konteks kasus ← `CaseDetail.konteks`
- [ ] Blok 02 readiness ← `kesiapan.dimensi`
- [ ] Blok AI draft ← `draft.isi`, `draft.keyakinan`, `draft.alasanReview`, `draft.dibuatPada`
- [ ] Blok 03 data pendukung ← `draft.fakta`, `draft.belumDiketahui`, `draft.sumberReferensi` — **ini realisasi PRD #3, jangan disederhanakan**
- [ ] Bagian evidence ← berkas nyata dari kasus, dengan signed URL yang bisa diklik
- [ ] Blok 04 timeline ← `GET .../riwayat`
- [ ] **Perbaiki bug tabel fakta**: baris 31 me-render `<span>{c}</span>` untuk kolom "Asal" dan `<span>{b}</span>` untuk "Nilai", padahal header-nya `Fakta · Asal · Nilai · Status` — kolomnya tertukar. Petakan ke `SupportingFact` dengan benar: `label`, `asal`, `nilai`, `dikonfirmasi`.
- [ ] Panel aksi: keempat panel jadi form sungguhan
  - Catatan internal → `POST .../catatan`, tampilkan catatan sebelumnya
  - Request Information → `POST .../permintaan-info`
  - Edit Recommendation → `PUT .../rekomendasi`; **tampilkan versi AI asli berdampingan** dengan editor, dan daftar `versiSebelumnya`. Jejak ini yang membuktikan officer-in-the-loop.
  - Escalate → `POST .../eskalasi`, `kategori` memakai nilai `Dimension`
  - Tinjau & kirim rencana → `POST .../rencana`, dengan editor ringkasan petugas + daftar tugas yang bisa disunting
- [ ] **Tangani `422` gerbang officer-in-the-loop dengan baik.** Saat ditolak, tampilkan pesan server + nama dimensi yang belum ditinjau, dan arahkan petugas ke aksi yang perlu dilakukan. Ini bukan error — ini fitur yang akan ditunjukkan ke juri. Jangan kubur di dalam toast merah.
- [ ] Ganti state lokal `sent` (baris 19) dengan status kasus dari server

### 4.6 Rencana `/umkm/plan/[kode]`

`components/jalurekspor-umkm-plan.tsx`:

- [ ] Hapus array `tasks` (baris 19–23) dan `history` (baris 25–30) → `GET .../tugas` dan `GET .../riwayat`
- [ ] Ringkasan petugas, badge "Telah ditinjau petugas", nama & waktu asli dari `MentoringPlan.ditinjauOleh`
- [ ] "Tandai selesai" → `PATCH /api/tugas/[id]` (bukan `setItems` lokal di baris 38–41), dengan pembaruan optimistis dan rollback saat gagal
- [ ] "Lampirkan bukti" → unggah sungguhan `POST /api/tugas/[id]/bukti`, bukan `setNotice` teks (baris 43). Tampilkan berkas terlampir per tugas.
- [ ] Tugas dengan `owner === "PETUGAS"` → tanpa tombol aksi, beri keterangan "Dikerjakan petugas"
- [ ] **Perbaiki bug tata letak timeline**: baris 57 memakai `absolute -ml-[27px]` tanpa induk `relative` — titik penanda akan meleset. Beri induk `relative`.
- [ ] Kalau status kasus bukan `RENCANA_TERKIRIM`/`SELESAI` → redirect `/hasil/[kode]` dengan pesan "Rencana belum tersedia; petugas masih meninjau."
- [ ] **Perbaiki tautan buntu** "Riwayat kasus" (baris 56) yang mengarah ke `/kirim-untuk-ditinjau` → arahkan ke bagian riwayat di halaman ini (`#riwayat`) atau `/umkm`

---

## 5. Konsistensi yang harus dijaga

- **Tidak ada skor kesiapan tunggal.** Di mana pun.
- **Label sumber selalu jujur.** Draft AI tidak pernah tampil seolah sudah ditinjau petugas.
- **Disclaimer tetap ada** di `/hasil`, `/kirim-untuk-ditinjau`, `/petugas/kasus/[kode]`, `/umkm/plan/[kode]`. Teks yang sudah ada sudah tepat; jangan diperlembut.
- **Semua tanggal diformat lewat `lib/labels.ts`.** Backend mengirim ISO UTC.
- **Semua pesan error dari server.** Jangan mengarang teks sendiri.
- **`nextActionBy` terlihat di dashboard dan antrean.** Ini jawaban PRD #5 atas "siapa yang harus bertindak".
- Bahasa Indonesia sederhana di seluruh UI. Istilah teknis (HS Code, Lartas, PEB) selalu punya penjelasan — pola `<details>` glosarium yang sudah ada di assessment (baris 119) sudah bagus, pakai ulang polanya di tempat lain kalau perlu.

---

## 6. Cara kerja

- **Jangan menunggu backend.** Tulis kode terhadap kontrak. `fetch` yang gagal akan menunjukkan state error-mu — itu pekerjaan yang sah.
- **Jangan menaruh data mock di dalam komponen.** Itu persis masalah yang sedang kita hapus. Kalau butuh melihat tampilan berisi, pakai state loading/skeleton.
- **Jangan menyunting berkas backend**, walau kelihatan salah. Catat, laporkan ke PM.
- **Jangan mengubah `lib/types.ts`.** Kalau tipe terasa kurang, hentikan dan laporkan — backend sedang menulis terhadap bentuk yang sama.
- Jalankan `pnpm build` sebelum lapor. Harus lolos.

---

## 7. Selesai berarti

- `pnpm build` lolos tanpa error TypeScript.
- Sebelas rute di `user-flow.md` §4 ada dan bisa dinavigasi.
- Nol data hardcoded di komponen `jalurekspor-*`. Cari `const dimensions =`, `const tasks =`, `const cases =`, `const facts =`, `const actions =`, `const areas =`, `const history =` — harus nihil.
- Nol `localStorage` untuk data domain.
- Setiap layar pengambil data punya loading, empty, dan error.
- Tidak ada tautan buntu. Setiap layar punya jalan maju dan jalan kembali.
- Tidak ada berkas backend yang berubah.

---

## 8. Laporan akhir — tulis ini untuk PM

1. Rute yang selesai vs belum
2. Konfirmasi nol data hardcoded (tempelkan hasil pencarian di atas)
3. Layar yang belum bisa diuji karena backend belum mendarat
4. Ketidakcocokan dengan kontrak yang kamu temukan
5. Bug UI yang kamu temukan dan perbaiki di luar daftar ini
6. Usulan perbaikan alur

---

## 9. Pertanyaan terbuka

*(Tambahkan di sini kalau kontrak kurang untuk sebuah layar. Jangan mengarang field.)*

### Dari agent Frontend · 30 Agustus 2026

1. **Bukti tingkat kasus untuk petugas (`/petugas/kasus/[kode]`, blok "Evidence tersedia").**
   §4.5 meminta "berkas nyata dari kasus". Kontrak tidak punya endpoint yang mengembalikan
   seluruh berkas milik satu kasus. `EvidenceFile[]` hanya muncul di `Task.bukti` dan
   `InfoResponse.bukti`. Sementara ini frontend menggabungkan `Task.bukti` dari
   `GET /api/kasus/[kode]/tugas` — artinya **bukti yang diunggah UMKM lewat
   `POST /api/permintaan/[id]/jawab` tidak terlihat petugas** sebelum ada rencana/tugas.
   Usul: tambahkan `bukti: EvidenceFile[]` ke `CaseDetail`, atau endpoint
   `GET /api/kasus/[kode]/bukti`. **Belum dikerjakan — menunggu keputusan PM.**

2. **Bentuk respons `GET /api/kasus/[kode]/tugas`.**
   Kontrak hanya menulis "Daftar tugas". Frontend mengasumsikan `Task[]` telanjang
   (bukan `{ tugas: Task[] }`). Mohon dikonfirmasi backend.

3. **Bentuk respons `POST /api/tugas/[id]/bukti`.**
   Kontrak menyebut "metadata + signed URL" tanpa bentuk pasti. Frontend mengabaikan body
   respons dan memuat ulang `GET .../tugas`, jadi bentuk apa pun aman.

4. **Bentuk respons `POST /api/kasus/[kode]/catatan`.** Tidak didefinisikan. Frontend
   mengabaikan body dan memuat ulang `GET /api/kasus/[kode]`, yang berarti backend wajib
   mengirim `catatanInternal[]` di `CaseDetail` untuk petugas.

5. **Versi rekomendasi di sisi UMKM.** `CaseDetail` punya `versiAssessment` tetapi tidak
   punya versi rekomendasi, dan `GET .../draft` hanya untuk PETUGAS. Kartu "Versi
   rekomendasi" di layar kirim diganti "Status kasus" + "Giliran bertindak". Kalau UMKM
   memang perlu melihat versi, `ReadinessResult` butuh field `versi`.

6. **Jumlah pertanyaan wajib yang belum terjawab.** `AssessmentState` hanya punya
   `progress.terjawab/total` dan `bolehLihatHasil`. Frontend menampilkan
   `total − terjawab` sebagai "sisa berapa"; angka ini menghitung seluruh pertanyaan
   terlihat, bukan hanya yang `wajib`. Kalau angka wajib yang diinginkan, tambahkan
   `sisaWajib: number` ke `AssessmentState`.

7. **`nextActionBy` untuk kasus `DRAFT` di antrean petugas.** Filter `status` menerima
   seluruh `CaseStatus`, termasuk `DRAFT`. Belum jelas apakah kasus `DRAFT` milik UMKM lain
   memang boleh muncul di antrean petugas. Frontend menyediakan opsi filternya; server yang
   memutuskan isinya.
