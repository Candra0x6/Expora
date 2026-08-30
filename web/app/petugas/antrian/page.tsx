import { Suspense } from "react"
import type { Metadata } from "next"
import { JalurEksporOfficerQueue } from "@/components/jalurekspor-officer-queue"

export const metadata: Metadata = {
  title: "Antrean review petugas — JalurEkspor",
  description: "Antrean kasus UMKM yang perlu ditinjau petugas JalurEkspor.",
}

export default function Page() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f5f4f0]" />}>
      <JalurEksporOfficerQueue />
    </Suspense>
  )
}
