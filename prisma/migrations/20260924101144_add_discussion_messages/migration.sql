-- CreateTable
CREATE TABLE "DiscussionMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradingId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscussionMessage_gradingId_fkey" FOREIGN KEY ("gradingId") REFERENCES "Grading" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DiscussionMessage_gradingId_createdAt_idx" ON "DiscussionMessage"("gradingId", "createdAt");
