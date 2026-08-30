import type { Metadata } from "next"
import { JalurEksporResult } from "@/components/jalurekspor-result"

export const metadata: Metadata = {
  title: "Hasil kesiapan — JalurEkspor",
  description: "Profil kesiapan ekspor enam dimensi beserta langkah prioritas.",
}

export default async function Page({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params
  return <JalurEksporResult kode={kode} />
}
