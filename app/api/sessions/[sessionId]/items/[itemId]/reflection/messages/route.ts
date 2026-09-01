import { NextResponse } from "next/server";
import { FunctionCallingConfigMode } from "@google/genai";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini";
import { ASK_QUESTION_TOOL, COMPLETE_REFLECTION_TOOL, resolveToolChoice } from "@/lib/reflection-tools";
import { buildReflectionUserMessage, REFLECTION_SYSTEM_PROMPT } from "@/lib/reflection-prompt";
import { applyStatePatch } from "@/lib/reflection-state";
import { appendReflectionTurn, getReflectionState, saveReflectionState } from "@/lib/repositories/reflection-repository";
import type { ReflectionState } from "@/lib/types";

type AskInput = { reflection: string; question: string; statePatch?: Partial<ReflectionState> };
type CompleteInput = { reflection: string; summary?: Partial<ReflectionState> };

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string; itemId: string }> }): Promise<Response> {
  const { sessionId, itemId } = await params;
  const body = await request.json().catch(() => null);
  if (!body?.message) return NextResponse.json({ error: "message is required" }, { status: 400 });
  const currentState = await getReflectionState(sessionId, itemId);
  if (!currentState) return NextResponse.json({ error: "reflection not found" }, { status: 404 });
  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: buildReflectionUserMessage(currentState.itemName, currentState, body.message),
    config: {
      systemInstruction: REFLECTION_SYSTEM_PROMPT,
      tools: [{ functionDeclarations: [ASK_QUESTION_TOOL, COMPLETE_REFLECTION_TOOL] }],
      toolConfig: { functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,
        allowedFunctionNames: resolveToolChoice(currentState),
      } },
    },
  });
  const functionCall = response.functionCalls?.[0];
  if (!functionCall) return NextResponse.json({ error: "Gemini did not call a function" }, { status: 502 });
  if (functionCall.name === "ask_question") {
    const input = functionCall.args as AskInput;
    const nextState = applyStatePatch(currentState, input.statePatch ?? {});
    await saveReflectionState(sessionId, itemId, nextState);
    await appendReflectionTurn(sessionId, itemId, {
      turnIndex: nextState.turnCount, userMessage: body.message, assistantAction: "ask",
      assistantReflectionText: input.reflection, question: input.question, createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ action: "ask", reflection: input.reflection, question: input.question });
  }
  if (functionCall.name !== "complete_reflection") {
    return NextResponse.json({ error: "Gemini called an unsupported function" }, { status: 502 });
  }
  const input = functionCall.args as CompleteInput;
  const nextState = applyStatePatch({ ...currentState, status: "ready_for_decision" }, input.summary ?? {});
  await saveReflectionState(sessionId, itemId, nextState);
  await appendReflectionTurn(sessionId, itemId, {
    turnIndex: nextState.turnCount, userMessage: body.message, assistantAction: "complete",
    assistantReflectionText: input.reflection, createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ action: "complete", reflection: input.reflection, summary: {
    reasonsToKeep: nextState.reasonsToKeep, reasonsToLetGo: nextState.reasonsToLetGo,
    memoryToPreserve: nextState.memoryToPreserve, regretIfSold: nextState.regretIfSold,
    regretIfKept: nextState.regretIfKept, unresolved: nextState.unresolved,
  } });
}
