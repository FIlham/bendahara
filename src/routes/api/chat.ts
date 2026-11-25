import { createFileRoute } from "@tanstack/react-router";
import {
    chat,
    chatParamsFromRequest,
    maxIterations,
    toServerSentEventsResponse,
} from "@tanstack/ai";
import { createGeminiChat } from "@tanstack/ai-gemini";
import { auth } from "@/lib/auth/server";
import { aiConfig, systemPrompt } from "@/lib/server/ai";
import { buildTools } from "@/lib/server/ai-tools";
import { takeAiSlot } from "@/lib/server/ai-limit";

/** Batas ukuran percakapan yang dikirim klien (karakter JSON). */
const MAX_BODY_CHARS = 20_000;
/** Riwayat yang dikirim ke model; makin pendek makin murah konteks. */
const MAX_HISTORY = 10;

/**
 * Endpoint chat AI (SSE). Role dibaca dari session di sini: tool tulis hanya
 * dipasang untuk bendahara, dan approval dari klien tidak bisa menambah tool.
 */
export const Route = createFileRoute("/api/chat")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                const session = await auth.api.getSession({
                    headers: request.headers,
                });
                if (!session) {
                    return Response.json(
                        { error: "Unauthorized" },
                        { status: 401 },
                    );
                }
                const config = aiConfig();
                if (!config) {
                    return Response.json(
                        {
                            error: "Chatbot belum aktif: set GEMINI_API_KEY atau cek AI_DISABLED",
                        },
                        { status: 503 },
                    );
                }

                const params = await chatParamsFromRequest(request);
                if (JSON.stringify(params.messages).length > MAX_BODY_CHARS) {
                    return Response.json(
                        { error: "Percakapan terlalu panjang" },
                        { status: 413 },
                    );
                }

                // Kuota free tier dihitung per request, jadi batasi sebelum
                // memanggil model (termasuk request resume approval).
                const slot = await takeAiSlot(session.user.id);
                if (!slot.ok) {
                    return Response.json(
                        { error: "Batas pemakaian AI tercapai" },
                        {
                            status: 429,
                            headers: {
                                "retry-after": String(slot.retryAfterSeconds),
                            },
                        },
                    );
                }

                const role = (session.user as { role?: string }).role ?? "user";

                const stream = chat({
                    adapter: createGeminiChat(config.model, config.apiKey),
                    systemPrompts: [systemPrompt(role === "bendahara")],
                    // Resume approval butuh pesan lengkap agar panggilan tool
                    // yang tertunda bisa dibangun ulang.
                    messages: params.resume
                        ? params.messages
                        : params.messages.slice(-MAX_HISTORY),
                    threadId: params.threadId,
                    runId: params.runId,
                    parentRunId: params.parentRunId,
                    ...(params.resume ? { resume: params.resume } : {}),
                    tools: buildTools({
                        actorId: session.user.id,
                        isBendahara: role === "bendahara",
                    }),
                    // Hemat kuota: maksimal 3 putaran model, tanpa retry otomatis,
                    // jawaban pendek.
                    agentLoopStrategy: maxIterations(3),
                    retry: { maxRetries: 0 },
                    modelOptions: { maxOutputTokens: 700, temperature: 0.3 },
                });

                return toServerSentEventsResponse(stream);
            },
        },
    },
});
