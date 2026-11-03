// POST /api/review  { id, name, stars, text, website }   (website = hidden trap field for bots)
import crypto from "node:crypto";
import { BOOK_IDS, update, emptyBook, saveSummary, ipHash, bodyOf, send } from "./_store.js";

const clean = (s, max) => String(s || "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const HOURS = 12;

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  const body = bodyOf(req);
  const id = body.id;
  const name = clean(body.name, 30);
  const text = clean(body.text, 400);
  const stars = Number(body.stars);
  if (body.website) return send(res, 200, { ok: true }); // bot
  if (!BOOK_IDS.includes(id)) return send(res, 400, { error: "book" });
  if (name.length < 2) return send(res, 400, { error: "name", msg: "اكتب اسمك (حرفين على الأقل)." });
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return send(res, 400, { error: "stars", msg: "اختار عدد النجوم من ١ لـ ٥." });
  if (text.length < 3) return send(res, 400, { error: "text", msg: "اكتب رأيك في القصة." });
  if (/https?:|www\.|\.com\b|\.net\b/i.test(text + " " + name)) return send(res, 400, { error: "link", msg: "من فضلك من غير روابط في التقييم." });
  const who = ipHash(req);
  const now = Date.now();
  let tooSoon = false;
  let saved = null;
  try {
    const book = await update(`feedback/${id}.json`, emptyBook(), (b) => {
      b.ips = b.ips || {};
      for (const k of Object.keys(b.ips)) if (now - b.ips[k] > HOURS * 3600e3) delete b.ips[k];
      if (b.ips[who]) { tooSoon = true; return b; }
      saved = { rid: crypto.randomUUID().slice(0, 12), name, stars, text, at: now };
      b.reviews = [saved, ...(b.reviews || [])].slice(0, 500);
      b.ips[who] = now;
      return b;
    });
    if (tooSoon) return send(res, 429, { error: "soon", msg: "إنت كتبت تقييم للقصة دي من شوية. شكرًا ليك!" });
    await saveSummary(id, book);
    return send(res, 200, { ok: true, review: saved });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "server", msg: "حصلت مشكلة، جرّب تاني بعد شوية." });
  }
}
