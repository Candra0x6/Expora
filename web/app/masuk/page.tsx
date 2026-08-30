import { Suspense } from "react"
import type { Metadata } from "next"
import { AuthMasuk } from "@/components/auth-masuk"

export const metadata: Metadata = {
  title: "Masuk — JalurEkspor",
  description: "Masuk ke ruang pendampingan kesiapan ekspor JalurEkspor.",
}

export default function Page() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f5f4f0]" />}>
      <AuthMasuk />
    </Suspense>
  )
}
