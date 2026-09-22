"""Render HTML documents to PDF via Chromium (Playwright)."""

from __future__ import annotations

from fastapi import HTTPException, status


async def html_to_pdf(
    html: str,
    *,
    page_size: str = "A4",
    orientation: str = "portrait",
    margins: dict | None = None,
) -> bytes:
    """Return PDF bytes for the given HTML using Playwright Chromium.

    Page margins are expected in the HTML ``@page`` CSS (production-completion
    style). The ``margins`` argument is accepted for API compatibility only.
    """
    _ = margins
    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Playwright is not installed. Run: "
                "pip install playwright && playwright install chromium"
            ),
        ) from exc

    size = str(page_size or "A4").upper()
    if size not in {"A3", "A4", "A5", "LETTER", "LEGAL", "TABLOID"}:
        size = "A4"
    landscape = str(orientation or "portrait").lower() == "landscape"

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-dev-shm-usage", "--no-sandbox"],
        )
        try:
            page = await browser.new_page()
            await page.set_content(
                html or "<html><body></body></html>",
                wait_until="networkidle",
            )
            await page.emulate_media(media="print")
            pdf = await page.pdf(
                format=size if size != "TABLOID" else "Tabloid",
                landscape=landscape,
                margin={"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"},
                print_background=True,
                prefer_css_page_size=True,
            )
            return pdf
        finally:
            await browser.close()
