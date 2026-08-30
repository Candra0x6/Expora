# Skrip video demo — 5 menit

> Turunan dari skenario demo 7 menit di [`user-flow.md`](./user-flow.md) §9, dipadatkan jadi 5 menit.
> Setiap baris mencantumkan **halaman** yang harus tampil di layar saat baris itu diucapkan.

## Persiapan sebelum rekam

- **Reset data ke kondisi pristine** kalau sudah pernah dipakai untuk uji coba: hapus baris di tabel `case` (kode `LE-0248`, `KA-0172`, `BS-0311`) lewat Supabase, lalu jalankan ulang `pnpm exec prisma db seed` dari `web/`. Demo ini HARUS dimulai dari `LE-0248` berstatus **Draft**.
- **Dua profil browser** (atau satu jendela biasa + satu Incognito) — satu untuk sesi UMKM, satu untuk sesi Petugas. Ini menghindari harus logout/login berulang di tengah rekaman, yang paling banyak membuang waktu di skrip 5 menit ini.
- Buka kedua jendela lebih dulu di halaman **`/masuk`** sebelum mulai rekam.
- Gunakan **kartu akun demo di `/masuk`** (fitur klik-untuk-isi-otomatis) — jangan ketik manual, buang waktu dan rawan typo saat rekam.
- Kalau ANTHROPIC/OpenRouter API sedang tidak stabil pas hari-H, set `JALUREKSPOR_DISABLE_LLM=true` supaya narasi AI langsung fallback instan tanpa jeda — lebih baik konsisten daripada berjudi menunggu LLM di tengah rekaman.
- Siapkan satu berkas kecil (PDF/JPG, di bawah 5 MB) di desktop untuk demo upload bukti di menit ke-3.

---

## Segmen 1 — Pembuka & masalah (0:00–0:20)

**Halaman:** `/` (landing)

> "UMKM di Indonesia yang siap ekspor sering tersendat bukan karena produknya kurang bagus — tapi karena tidak tahu persis di mana mereka berhenti: legalitas, dokumen, atau klasifikasi barang. JalurEkspor memetakan itu semua dalam enam dimensi kesiapan, dengan petugas manusia yang tetap memegang keputusan akhir — bukan AI yang memutuskan sendirian."

Scroll sebentar ke bagian fitur di landing page, lalu klik **"Masuk"**.

---

## Segmen 2 — Login UMKM & assessment adaptif (0:20–1:05)

**Halaman:** `/masuk` → klik kartu akun demo **UMKM** → `/umkm`

> "Ini `Lereng Lawu Foods`, UMKM keripik singkong yang sedang menyiapkan ekspor ke Singapura. Kasusnya masih Draft — assessment-nya belum diajukan ke petugas."

Klik **"Lanjutkan assessment"** → `/assessment/le-0248`

> "Pertanyaannya adaptif, bukan formulir statis. Kalau saya jawab HS Code sudah ada…"

Ubah jawaban pertanyaan `hs-code` dari kondisi awal ke **"Ya"** → tunjukkan pertanyaan lanjutan `hs-code-value` muncul.

> "…muncul pertanyaan detail nomornya. Kalau saya bilang belum tahu…"

Ubah kembali ke **"Saya belum tahu"** → pertanyaan lanjutan hilang.

> "…pertanyaan itu hilang lagi. Setiap UMKM melihat jumlah pertanyaan yang berbeda tergantung jawabannya sendiri."

---

## Segmen 3 — Hasil kesiapan & pengajuan (1:05–1:35)

**Halaman:** `/hasil/le-0248`

> "Ini hasilnya: enam dimensi, masing-masing dengan status sendiri — bukan satu skor tunggal, karena skor tunggal justru menyembunyikan di mana masalahnya. Tiga langkah prioritas berikutnya sudah dipilih otomatis. Perhatikan badge ini: **'Draft AI — belum ditinjau petugas'** — sistem selalu jujur soal mana yang masih draft mesin dan mana yang sudah disahkan manusia."

Klik **"Ajukan ke petugas"** → `/kirim-untuk-ditinjau/le-0248` → kembali otomatis ke `/umkm`

> "Sekarang statusnya berubah jadi Menunggu Tinjauan, dan giliran bertindak pindah ke petugas."

---

