// Shared storage helpers for likes and reviews (Vercel Blob, private store).
import crypto from "node:crypto";

// Story ids that can be liked or reviewed. Add the id here when a new story is added to assets/data.js.
export const BOOK_IDS = ["nuri-1", "nuri-2", "nuri-3", "filo", "zuzu", "basbousa", "arnouba", "simsim"];

let backend = null;
export function setBackend(b) { backend = b; }

async function blobBackend() {
  if (backend) return backend;
  const blob = await import("@vercel/blob");
  backend = {
    async read(path) {
      const r = await blob.get(path, { access: "private", useCache: false });
      if (!r || r.statusCode !== 200) return null;
      return { text: await new Response(r.stream).text(), etag: r.blob.etag };
    },
    async write(path, text, etag) {
      const opts = { access: "private", contentType: "application/json", addRandomSuffix: false, cacheControlMaxAge: 60 };
      if (etag) opts.ifMatch = etag; else opts.allowOverwrite = false;
      await blob.put(path, text, opts);
    },
  };
  return backend;
}

export async function readJSON(path, fallback) {
  const b = await blobBackend();
  const r = await b.read(path);
  if (!r) return { data: structuredClone(fallback), etag: null };
  try { return { data: JSON.parse(r.text), etag: r.etag }; } catch { return { data: structuredClone(fallback), etag: r.etag }; }
}

// Read-modify-write with optimistic locking, so two visitors liking at the same moment don't overwrite each other.
export async function update(path, fallback, fn) {
  const b = await blobBackend();
  for (let i = 0; i < 8; i++) {
    const { data, etag } = await readJSON(path, fallback);
    const next = fn(data);
    try {
      await b.write(path, JSON.stringify(next), etag);
      return next;
    } catch (e) {
      const conflict = /precondition|already exists|etag/i.test(String(e && (e.name + " " + e.message)));
      if (!conflict) throw e;
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
    }
  }
  throw new Error("busy");
}

export const emptyBook = () => ({ likes: 0, reviews: [], ips: {} });

export function summaryOf(book) {
  const count = book.reviews.length;
  const sum = book.reviews.reduce((a, r) => a + r.stars, 0);
  return { likes: book.likes, count, avg: count ? Math.round((sum / count) * 10) / 10 : 0 };
}

export async function saveSummary(id, book) {
  await update("feedback/summary.json", {}, (s) => { s[id] = summaryOf(book); return s; });
}

export function publicBook(book) {
  return {
    ...summaryOf(book),
    reviews: book.reviews.slice().sort((a, b) => b.at - a.at).slice(0, 60).map(({ rid, name, stars, text, at }) => ({ rid, name, stars, text, at })),
  };
}

export function ipHash(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
  return crypto.createHash("sha256").update("hekayat:" + ip).digest("hex").slice(0, 16);
}

export function bodyOf(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}

export function send(res, code, obj, cache) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache || "no-store");
  res.end(JSON.stringify(obj));
}
