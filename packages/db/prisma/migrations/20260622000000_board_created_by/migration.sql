-- Add createdById to Board, backfilling from the server owner for existing rows.
ALTER TABLE "Board" ADD COLUMN "createdById" TEXT;

UPDATE "Board" b
SET "createdById" = s."ownerId"
FROM "Server" s
WHERE b."serverId" = s.id;

ALTER TABLE "Board" ALTER COLUMN "createdById" SET NOT NULL;
