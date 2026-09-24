import { z } from "zod";

export const submitAttemptSchema = z.object({
  answerText: z.string().trim().min(1, "Answer is required"),
});

export const submitBatchAttemptsSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answerText: z.string().trim().min(1),
      }),
    )
    .min(1, "At least one answer is required"),
});

export const discussionMessageSchema = z.object({
  content: z.string().trim().min(1, "Message is required").max(4000),
});
