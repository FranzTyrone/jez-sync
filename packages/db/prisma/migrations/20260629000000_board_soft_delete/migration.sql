-- Add soft-delete support to Board
ALTER TABLE "Board" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Index for efficiently querying active/deleted boards
CREATE INDEX "Board_deletedAt_idx" ON "Board"("deletedAt");
