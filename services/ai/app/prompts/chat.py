from typing import Literal

from pydantic import BaseModel, ConfigDict

Plan = Literal["FREE", "PRO", "VIP"]

_SYSTEM_FREE = "Você é um redator de TCC acadêmico."
_SYSTEM_PRO = (
    "Você é um redator acadêmico profissional focado em rigor científico e coesão textual."
)
_SYSTEM_VIP = (
    "Você é um redator acadêmico SÊNIOR com foco em excelência, análise crítica e estrutura "
    "impecável. Produza texto denso de nível de publicação."
)

_QUALITY_VIP = """
[DIRETIVA VIP - QUALIDADE PREMIUM]:
Você está gerando para um usuário VIP. O conteúdo precisa ser COMPLETO e PUBLISHABLE:
- Produza texto extenso; no mínimo 1500 palavras por geração.
- Use análise crítica avançada com diferentes perspectivas teóricas.
- Inclua citações teóricas coerentes com o campo de estudo
  (ex: "Segundo Freire (2005)", "Conforme Morin (2000)").
- Estruture com subtítulos (<h2>, <h3>) e transições suaves entre parágrafos.
- O texto deve ser denso, fluido e imediatamente utilizável numa monografia ou TCC real.
- JAMAIS produza texto curto ou superficial.
"""

_QUALITY_PRO = """
[DIRETIVA PRO - QUALIDADE PROFISSIONAL]:
Produza texto de qualidade profissional com no mínimo 800 palavras.
Use linguagem acadêmica rigorosa e estruture em parágrafos coesos.
Inclua citações quando relevante.
"""

_QUALITY_FREE = ""

GUARDRAILS_GENERATION = """
[GUARDRAILS ABSOLUTOS DE GERAÇÃO TCC]:
ALERTA CRÍTICO: VOCÊ NÃO É UM CHATBOT. VOCÊ É UMA ENGINE DE REDAÇÃO DIRETIVA.

1. PROIBIDO PLACEHOLDERS (Ex: "[Insira seu nome]", "[Tema aqui]"). Você DEVE
inventar ou deduzir o conteúdo com base no contexto, assumindo um texto real e final.
JAMAIS use colchetes [ ] ou chaves { } para deixar lacunas. Se faltar contexto, crie.
2. PROIBIDO METALINGUAGEM (Ex: "Aqui está a sugestão", "Este é um esboço",
"O texto acima é..."). NUNCA converse comigo. NUNCA.
3. PROIBIDO ANÁLISE INLINE. Entregue única e exclusivamente o corpo do texto
acadêmico utilizável e copiável.
4. PRODUZA TEXTO DENSO, fluido, com citações teóricas coerentes caso necessário.
5. Formate a saída APENAS usando tags HTML simples (<p>, <strong>, <h2>, <h3>, <ul>).
Nunca use markdown (```).
6. TODO O CONTEÚDO DEVE SER SOBRE O TEMA DO TCC INFORMADO. NÃO desvie do assunto solicitado.
"""


class TccMetadataInput(BaseModel):
    model_config = ConfigDict(frozen=True)

    title: str | None = None
    course: str | None = None
    institution: str | None = None
    work_type: str | None = None
    norma: str | None = None
    objective: str | None = None


def get_writer_system_prompt(plan: Plan) -> str:
    prompts: dict[Plan, str] = {
        "FREE": _SYSTEM_FREE,
        "PRO": _SYSTEM_PRO,
        "VIP": _SYSTEM_VIP,
    }
    return prompts[plan]


def get_quality_directive(plan: Plan) -> str:
    directives: dict[Plan, str] = {
        "FREE": _QUALITY_FREE,
        "PRO": _QUALITY_PRO,
        "VIP": _QUALITY_VIP,
    }
    return directives[plan]


def build_chat_prompt(
    *,
    plan: Plan,
    tcc_metadata: TccMetadataInput | None,
    references_block: str,
    conversation_block: str,
    user_message: str,
    rag_context_block: str = "",
) -> str:
    tcc_metadata_block = _build_tcc_metadata_block(tcc_metadata)
    quality_directive = get_quality_directive(plan)
    return (
        f"{get_writer_system_prompt(plan)}"
        f"{tcc_metadata_block}"
        f"{references_block}"
        f"{rag_context_block}"
        f"{conversation_block}"
        f"\n\nREQUISITO DO USUÁRIO: {user_message}"
        f"{quality_directive}"
        f"{GUARDRAILS_GENERATION}"
    )


def _build_tcc_metadata_block(tcc_metadata: TccMetadataInput | None) -> str:
    if tcc_metadata is None:
        return ""

    parts: list[str] = []
    if tcc_metadata.title:
        parts.append(f'TEMA DO TCC: "{tcc_metadata.title}"')
    if tcc_metadata.course:
        parts.append(f"CURSO: {tcc_metadata.course}")
    if tcc_metadata.institution:
        parts.append(f"INSTITUIÇÃO: {tcc_metadata.institution}")
    if tcc_metadata.work_type:
        parts.append(f"TIPO DE TRABALHO: {tcc_metadata.work_type}")
    if tcc_metadata.norma:
        parts.append(f"NORMA DE FORMATAÇÃO: {tcc_metadata.norma}")
    if tcc_metadata.objective:
        parts.append(f"OBJETIVO/PROBLEMA DE PESQUISA: {tcc_metadata.objective}")

    if not parts:
        return ""
    metadata_lines = "\n".join(parts)
    return f"\n[CONTEXTO DO TCC]:\n{metadata_lines}\n[FIM CONTEXTO DO TCC]\n"
