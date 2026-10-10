"use server";

import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";

const code = z.string().regex(/^[A-Z]{3}$/);

/** UAH per one unit of a currency, from the National Bank of Ukraine (free, no key). */
async function nbuRate(cc: string): Promise<{ rate: number; date: string } | null> {
  if (cc === "UAH") return { rate: 1, date: "" };
  try {
    const res = await fetch(`https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=${cc}&json`, {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = z.array(z.object({ rate: z.number().positive(), exchangedate: z.string() })).parse(await res.json());
    return rows[0] ? { rate: rows[0].rate, date: rows[0].exchangedate } : null;
  } catch {
    return null;
  }
}

export interface ExchangeRate {
  /** How many `to` one `from` is worth. */
  rate: number;
  /** The NBU's date for the rate, e.g. "12.10.2026". */
  date: string;
}

/** Today's official rate from one currency to another (via UAH). */
export async function getExchangeRate(from: string, to: string): Promise<ActionResult<ExchangeRate>> {
  await requireUser();
  if (!code.safeParse(from).success || !code.safeParse(to).success) return { ok: false, error: "Unknown currency." };
  if (from === to) return { ok: true, data: { rate: 1, date: "" } };
  const [a, b] = await Promise.all([nbuRate(from), nbuRate(to)]);
  if (!a || !b) return { ok: false, error: "Couldn't get today's rate from the National Bank of Ukraine." };
  // Keep the rate precise; only amounts are rounded to cents (see convert).
  return { ok: true, data: { rate: Math.round((a.rate / b.rate) * 1_000_000) / 1_000_000, date: a.date || b.date } };
}
