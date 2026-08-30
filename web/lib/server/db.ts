/**
 * Singleton Prisma Client.
 *
 * Pola global supaya hot reload di `next dev` tidak membuka koneksi baru setiap
 * kali berkas berubah — kalau tidak, pooler Supabase cepat penuh.
 *
 * `DATABASE_URL` di sini adalah URL POOLER (:6543 `?pgbouncer=true`).
 * `DIRECT_URL` (:5432) hanya dipakai `prisma migrate` / `prisma db seed`.
 */

import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
