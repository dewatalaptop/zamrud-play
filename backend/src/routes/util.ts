import type { Request, RequestHandler, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { hasSyncHook, syncDb } from "../db/persistence";

export const h = (fn: (req: Request, res: Response) => unknown | Promise<unknown>): RequestHandler =>
  asyncHandler(async (req, res) => {
    const out = await fn(req, res);
    // Bila persistensi aktif (Cloud Functions), simpan DB sebelum membalas agar data tak hilang saat instance dibekukan.
    if (hasSyncHook() && req.method !== "GET" && !res.locals.noSync) await syncDb();
    if (!res.headersSent) res.json({ ok: true, data: out ?? null });
  });

export const uid = (req: Request) => req.user!.id;

export const PageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(40).optional(),
});
export const PageNumQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
