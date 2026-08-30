# Decision Note — JalurEkspor (Expora)

## Masalah

UMKM Indonesia yang sudah layak ekspor sering tersendat bukan karena produknya kurang bagus, melainkan karena tidak tahu persis di titik mana mereka berhenti — legalitas usaha, dokumen ekspor, atau klasifikasi HS/Lartas. Pendekatan skor kesiapan tunggal (mis. "72% siap ekspor") justru menyembunyikan letak masalahnya dan tidak bisa membedakan dua UMKM dengan kondisi berbeda. Selain itu, keputusan seperti klasifikasi HS Code, status Lartas, atau persetujuan PEB adalah keputusan berisiko tinggi yang tidak boleh diserahkan sepenuhnya ke AI.

## Solusi

JalurEkspor menilai kesiapan ekspor lintas **enam dimensi terpisah** (legalitas, produk & kapasitas, pasar tujuan, HS & Lartas, dokumen, eksekusi) lewat assessment adaptif, lalu memilih maksimal tiga aksi prioritas berikutnya secara deterministik. AI menulis draf narasi yang bisa ditelusuri sumbernya (fakta, hal yang belum diketahui, tingkat keyakinan) — tapi **tidak pernah** menentukan status dimensi, memilih aksi, atau mengubah status kasus. Rencana pendampingan final hanya bisa dikirim setelah petugas benar-benar meninjau setiap dimensi yang membutuhkan keahlian manusia; sistem menolak (`422`) kalau ada yang terlewat. Seluruh perjalanan kasus tersimpan sebagai satu linimasa, sehingga konsultasi lanjutan tidak pernah mulai dari nol.

## Keputusan desain & teknis

| Keputusan | Alasan |
|---|---|
| **Mesin aturan deterministik** (bukan AI) untuk status enam dimensi & pemilihan aksi | Keputusan yang mempengaruhi kepatuhan ekspor harus reproducible dan bisa diaudit. Diverifikasi lewat 29 pemeriksaan otomatis (`verify-engine.ts`) yang jalan tanpa database. |
| **AI hanya menulis narasi**, dengan tiga lapis pengaman (batasan keras di prompt → validasi Zod → penjaga kata terlarang) dan **fallback deterministik** kalau gagal di lapis mana pun | Brief secara eksplisit melarang AI menjadi pengambil keputusan akhir. Diverifikasi live: sistem pernah menangkap draf AI nyata yang menyebut HS Code final sebagai kesimpulan, dan membuangnya ke fallback — bukan cuma klaim, terbukti jalan. |
| **Gerbang officer-in-the-loop wajib** sebelum rencana bisa dikirim | Ini 25% bobot penilaian di brief. Dibuat sebagai penolakan HTTP eksplisit (`422 ATURAN_BISNIS`) di lapisan API, bukan sekadar anjuran UI yang bisa dilewati. |
| **Supabase** (Postgres + Auth + Storage) + **Prisma** | Satu platform terintegrasi untuk auth, database relasional, dan penyimpanan berkas privat (bukti ekspor) — mempercepat pembangunan tanpa mengorbankan RLS sebagai jaring pengaman tambahan di atas otorisasi lapisan API. |
| **OpenRouter** (`minimax/minimax-m3:free`) untuk lapisan AI, dengan retry sampai 10× sebelum fallback | Menghindari biaya API selama hackathon sambil tetap menunjukkan integrasi AI nyata. Model gratis terbukti sering gagal validasi bentuk keluaran di percobaan pertama; retry meningkatkan tingkat keberhasilan tanpa melonggarkan validasi. |
| **Setiap aksi yang mengubah status kasus menulis satu `caseEvent`** | Syarat langsung dari fitur "riwayat & progres tersimpan" — linimasa dibangun dari log kejadian, bukan disusun ulang dari state saat ini. |

## Kompromi yang diambil

- **Tidak ada OCR dokumen, integrasi INSW/CEISA, atau notifikasi WhatsApp/email** — di luar cakupan MVP secara eksplisit, demi memastikan lima fitur inti benar-benar solid dan teruji ketimbang banyak fitur setengah jadi.
- **Model AI gratis** berarti narasi AI hidup tidak selalu muncul di setiap kasus (tingkat fallback yang cukup sering diamati langsung: ±1 dari 4 percobaan berhasil tanpa retry, jauh membaik dengan retry). Ini diterima karena fallback deterministik tetap menghasilkan narasi yang benar dan aman — hanya kurang bervariasi, bukan kurang akurat.
- **Tidak ada verifikasi email, reset password, atau 2FA** — mengurangi kompleksitas autentikasi untuk linimasa hackathon; diterima karena bukan bagian dari lima fitur wajib brief.
- **RLS di database bersifat deny-all** (tanpa policy granular per baris); otorisasi sesungguhnya ditegakkan di lapisan API (`lib/server/auth.ts`, `case-state.ts`). Kompromi sadar: lebih cepat dibangun dan diuji untuk skala hackathon, dengan RLS sebagai jaring pengaman kalau ada kode yang tidak sengaja memakai kunci publik — bukan lapisan otorisasi utama.
- **Satu lingkungan deploy** (langsung ke production Vercel, tanpa staging terpisah) — wajar untuk skala proyek hackathon, dikompensasi dengan pengujian endpoint langsung terhadap database live sebelum demo, bukan hanya lolos build.
