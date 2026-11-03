// POST /api/like  { id, liked: true|false }
import { BOOK_IDS, update, emptyBook, saveSummary, bodyOf, send } from "./_store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  const { id, liked } = bodyOf(req);
  if (!BOOK_IDS.includes(id) || typeof liked !== "boolean") return send(res, 400, { error: "input" });
  try {
    const book = await update(`feedback/${id}.json`, emptyBook(), (b) => {
      b.likes = Math.max(0, (b.likes || 0) + (liked ? 1 : -1));
      return b;
    });
    await saveSummary(id, book);
    return send(res, 200, { likes: book.likes });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "server" });
  }
}
