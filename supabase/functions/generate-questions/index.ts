import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, numAnswers, numQuestions } = await req.json();

    if (!topic || !numAnswers || !numQuestions) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a quiz question generator. Generate quiz questions in Hebrew. 
Each question must have exactly ${numAnswers} answer options, with exactly one correct answer marked.
Return ONLY valid JSON array with no markdown formatting. Each element should have:
- "text": the question text (string)
- "answers": array of objects with "text" (string) and "is_correct" (boolean)
Ensure exactly one answer per question has is_correct=true.
Make the questions interesting, varied, and educational.`;

    const userPrompt = `צור ${numQuestions} שאלות חידון בנושא: "${topic}". כל שאלה עם ${numAnswers} תשובות, כאשר תשובה אחת בדיוק נכונה.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_questions",
              description: "Return generated quiz questions",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "The question text in Hebrew" },
                        answers: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              text: { type: "string", description: "Answer text in Hebrew" },
                              is_correct: { type: "boolean", description: "Whether this is the correct answer" },
                            },
                            required: ["text", "is_correct"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["text", "answers"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_questions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב מאוחר יותר" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "נדרש תשלום, הוסף קרדיטים" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "שגיאה ביצירת שאלות" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "שגיאה בפירוש התשובה מה-AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const questions = parsed.questions;

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

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-questions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
