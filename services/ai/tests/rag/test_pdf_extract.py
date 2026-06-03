import pytest
import respx

from app.rag import pdf_extract


def _pdf_bytes(pages: list[str]) -> bytes:
    kids = " ".join(f"{3 + index * 2} 0 R" for index in range(len(pages)))
    objects: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Kids {kids} /Count {len(pages)} >>".encode(),
    ]
    for index, text in enumerate(pages):
        page_obj = 3 + index * 2
        content_obj = page_obj + 1
        escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = f"BT /F1 24 Tf 72 720 Td ({escaped}) Tj ET".encode()
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 << /Type /Font /Subtype /Type1 "
            f"/BaseFont /Helvetica >> >> >> "
            f"/Contents {content_obj} 0 R >>".encode()
        )
        objects.append(
            b"<< /Length "
            + str(len(stream)).encode()
            + b" >>\nstream\n"
            + stream
            + b"\nendstream"
        )

    body = b"%PDF-1.4\n"
    offsets = [0]
    for number, payload in enumerate(objects, start=1):
        offsets.append(len(body))
        body += f"{number} 0 obj\n".encode() + payload + b"\nendobj\n"
    xref_at = len(body)
    xref = f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    xref += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:])
    trailer = (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_at}\n%%EOF\n"
    ).encode()
    return body + xref + trailer


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
