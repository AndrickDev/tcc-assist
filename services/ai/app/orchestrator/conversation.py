from app.db.models import MessageRow
from app.prompts.chat import Plan


def messages_limit_for_plan(plan: Plan) -> int:
    if plan == "VIP":
        return 8
    if plan == "PRO":
        return 3
    return 0


def build_conversation_block(plan: Plan, recent_messages: list[MessageRow]) -> str:
    limit = messages_limit_for_plan(plan)
    if limit == 0 or not recent_messages:
        return ""

    contents = [message.content for message in reversed(recent_messages[:limit])]
    joined = "\n".join(contents)
    if plan == "PRO":
        return f"\n[CONTEXTO RECENTE DO CAPÍTULO]:\n{joined}"

    return (
        "\n[CONSISTÊNCIA GLOBAL - HISTÓRICO RECENTE DO TCC]:\n"
        f"{joined}\n"
        "[FIM CONSISTÊNCIA GLOBAL]"
    )
