export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Método no permitido", { status: 405 });
    }

    try {
      // El front manda: { system: "...", messages: [{role:"user"|"assistant", content:"..."}] }
      const body = await request.json();

      // Gemini usa "model" en vez de "assistant", y el system va aparte como systemInstruction
      const contents = (body.messages || []).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const geminiBody = {
        contents,
        systemInstruction: body.system ? { parts: [{ text: body.system }] } : undefined,
      };

      const model = "gemini-2.5-flash";
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY,
          },
          body: JSON.stringify(geminiBody),
        }
      );

      const data = await geminiResponse.json();

      // Normalizamos la respuesta al mismo formato que ya usa el front (estilo Anthropic)
      const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
      const normalized = { content: [{ type: "text", text }], raw: data };

      return new Response(JSON.stringify(normalized), {
        status: geminiResponse.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Error interno del proxy" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },
};
