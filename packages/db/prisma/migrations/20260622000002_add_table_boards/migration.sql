-- Add BoardType enum and type column to Board
-- (Tables already exist from db push, skip if already applied)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BoardType') THEN
    CREATE TYPE "BoardType" AS ENUM ('KANBAN', 'TABLE');
  END IF;
END $$;
ALTER TABLE "Board" ADD COLUMN IF NOT EXISTS "type" "BoardType" NOT NULL DEFAULT 'KANBAN';

-- Create Group table for TABLE boards
CREATE TABLE IF NOT EXISTS "Group" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "boardId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Group_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE
);
CREATE INDEX "Group_boardId_position_idx" ON "Group"("boardId", "position");

-- Create ColumnType enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ColumnType') THEN
    CREATE TYPE "ColumnType" AS ENUM ('TEXT', 'STATUS');
  END IF;
END $$;

-- Create ColumnDefinition table
CREATE TABLE IF NOT EXISTS "ColumnDefinition" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" "ColumnType" NOT NULL,
  "boardId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "settings" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "ColumnDefinition_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE
);
CREATE INDEX "ColumnDefinition_boardId_position_idx" ON "ColumnDefinition"("boardId", "position");
CREATE UNIQUE INDEX "ColumnDefinition_boardId_name_key" ON "ColumnDefinition"("boardId", "name");

-- Create TableItem table (rows)
CREATE TABLE IF NOT EXISTS "TableItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "boardId" TEXT NOT NULL,
  "groupId" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TableItem_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE,
  CONSTRAINT "TableItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL
);
CREATE INDEX "TableItem_boardId_groupId_position_idx" ON "TableItem"("boardId", "groupId", "position");

-- Create CellValue table
CREATE TABLE IF NOT EXISTS "CellValue" (
  "itemId" TEXT NOT NULL,
  "columnId" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "boardId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CellValue_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE,
  CONSTRAINT "CellValue_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TableItem" ("id") ON DELETE CASCADE,
  CONSTRAINT "CellValue_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "ColumnDefinition" ("id") ON DELETE CASCADE,
  PRIMARY KEY ("itemId", "columnId")
);
CREATE INDEX "CellValue_boardId_itemId_idx" ON "CellValue"("boardId", "itemId");
