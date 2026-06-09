from pydantic import BaseModel, ConfigDict, Field

from app.prompts.chat import (
    GUARDRAILS_GENERATION,
    Plan,
    TccMetadataInput,
    build_tcc_metadata_block,
    get_quality_directive,
    get_writer_system_prompt,
)


class GeneratePromptInput(BaseModel):
    model_config = ConfigDict(frozen=True)

    plan: Plan
    tcc_metadata: TccMetadataInput
    chapter: str = Field(min_length=1)
    previous_context: str | None = None
    references_block: str = ""
    rag_context_block: str = ""


def build_generate_prompt(data: GeneratePromptInput) -> str:
    previous_context_block = _build_previous_context_block(data.previous_context)
    return (
        f"{get_writer_system_prompt(data.plan)}"
        f"{build_tcc_metadata_block(data.tcc_metadata)}"
        f"{data.references_block}"
        f"{data.rag_context_block}"
        f"{previous_context_block}"
        f"\n\nCAPÍTULO A GERAR: {data.chapter}"
        "\n\nTAREFA: escreva o capítulo solicitado como texto acadêmico final, em HTML simples."
        f"{get_quality_directive(data.plan)}"
        f"{GUARDRAILS_GENERATION}"
    )


def _build_previous_context_block(previous_context: str | None) -> str:
    if not previous_context:
        return ""
    return f"\n[CONTEXTO ANTERIOR DO TCC]:\n{previous_context}\n[FIM CONTEXTO ANTERIOR]\n"
