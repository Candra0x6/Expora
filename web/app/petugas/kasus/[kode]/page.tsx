import type { Metadata } from "next"
import { JalurEksporOfficerCase } from "@/components/jalurekspor-officer-case"

export const metadata: Metadata = {
  title: "Ruang review kasus — JalurEkspor",
  description: "Tinjau kasus UMKM: konteks, kesiapan, draft AI, data pendukung, dan riwayat.",
}

export default async function Page({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params
  return <JalurEksporOfficerCase kode={kode} />
}
