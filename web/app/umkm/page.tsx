import type { Metadata } from "next"
import { JalurEksporUmkmDashboard } from "@/components/jalurekspor-umkm-dashboard"

export const metadata: Metadata = {
  title: "Dashboard UMKM — JalurEkspor",
  description: "Kasus pendampingan ekspor, status, dan tindakan berikutnya.",
}

export default function Page() {
  return <JalurEksporUmkmDashboard />
}
