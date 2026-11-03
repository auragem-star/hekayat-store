// POST /api/admin  { key, action: "list" }                 -> all reviews of every story
// POST /api/admin  { key, action: "delete", id, rid }      -> remove one review
import crypto from "node:crypto";
import { BOOK_IDS, readJSON, update, emptyBook, saveSummary, publicBook, bodyOf, send } from "./_store.js";

function okKey(k) {
  const real = process.env.ADMIN_KEY || "";
  if (!real || typeof k !== "string") return false;
  const a = Buffer.from(k), b = Buffer.from(real);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  const { key, action, id, rid } = bodyOf(req);
  if (!okKey(key)) return send(res, 401, { error: "key" });
  try {
    if (action === "list") {
      const out = {};
      for (const b of BOOK_IDS) out[b] = publicBook((await readJSON(`feedback/${b}.json`, emptyBook())).data);
      return send(res, 200, out);
    }
    if (action === "delete" && BOOK_IDS.includes(id) && rid) {
      const book = await update(`feedback/${id}.json`, emptyBook(), (b) => { b.reviews = (b.reviews || []).filter((r) => r.rid !== rid); return b; });
      await saveSummary(id, book);
      return send(res, 200, { ok: true });
    }
    return send(res, 400, { error: "action" });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "server" });
  }
}
