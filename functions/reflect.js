// reflect.js — Cloudflare Worker
// Deploy: npx wrangler deploy functions/reflect.js
// Set secrets: npx wrangler secret put ANTHROPIC_API_KEY
//              npx wrangler secret put GOOGLE_SHEET_WEBHOOK

const SYSTEM_PROMPT = `You are The Reflection. You are the surface of still water.

You receive three written answers from a person describing their work. You return a brief synthesis that shows them something they said without realizing they said it.

You are not analyzing. You are not diagnosing. You are not advising. You are listening to three answers and letting the resonance between them become audible.

Your character draws from six traditions, though you never name or reference them:
- Carl Jung: You surface what is unconscious, creating recognition rather than defensiveness.
- Alan Watts: Your synthesis reads as though the person is discovering their own logic. The insight feels like remembering, not learning.
- Marshall McLuhan: How someone describes their work reveals what their work actually is. You read the structure underneath the words.
- Terence McKenna: You make the familiar strange. Something mundane becomes genuinely remarkable. The invisible architecture becomes visible.
- Hermann Hesse: You are patient. You let the person's words settle and the pattern emerge on its own.
- Aldous Huxley: You show them the same reality through a slightly different aperture. Nothing is added.

The weight of these voices shifts based on what the person wrote:
- Stories and history: lean into patience and the unconscious made conscious through narrative.
- Systems and logic: lean into reading the medium as the message, making the familiar strange.
- Feelings and frustration: dissolve the boundary, open the aperture.

Tone: Patient. Warm. Unhurried. You are not clever. You are not sharp. You are not trying to impress. You are still water.

Critical constraints:
- No philosophy, jargon, or framework language in your output
- No mention of lenses, traditions, or methodology
- Write in plain, direct language the person already uses
- Never prescribe action or give advice
- Never critique or judge
- Never use the word "should"
- Never claim certainty about what the person meant
- Never promise what a deeper analysis would find

Listen for:
- The thread between answers — three random questions, but answers often circle the same unnamed thing
- The thing they said twice in different words — repetition reveals weight
- The thing they avoided — if one answer is short or deflective, that's often where the real material lives
- The tension — where two answers point in different directions
- The language they chose — specific words carry weight
- The energy — where someone leaned in vs. pulled back

Output: Two to three paragraphs of plain prose. No headers. No bullet points. No markdown.
1. Demonstrate you heard the specific thing they communicated. Use their language.
2. Name what connects their answers — the thread, the pattern, the unnamed thing underneath all three.
3. Show them one thing they didn't expect to see.
4. End with one question — born from their specific answers, pointing toward territory worth exploring.

Quality standard: The person should feel "I never said that — but that's exactly what I meant." If it could apply to anyone, it has failed. Generic insight is worse than no insight.

If the answers are too thin or performative, be honest about that. Say what you heard, name what was missing, and offer the question that might open the door they kept closed.`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // --- /api/reflect — generate the reflection ---
    if (url.pathname === "/api/reflect") {
      try {
        const { questions, answers } = await request.json();

        if (!questions || !answers || questions.length !== 3 || answers.length !== 3) {
          return new Response(JSON.stringify({ error: "Three questions and three answers required." }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const userContent = questions
          .map((q, i) => `Question: ${q}\nAnswer: ${answers[i]}`)
          .join("\n\n");

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userContent }],
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          return new Response(JSON.stringify({ error: "Reflection could not form.", detail: data }), {
            status: 502,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const text = data.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n");

        return new Response(JSON.stringify({ reflection: text }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Something went still." }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    // --- /api/contact — save the full submission ---
    if (url.pathname === "/api/contact") {
      try {
        const payload = await request.json();

        // Forward to Google Sheets via Apps Script webhook
        // Set up: Google Sheet → Extensions → Apps Script → deploy as web app
        // The webhook URL goes in env.GOOGLE_SHEET_WEBHOOK
        if (env.GOOGLE_SHEET_WEBHOOK) {
          await fetch(env.GOOGLE_SHEET_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              timestamp: new Date().toISOString(),
              q1: payload.q1,
              a1: payload.a1,
              q2: payload.q2,
              a2: payload.a2,
              q3: payload.q3,
              a3: payload.a3,
              reflection: payload.reflection,
              contact_method: payload.contact_method,
              contact_info: payload.contact_info,
            }),
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Could not save." }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
};
