import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono, IBM_Plex_Sans } from 'next/font/google'
import { Courier_Prime } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const _courierPrime = Courier_Prime({ weight: ["400", "700"], subsets: ["latin"] });
const _ibmPlexSans = IBM_Plex_Sans({ weight: ["300", "400", "500", "600"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'JalurEkspor — Export-readiness assessment',
  description: 'Pahami kesiapan bisnis UMKM untuk ekspor melalui assessment yang praktis dan relevan.',
  keywords: ['JalurEkspor', 'UMKM ekspor', 'export readiness', 'assessment ekspor'],
  authors: [{ name: 'JalurEkspor' }],
  openGraph: {
    title: 'JalurEkspor — Export-readiness assessment',
    description: 'Pahami kesiapan bisnis UMKM untuk ekspor melalui assessment yang praktis dan relevan.',
    type: 'website',
    url: 'https://jalurekspor.id',
    siteName: 'JalurEkspor',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JalurEkspor — Export-readiness assessment',
    description: 'Pahami kesiapan bisnis UMKM untuk ekspor melalui assessment yang praktis dan relevan.',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body className={`font-sans antialiased`}>
        {children}
        <Toaster position="top-center" />
        <Analytics />
      </body>
    </html>
  )
}
