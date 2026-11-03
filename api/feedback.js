// GET /api/feedback            -> likes and rating summary for every story
// GET /api/feedback?id=<story> -> likes, rating and latest reviews for one story
import { BOOK_IDS, readJSON, emptyBook, publicBook, send } from "./_store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "method" });
  try {
    const id = String((req.query && req.query.id) || "");
    if (!id) {
      const { data } = await readJSON("feedback/summary.json", {});
      return send(res, 200, data, "public, s-maxage=15, stale-while-revalidate=60");
    }
    if (!BOOK_IDS.includes(id)) return send(res, 404, { error: "book" });
    const { data } = await readJSON(`feedback/${id}.json`, emptyBook());
    return send(res, 200, publicBook(data), "public, s-maxage=10, stale-while-revalidate=60");
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "server" });
  }
}
