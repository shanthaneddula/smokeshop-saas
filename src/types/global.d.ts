// Global type augmentation for Next.js
import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';

declare global {
  var prisma: PrismaClient | undefined;
  var mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

export {};
