import re

_CODE_FENCE_PATTERN = re.compile(r"^```[a-z]*\s*|\s*```$", re.IGNORECASE)


def strip_code_fences(content: str) -> str:
    return _CODE_FENCE_PATTERN.sub("", content).strip()
