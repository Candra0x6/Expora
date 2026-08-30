import type { Metadata } from "next"
import { AuthDaftar } from "@/components/auth-daftar"

export const metadata: Metadata = {
  title: "Daftar — JalurEkspor",
  description: "Buat akun UMKM untuk memulai assessment kesiapan ekspor.",
}

export default function Page() {
  return <AuthDaftar />
}
