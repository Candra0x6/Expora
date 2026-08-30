# Decision Note — JalurEkspor (Expora)

> **AI sebagai pendamping, bukan penentu.**
> JalurEkspor membantu UMKM mengetahui hambatan ekspornya, menentukan langkah berikutnya, dan melanjutkan pendampingan tanpa kehilangan konteks.

## Masalah yang Diselesaikan

Banyak UMKM Indonesia sebenarnya sudah memiliki produk layak ekspor, tetapi tertahan karena tidak mengetahui titik masalahnya: **legalitas, kapasitas produksi, pasar tujuan, HS Code dan Lartas, dokumen, atau eksekusi**.

Skor tunggal seperti *“72% siap ekspor”* terlihat sederhana, tetapi menyembunyikan hambatan sebenarnya. Dua UMKM dengan skor sama dapat membutuhkan pendampingan yang sepenuhnya berbeda.

Di saat yang sama, keputusan seperti klasifikasi HS Code, status Lartas, dan persetujuan PEB memiliki konsekuensi kepatuhan. Karena itu, keputusan tersebut **tidak boleh diserahkan sepenuhnya kepada AI**.

## Solusi: Peta Jalan Ekspor yang Dapat Dipertanggungjawabkan

JalurEkspor memetakan kesiapan UMKM melalui **enam dimensi terpisah**:

**Legalitas · Produk & Kapasitas · Pasar Tujuan · HS & Lartas · Dokumen · Eksekusi**

Assessment adaptif menghasilkan diagnosis per dimensi, bukan sekadar skor umum. Berdasarkan hasil tersebut, mesin aturan memilih maksimal **tiga aksi prioritas** berikutnya secara deterministik.

AI hanya membantu menyusun narasi yang mudah dipahami dan dapat ditelusuri—meliputi fakta, informasi yang belum diketahui, sumber, dan tingkat keyakinan. AI **tidak dapat** menentukan status dimensi, memilih aksi, atau mengubah status kasus.

Sebelum rencana pendampingan dikirim, petugas wajib meninjau seluruh dimensi yang memerlukan keahlian manusia. Jika ada peninjauan yang terlewat, API menolak permintaan dengan respons **`422 ATURAN_BISNIS`**.

Setiap assessment, ulasan, perubahan status, dan tindak lanjut disimpan dalam satu linimasa kasus. Dengan demikian, konsultasi berikutnya selalu melanjutkan progres sebelumnya—bukan memulai kembali dari nol.

## Keputusan Utama

| Keputusan                                                         | Alasan dan bukti implementasi                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mesin aturan deterministik untuk diagnosis dan prioritas aksi** | Keputusan yang memengaruhi kepatuhan harus konsisten, dapat direproduksi, dan bisa diaudit. Mesin ini diverifikasi melalui **29 pemeriksaan otomatis** di `verify-engine.ts` yang dapat dijalankan tanpa database.                                                                                                                      |
| **AI dibatasi sebagai penulis narasi**                            | Tiga lapis pengaman diterapkan: batasan keras pada prompt, validasi struktur menggunakan Zod, dan pemeriksaan istilah terlarang. Jika salah satu lapisan gagal, sistem menggunakan narasi fallback deterministik. Dalam pengujian langsung, draf AI yang menyimpulkan HS Code final berhasil ditolak dan digantikan oleh fallback aman. |
| **Officer-in-the-loop sebagai gerbang wajib**                     | Peninjauan petugas ditegakkan pada lapisan API melalui penolakan HTTP `422`, bukan sekadar instruksi pada antarmuka yang dapat dilewati.                                                                                                                                                                                                |
| **Supabase dan Prisma sebagai fondasi data**                      | Supabase menyediakan PostgreSQL, autentikasi, dan penyimpanan privat dalam satu platform. Prisma digunakan untuk pengelolaan data relasional, sedangkan RLS menjadi lapisan pengaman tambahan di atas otorisasi API.                                                                                                                    |
| **OpenRouter untuk integrasi AI**                                 | Model `minimax/minimax-m3:free` memungkinkan demonstrasi AI nyata tanpa biaya API selama hackathon. Validasi tetap ketat; sistem mencoba ulang hingga 10 kali sebelum menggunakan fallback deterministik.                                                                                                                               |
| **Event log untuk seluruh perubahan kasus**                       | Setiap aksi yang mengubah status menulis satu `caseEvent`. Linimasa dibangun dari rekaman kejadian, bukan direkonstruksi dari kondisi terakhir, sehingga riwayat kasus tetap utuh dan dapat diaudit.                                                                                                                                    |

## Kompromi MVP

* **Belum tersedia OCR, integrasi INSW/CEISA, serta notifikasi WhatsApp atau email.** Ruang lingkup difokuskan pada lima fitur inti agar alur utama benar-benar selesai dan teruji.
* **Model AI gratis memiliki keluaran yang kurang konsisten.** Retry meningkatkan keberhasilan, sementara fallback deterministik memastikan narasi tetap aman dan akurat meskipun menjadi kurang variatif.
* **Verifikasi email, reset password, dan 2FA belum diterapkan.** Fitur tersebut tidak termasuk kebutuhan inti brief dan sengaja ditunda untuk mengurangi kompleksitas autentikasi.
* **RLS menggunakan strategi deny-all.** Otorisasi utama ditegakkan pada lapisan API melalui `lib/server/auth.ts` dan `case-state.ts`; RLS berfungsi sebagai jaring pengaman jika kunci publik digunakan secara tidak sengaja.
* **Deploy hanya menggunakan satu lingkungan production di Vercel.** Tidak ada staging terpisah untuk skala hackathon, sehingga mitigasinya adalah pengujian endpoint langsung terhadap database live sebelum demo.

## Prinsip Akhir

JalurEkspor tidak mencoba menggantikan petugas ekspor. Sistem ini memastikan bahwa **mesin menangani konsistensi, AI membantu komunikasi, dan manusia tetap memegang keputusan berisiko tinggi**.
