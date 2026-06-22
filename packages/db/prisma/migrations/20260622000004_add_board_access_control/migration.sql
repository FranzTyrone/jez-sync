-- CreateTable "BoardAccess"
CREATE TABLE "BoardAccess" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable "BoardAccessRequest"
CREATE TABLE "BoardAccessRequest" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "BoardAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable "BoardShareLink"
CREATE TABLE "BoardShareLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoardAccess_boardId_userId_key" ON "BoardAccess"("boardId", "userId");

-- CreateIndex
CREATE INDEX "BoardAccess_boardId_idx" ON "BoardAccess"("boardId");

-- CreateIndex
CREATE INDEX "BoardAccess_userId_idx" ON "BoardAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardAccessRequest_boardId_userId_key" ON "BoardAccessRequest"("boardId", "userId");

-- CreateIndex
CREATE INDEX "BoardAccessRequest_boardId_idx" ON "BoardAccessRequest"("boardId");

-- CreateIndex
CREATE INDEX "BoardAccessRequest_userId_idx" ON "BoardAccessRequest"("userId");

-- CreateIndex
CREATE INDEX "BoardAccessRequest_status_idx" ON "BoardAccessRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BoardShareLink_code_key" ON "BoardShareLink"("code");

-- CreateIndex
CREATE INDEX "BoardShareLink_boardId_idx" ON "BoardShareLink"("boardId");

-- AddForeignKey
ALTER TABLE "BoardAccess" ADD CONSTRAINT "BoardAccess_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardAccess" ADD CONSTRAINT "BoardAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardAccessRequest" ADD CONSTRAINT "BoardAccessRequest_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardAccessRequest" ADD CONSTRAINT "BoardAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardShareLink" ADD CONSTRAINT "BoardShareLink_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
