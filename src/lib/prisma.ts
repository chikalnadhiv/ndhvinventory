// Prisma client singleton for the application
import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
    // We only import native adapters if we are in a Node.js environment.
    // This prevents the 'fs' module error in Edge Runtime / Middleware.
    if (typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge') {
        const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
        const adapter = new PrismaBetterSqlite3({ 
            url: process.env.DATABASE_URL || "file:./prisma/dev.db" 
        })
        return new PrismaClient({ adapter })
    }
    
    // Fallback for Edge runtime (middleware) - it shouldn't actually call prisma methods,
    // but the singleton needs to exist if imported.
    return new PrismaClient()
}

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined
}

const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
