import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Ein einziger PrismaClient pro Prozess.
 *
 * Im Entwicklungsmodus lädt Next.js Module bei jeder Änderung neu. Ohne diesen
 * Zwischenspeicher entstünde bei jedem Reload eine neue Datenbankverbindung,
 * bis SQLite keine mehr annimmt.
 *
 * Ab Prisma 7 läuft der Zugriff über einen Treiber-Adapter. Für den Wechsel
 * auf Postgres wird hier später nur der Adapter getauscht, der restliche
 * Anwendungscode bleibt unverändert.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL fehlt. Lege eine .env an: cp .env.example .env",
    );
  }

  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
