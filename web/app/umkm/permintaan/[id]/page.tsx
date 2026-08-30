import type { Metadata } from "next"
import { JalurEksporPermintaan } from "@/components/jalurekspor-permintaan"

export const metadata: Metadata = {
  title: "Permintaan informasi — JalurEkspor",
  description: "Jawab permintaan informasi tambahan dari petugas pendamping.",
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <JalurEksporPermintaan id={id} />
}
