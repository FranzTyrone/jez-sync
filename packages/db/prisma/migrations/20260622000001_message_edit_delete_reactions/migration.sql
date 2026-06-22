-- Add edit and soft-delete tracking to Message
ALTER TABLE "Message" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Create Reaction table for emoji reactions
CREATE TABLE "Reaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Reaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE,
  CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "Reaction_messageId_userId_emoji_key" UNIQUE ("messageId", "userId", "emoji")
);

-- Index for efficient reaction lookups by message
CREATE INDEX "Reaction_messageId_idx" ON "Reaction" ("messageId");
