from typing import Literal, TypeAlias

from pydantic import BaseModel, ConfigDict

from app.prompts.chat import Plan

Action: TypeAlias = Literal["revisar", "abnt", "citacoes", "proximopasso"]

_BASE_GUARDRAILS = (
    "\n"
    "REGRAS MANDATÓRIAS DE SAÍDA:\n"
    "1. NUNCA retorne blocos de código markdown (como ```html ou similares). Apenas o "
    "texto puro processado.\n"
    "2. NUNCA desvirtue ou altere desnecessariamente a estrutura HTML existente "
    "(tags, classes).\n"
    "3. NUNCA invente referências bibliográficas, nomes de autores, anos ou fontes fictícias "
    "(ALUCINAÇÃO ZERO).\n"
    "4. NUNCA mude o escopo ou sentido original do texto sem extrema necessidade. Mantenha "
    "as alterações localizadas.\n"
    "5. Mantenha a linguagem estritamente acadêmica, natural e formal, sem soar robótica "
    "ou genérica.\n"
    "6. Se o texto já estiver suficientemente bom e não houver melhoria substancial a ser "
    "feita, devolva o texto praticamente idêntico, com ajustes mínimos estruturais.\n"
    "7. O retorno deve conter EXCLUSIVAMENTE o conteúdo editado, sem cumprimentos, "
    "explicações ou notas.\n"
)

_TASK_REVISAR_VIP = (
    "Você é um Revisor Acadêmico VIP. Faça uma revisão crítica profunda do conteúdo a seguir. "
    "Melhore coesão, fluidez, elimine pleonasmos e garanta um tom formidável e acadêmico sem "
    "alterar o formato HTML base (negritos, itálicos, parágrafos)."
)
_TASK_REVISAR_PRO = (
    "Você é um Revisor Acadêmico. Revise apenas a ortografia e gramática do texto a seguir "
    "mantendo 100% da estrutura."
)
_TASK_ABNT = (
    "Você é um Especialista em Normas ABNT. Ajuste a estrutura textual a seguir. Corrija "
    "itálicos em palavras estrangeiras, espace citações longas (se aplicável na estrutura HTML "
    "fornecida), e elimine coloquialismos verbais que firam a formalidade da norma. NÃO adicione "
    "novas citações."
)
_TASK_CITACOES = (
    "Você é um Especialista em Revisão Bibliográfica. Dado o HTML a seguir, melhore pontualmente "
    'as chamadas de citações existentes (ex: "Segundo Silva (2020)...") para fluírem melhor no '
    "texto acadêmico e verifique se o formato autor-data está correto. NÃO invente bibliografia, "
    "apenas ajuste a sintaxe das existentes se houver."
)


class ActionPromptInput(BaseModel):
    model_config = ConfigDict(frozen=True)

    action: Action
    plan: Plan
    text: str
    context: str | None = None


def build_action_prompt(input_: ActionPromptInput) -> str:
    if input_.action == "proximopasso":
        ctx = input_.context or ""
        return (
            f"Com base no contexto do TCC ({ctx}) e neste último trecho escrito: escreva APENAS "
            "uma frase curta (max 20 palavras) de orientação sobre o próximo passo ideal "
            '(ex: "Agora, você deve introduzir a metodologia sugerida..."). NÃO justifique, '
            f"NÃO pule linha, NÃO use HTML.\n\nTEXTO BASE:\n{input_.text}"
        )

    if input_.action == "revisar":
        task = _TASK_REVISAR_VIP if input_.plan == "VIP" else _TASK_REVISAR_PRO
    elif input_.action == "abnt":
        task = _TASK_ABNT
    elif input_.action == "citacoes":
        task = _TASK_CITACOES
    else:
        raise ValueError("unknown_action")

    return f"{task}\n{_BASE_GUARDRAILS}\nTEXTO_FONTE:\n{input_.text}"
