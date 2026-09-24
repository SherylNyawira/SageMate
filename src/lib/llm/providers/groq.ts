import Groq from "groq-sdk";
import { z } from "zod";
import {
  buildDiscussAnswerSystemPrompt,
  buildGenerateQuestionsPrompt,
  buildGradeAnswerBatchPrompt,
  buildGradeAnswerPrompt,
} from "../prompts";
import type {
  DiscussAnswerInput,
  GenerateQuestionsInput,
  GeneratedQuestion,
  GradeAnswerBatchItem,
  GradeAnswerBatchResult,
  GradeAnswerInput,
  GradingResult,
  LLMProvider,
} from "../types";

const generatedQuestionSchema = z.object({
  text: z.string().min(1),
  questionType: z.enum(["CONCEPTUAL", "APPLICATION"]),
  marks: z.number().int().min(1),
  markingScheme: z.string().min(1),
});
const generateQuestionsResponseSchema = z.object({
  questions: z.array(generatedQuestionSchema),
});

const gradingResultSchema = z.object({
  score: z.number().min(0).max(100),
  marksAwarded: z.number().int().min(0).nullable().optional(),
  feedback: z.string().min(1),
  modelAnswer: z.string().optional(),
});

const gradeAnswerBatchResultSchema = gradingResultSchema.extend({ refId: z.string() });
const gradeAnswerBatchResponseSchema = z.object({
  results: z.array(gradeAnswerBatchResultSchema),
});

const BATCH_CHUNK_SIZE = 8;

export class GroqProvider implements LLMProvider {
  readonly name = "groq";
  readonly model: string;
  private client: Groq;

  constructor(apiKey: string, model = "openai/gpt-oss-20b") {
    this.client = new Groq({ apiKey });
    this.model = model;
  }

  private async completeJson<T>(
    system: string,
    user: string,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const ATTEMPTS = 3;
    let lastError: unknown;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
          temperature: attempt === 0 ? 0.7 : 0.2,
          max_completion_tokens: 8192,
        });

        const raw = completion.choices[0]?.message?.content ?? "";
        const parsed = JSON.parse(raw);
        return schema.parse(parsed);
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(`Groq response did not match expected schema: ${String(lastError)}`);
  }

  async discussAnswer(input: DiscussAnswerInput): Promise<string> {
    const system = buildDiscussAnswerSystemPrompt(input);
    const ATTEMPTS = 3;
    let lastError: unknown;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          messages: [{ role: "system", content: system }, ...input.history],
          temperature: 0.5,
          max_completion_tokens: 4096,
        });
        const reply = completion.choices[0]?.message?.content?.trim() ?? "";
        if (reply) return reply;
        lastError = new Error("Empty reply");
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(`Groq discussion request failed: ${String(lastError)}`);
  }

  async generateQuestions(input: GenerateQuestionsInput): Promise<GeneratedQuestion[]> {
    const { system, user } = buildGenerateQuestionsPrompt(input);
    const result = await this.completeJson(system, user, generateQuestionsResponseSchema);
    return result.questions;
  }

  async gradeAnswer(input: GradeAnswerInput): Promise<GradingResult> {
    const { system, user } = buildGradeAnswerPrompt(input);
    return this.completeJson(system, user, gradingResultSchema);
  }

  async gradeAnswerBatch(items: GradeAnswerBatchItem[]): Promise<GradeAnswerBatchResult[]> {
    if (items.length === 0) return [];

    const chunks: GradeAnswerBatchItem[][] = [];
    for (let i = 0; i < items.length; i += BATCH_CHUNK_SIZE) {
      chunks.push(items.slice(i, i + BATCH_CHUNK_SIZE));
    }

    const results: GradeAnswerBatchResult[] = [];
    for (const chunk of chunks) {
      const { system, user } = buildGradeAnswerBatchPrompt(chunk);
      let chunkResults: GradeAnswerBatchResult[] = [];
      try {
        const parsed = await this.completeJson(system, user, gradeAnswerBatchResponseSchema);
        chunkResults = parsed.results;
      } catch {
        chunkResults = [];
      }

      const byRefId = new Map(chunkResults.map((r) => [r.refId, r]));
      for (const item of chunk) {
        const match = byRefId.get(item.refId);
        if (match) {
          results.push(match);
        } else {
          const fallback = await this.gradeAnswer(item);
          results.push({ ...fallback, refId: item.refId });
        }
      }
    }

    return results;
  }
}
