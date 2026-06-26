// supabase/functions/iris-chat/index.ts
// Asistente IA de Iris — proxy seguro a la API de Anthropic.
// La API key vive en el servidor (variable de entorno), nunca en el cliente.
//
// DESPLIEGUE (desde la terminal o Claude Code):
//   supabase functions deploy iris-chat --no-verify-jwt
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Luego pegá la URL pública (…/functions/v1/iris-chat) en Iris › Ajustes › Asistente IA.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = "claude-haiku-4-5-20251001"; // cambialo por otro modelo si querés

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const { question, context, history } = await req.json();

    const system =
      `Sos "Iris", la asistente personal y asesora financiera de ${context?.nombre ?? "el usuario"} ` +
      `(Argentina, moneda ARS). Hablás en español rioplatense, con calidez, claridad y respuestas breves y accionables. ` +
      `Sos también su organizadora: podés responder sobre sus tareas, eventos y compras del día. ` +
      `Para finanzas, das consejos concretos (regla 50/30/20, fondo de emergencia, priorizar deudas de mayor interés), ` +
      `siempre basándote en los datos reales de abajo. No inventes cifras; si falta info, pedila amablemente.\n\n` +
      `DATOS DEL USUARIO (JSON):\n${JSON.stringify(context ?? {}, null, 2)}`;

    // El historial llega como [{r:"me"|"ai", t:"..."}]; lo mapeamos a roles de Anthropic.
    const messages = [
      ...(Array.isArray(history) ? history : []).map((m: any) => ({
        role: m.r === "me" ? "user" : "assistant",
        content: String(m.t ?? "").replace(/<[^>]+>/g, ""),
      })),
      { role: "user", content: String(question ?? "") },
    ];

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system, messages }),
    });

    const data = await resp.json();
    const reply = data?.content?.[0]?.text ?? "No pude generar una respuesta en este momento.";
    return new Response(JSON.stringify({ reply }), {
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
