export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/data") {
      if (request.method === "GET") {
        const raw = await env.HANDLELISTE_KV.get("state");
        const data = raw ? JSON.parse(raw) : { items: [] };
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" }
        });
      }
      if (request.method === "PUT") {
        const body = await request.text();
        JSON.parse(body); // validate before storing
        await env.HANDLELISTE_KV.put("state", body);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