## Segmen 4 — Sisi petugas: tinjauan & gerbang wajib (1:35–2:35)

**Halaman:** ganti ke jendela kedua → `/masuk` → klik kartu akun demo **Petugas** → `/petugas/antrian`

> "Di sisi petugas, kasus `LE-0248` langsung muncul di puncak antrean dengan alasan yang bisa dibaca langsung — bukan angka atau kode misterius."

Klik kasus → `/petugas/kasus/le-0248`

> "Di sini petugas melihat draft AI lengkap dengan fakta pendukungnya, apa yang belum diketahui, dan tingkat keyakinannya. Semua bisa ditelusuri sumbernya — ini bukan kotak hitam."

Klik **"Tinjau & kirim rencana"** tanpa menyentuh dimensi lain dulu → **ditolak (422)**

> "Dan ini bagian pentingnya: sistem **menolak** mengirim rencana kalau ada dimensi yang perlu keahlian petugas — seperti klasifikasi HS Code dan status Lartas — belum benar-benar disentuh petugas. AI tidak boleh membuat keputusan itu sendirian, jadi sistem memaksa manusia turun tangan dulu."

---

## Segmen 5 — Minta info, UMKM menjawab, rencana terkirim (2:35–4:00)

**Halaman:** tetap di `/petugas/kasus/le-0248`

> "Petugas bisa langsung meminta info tambahan ke UMKM."

Buka bagian **"Minta informasi dari UMKM"**, isi judul + pesan singkat, klik **"Kirim permintaan"** → status kasus berubah **Menunggu UMKM**.

**Halaman:** pindah ke jendela UMKM → `/umkm/permintaan/[id]`

> "Di sisi UMKM, permintaan itu muncul sebagai notifikasi. UMKM menjawab dan mengunggah bukti langsung — file-nya tersimpan aman di storage privat, bukan URL publik."

Jawab pertanyaan, unggah berkas yang sudah disiapkan, kirim → kasus kembali **Menunggu Tinjauan**.

**Halaman:** kembali ke jendela Petugas → `/petugas/kasus/le-0248`

> "Petugas sekarang menyentuh dimensi yang tadi memblokir — mengedit rekomendasi, atau menambah catatan — dan perhatikan: draft AI yang asli tetap tersimpan sebagai versi terpisah di samping versi petugas. Tidak ada yang ditimpa diam-diam."

Sentuh dimensi yang masih memblokir (catatan/rekomendasi), lalu klik **"Tinjau & kirim rencana"** lagi → **berhasil** kali ini.

---

## Segmen 6 — Penutup: riwayat penuh & rekap (4:00–5:00)

**Halaman:** jendela UMKM → `/umkm/plan/le-0248`

> "Dan ini yang UMKM lihat: rencana pendampingan final, dengan badge **'Telah ditinjau petugas'** beserta namanya — bukan AI anonim. Tiga tugas konkret, dan yang paling penting…"

Scroll ke bagian riwayat/timeline.

> "…seluruh perjalanan tersimpan utuh dari langkah pertama tadi. UMKM tidak pernah mulai dari nol lagi setiap kali membuka aplikasi."

Kembali ke layar manapun yang menunjukkan arsitektur/tumpukan teknologi (atau ucapkan langsung ke kamera):

> "JalurEkspor dibangun di atas Next.js dan Supabase — Postgres, Auth, dan Storage — dengan lapisan narasi AI yang selalu punya jaring pengaman deterministik kalau modelnya gagal atau lambat. Manusia selalu punya kata akhir. Terima kasih."

---

## Catatan durasi

Total: **5:00**. Kalau saat latihan ternyata lebih panjang, potongan paling aman untuk dipangkas (urutan prioritas):

1. Segmen 2 (adaptif) — cukup tunjukkan toggle sekali, jangan dua arah (Ya → lanjutan → belum tahu → hilang lagi bisa jadi cukup satu arah saja).
2. Narasi pembuka Segmen 1 — persingkat jadi satu kalimat.
3. Segmen 6 penutup — potong bagian rekap teknologi, cukup tutup di bukti riwayat.

**Jangan dipotong:** Segmen 4 (penolakan 422 officer-in-the-loop) — ini satu-satunya bagian yang membuktikan klaim produk "AI tidak pernah memutuskan sendirian", jadi ini inti demo.
