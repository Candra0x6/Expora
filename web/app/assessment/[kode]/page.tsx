import type { Metadata } from "next"
import { JalurEksporAssessment } from "@/components/jalurekspor-assessment"

export const metadata: Metadata = {
  title: "Assessment kesiapan ekspor — JalurEkspor",
  description: "Assessment adaptif yang menyesuaikan pertanyaan dengan kondisi usaha.",
}

export default async function Page({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params
  return <JalurEksporAssessment kode={kode} />
}
