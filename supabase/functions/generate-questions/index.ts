import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getGeminiText(responseJson: any): string | null {
  const parts = responseJson?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
  return text || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, numAnswers, numQuestions } = await req.json();

    if (!topic || !numAnswers || !numQuestions) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Optional override via secrets: GEMINI_MODEL (e.g. "gemini-1.5-flash", "gemini-2.0-flash")
    const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-1.5-flash";

    const systemPrompt = `You are a quiz question generator. Generate quiz questions in Hebrew. 
Each question must have exactly ${numAnswers} answer options, with exactly one correct answer marked.
Return ONLY valid JSON array with no markdown formatting. Each element should have:
- "text": the question text (string)
- "answers": array of objects with "text" (string) and "is_correct" (boolean)
Ensure exactly one answer per question has is_correct=true.
Make the questions interesting, varied, and educational.`;

    const userPrompt = `צור ${numQuestions} שאלות חידון בנושא: "${topic}". כל שאלה עם ${numAnswers} תשובות, כאשר תשובה אחת בדיוק נכונה.`;

    const responseSchema = {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              answers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    is_correct: { type: "boolean" },
                  },
                  required: ["text", "is_correct"],
                  additionalProperties: false,
                },
                minItems: Number(numAnswers),
                maxItems: Number(numAnswers),
              },
            },
            required: ["text", "answers"],
            additionalProperties: false,
          },
        },
      },
      required: ["questions"],
      additionalProperties: false,
    } as const;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.7,
        },
      }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return jsonResponse({ error: "יותר מדי בקשות, נסה שוב מאוחר יותר" }, 429);
      }
      const t = await response.text();
      console.error("Gemini error:", response.status, t);
      return jsonResponse({ error: "שגיאה ביצירת שאלות" }, 500);
    }

    const data = await response.json();
    const text = getGeminiText(data);
    if (!text) {
      console.error("No text in Gemini response:", JSON.stringify(data));
      return jsonResponse({ error: "שגיאה בפירוש התשובה מה-AI" }, 500);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse Gemini JSON:", e, "raw:", text);
      return jsonResponse({ error: "שגיאה בפירוש התשובה מה-AI" }, 500);
    }

    const questions = parsed?.questions;
    if (!Array.isArray(questions)) {
      console.error("Unexpected Gemini payload:", JSON.stringify(parsed));
      return jsonResponse({ error: "שגיאה בפירוש התשובה מה-AI" }, 500);
    }

    // Validate and fix: ensure exactly one correct answer per question
    for (const q of questions) {
      const correctCount = q.answers.filter((a: any) => a.is_correct).length;
      if (correctCount === 0 && q.answers.length > 0) {
        q.answers[0].is_correct = true;
      } else if (correctCount > 1) {
        let found = false;
        for (const a of q.answers) {
          if (a.is_correct && found) a.is_correct = false;
          if (a.is_correct) found = true;
        }
      }
    }

    return jsonResponse({ questions });
  } catch (e) {
    console.error("generate-questions error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
