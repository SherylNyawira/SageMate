import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLLMProvider } from "@/lib/llm/factory";
import { getQuestionSetSourceText } from "@/lib/questionSets";
import { discussionMessageSchema } from "@/lib/validation/attempts";

type RouteParams = { params: Promise<{ gradingId: string }> };

// Keep the conversation sent to the model bounded; the grading context is always included.
const MAX_HISTORY_MESSAGES = 20;

export async function GET(_request: Request, { params }: RouteParams) {
  const { gradingId } = await params;
  const messages = await db.discussionMessage.findMany({
    where: { gradingId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ messages });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { gradingId } = await params;

  const grading = await db.grading.findUnique({
    where: { id: gradingId },
    include: {
      attempt: { include: { question: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!grading) {
    return NextResponse.json({ error: "Grading not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = discussionMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { question } = grading.attempt;
  const history = [
    ...grading.messages.map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
    { role: "user" as const, content: parsed.data.content },
  ].slice(-MAX_HISTORY_MESSAGES);

  let reply: string;
  try {
    const llm = getLLMProvider();
    const sourceText = await getQuestionSetSourceText(question.questionSetId);
    reply = await llm.discussAnswer({
      questionText: question.text,
      sourceText,
      answerText: grading.attempt.answerText,
      marks: question.marks ?? undefined,
      markingScheme: question.markingScheme ?? undefined,
      grading: {
        score: grading.score,
        marksAwarded: grading.marksAwarded,
        feedback: grading.feedback,
        modelAnswer: grading.modelAnswer ?? undefined,
      },
      history,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not get a reply: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  // Only persist the exchange once the reply exists, so a failed call leaves no orphan message.
  // Explicit timestamps keep the pair in order even if both land in the same millisecond.
  const now = Date.now();
  const [userMessage, assistantMessage] = await db.$transaction([
    db.discussionMessage.create({
      data: { gradingId, role: "USER", content: parsed.data.content, createdAt: new Date(now) },
    }),
    db.discussionMessage.create({
      data: { gradingId, role: "ASSISTANT", content: reply, createdAt: new Date(now + 1) },
    }),
  ]);

  return NextResponse.json({ messages: [userMessage, assistantMessage] }, { status: 201 });
}
