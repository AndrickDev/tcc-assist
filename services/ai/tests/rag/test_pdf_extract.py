import io

import pytest
import respx

from app.rag import pdf_extract


def _pdf_bytes(pages: list[str]) -> bytes:
    """Generate a valid PDF using reportlab. Test-only dependency."""
    reportlab_canvas = pytest.importorskip("reportlab.pdfgen.canvas")
    buffer = io.BytesIO()
    pdf = reportlab_canvas.Canvas(buffer)
    for text in pages:
        pdf.drawString(72, 720, text)
        pdf.showPage()
    pdf.save()
    return buffer.getvalue()


@respx.mock
async def test_fetch_pdf_200_retorna_bytes() -> None:
    url = "https://blob.vercel-storage.com/file.pdf"
    data = _pdf_bytes(["ok"])
    respx.get(url).respond(200, content=data)

    assert await pdf_extract.fetch_pdf(url) == data


@respx.mock
async def test_fetch_pdf_404_levanta_download_error() -> None:
    url = "https://blob.vercel-storage.com/missing.pdf"
    respx.get(url).respond(404)

    with pytest.raises(pdf_extract.PdfDownloadError, match="http_404"):
        await pdf_extract.fetch_pdf(url)


@respx.mock
async def test_fetch_pdf_oversize_levanta_download_error() -> None:
    url = "https://blob.vercel-storage.com/big.pdf"
    respx.get(url).respond(200, content=b"x" * (pdf_extract.MAX_PDF_BYTES + 1))

    with pytest.raises(pdf_extract.PdfDownloadError, match="oversize"):
        await pdf_extract.fetch_pdf(url)


def test_extract_pages_pdf_valido() -> None:
    pytest.importorskip("pypdf")

    pages = pdf_extract.extract_pages(_pdf_bytes(["Primeira pagina", "Segunda pagina"]))

    assert len(pages) == 2
    assert "Primeira pagina" in pages[0]
    assert "Segunda pagina" in pages[1]


def test_extract_pages_pdf_corrompido_levanta_extract_error() -> None:
    with pytest.raises(pdf_extract.PdfExtractError):
        pdf_extract.extract_pages(b"not a pdf")
