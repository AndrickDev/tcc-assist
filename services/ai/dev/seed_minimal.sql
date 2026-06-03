-- Minimal seed for E2E smoke. Assumes Prisma migrations already applied.
-- Idempotent via ON CONFLICT DO NOTHING.

INSERT INTO "User" (id, email, name, plan)
VALUES ('smoke-user-1', 'smoke@example.com', 'Smoke User', 'VIP')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Tcc" (id, "userId", title, course, institution, status, norma, objective, "updatedAt")
VALUES (
  'smoke-tcc-1',
  'smoke-user-1',
  'Sistema imune adaptativo e mecanismos de defesa',
  'Biomedicina',
  'UFRJ',
  'IN_PROGRESS',
  'ABNT',
  'Descrever os mecanismos do sistema imune adaptativo em resposta a patogenos virais.',
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Reference" (id, "tccId", "externalId", source, title, authors, year, abstract)
VALUES (
  'smoke-ref-1',
  'smoke-tcc-1',
  'openalex:W2000000001',
  'openalex',
  'Adaptive immunity and the role of memory T cells in viral infection',
  'Smith J, Pereira A',
  2024,
  'The adaptive immune system relies on clonal expansion of T and B lymphocytes that recognize specific antigens. After viral infection, memory T cells persist and provide rapid protection upon reexposure. This review describes how CD8+ effector cells produce interferon gamma to suppress viral replication while CD4+ helper cells coordinate antibody production by B cells. We discuss the implications for vaccine design and persistent infections such as HIV and chronic hepatitis.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Reference" (id, "tccId", "externalId", source, title, authors, year, abstract)
VALUES (
  'smoke-ref-2',
  'smoke-tcc-1',
  'openalex:W2000000002',
  'openalex',
  'Innate immune pathways and Toll-like receptor signaling',
  'Mendes R, Oliveira K',
  2023,
  'Toll-like receptors detect pathogen-associated molecular patterns and trigger downstream signaling cascades through MyD88 and TRIF adaptors. Activation results in NF-kB nuclear translocation and transcription of inflammatory cytokines. This article reviews the diversity of TLR ligands and the cell-type specific roles in coordinating early innate immune responses.'
)
ON CONFLICT (id) DO NOTHING;
