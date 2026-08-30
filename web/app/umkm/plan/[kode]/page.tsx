import type { Metadata } from "next"
import { JalurEksporUmkmPlan } from "@/components/jalurekspor-umkm-plan"

export const metadata: Metadata = {
  title: "Rencana Pendampingan — JalurEkspor",
  description: "Rencana pendampingan ekspor yang telah ditinjau petugas.",
}

export default async function Page({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params
  return <JalurEksporUmkmPlan kode={kode} />
}
