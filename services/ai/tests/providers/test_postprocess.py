from app.providers.postprocess import strip_code_fences


def test_strip_code_fences_sem_fence() -> None:
    assert strip_code_fences("<p>texto</p>") == "<p>texto</p>"


def test_strip_code_fences_html() -> None:
    assert strip_code_fences("```html\n<p>texto</p>\n```") == "<p>texto</p>"


def test_strip_code_fences_javascript_com_whitespace() -> None:
    assert strip_code_fences("```javascript   \nconst x = 1\n```") == "const x = 1"


def test_strip_code_fences_so_no_final() -> None:
    assert strip_code_fences("<p>texto</p>\n```") == "<p>texto</p>"
