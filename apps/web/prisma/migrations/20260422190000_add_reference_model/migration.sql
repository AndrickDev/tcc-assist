-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL,
    "tccId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'semantic-scholar',
    "title" TEXT NOT NULL,
    "authors" TEXT NOT NULL,
    "year" INTEGER,
    "abstract" TEXT,
    "venue" TEXT,
    "url" TEXT,
    "doi" TEXT,
    "citationCount" INTEGER,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "selectedAt" TIMESTAMP(3),
    "searchQuery" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reference_tccId_selected_idx" ON "Reference"("tccId", "selected");

-- CreateIndex
CREATE UNIQUE INDEX "Reference_tccId_externalId_key" ON "Reference"("tccId", "externalId");

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_tccId_fkey" FOREIGN KEY ("tccId") REFERENCES "Tcc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
