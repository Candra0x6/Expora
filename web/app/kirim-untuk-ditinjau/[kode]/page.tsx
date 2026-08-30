import type { Metadata } from "next"
import { JalurEksporSubmission } from "@/components/jalurekspor-submission"

export const metadata: Metadata = {
  title: "Kirim untuk ditinjau — JalurEkspor",
  description: "Kirim ringkasan kesiapan ekspor UMKM untuk ditinjau petugas.",
}

export default async function Page({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params
  return <JalurEksporSubmission kode={kode} />
}
