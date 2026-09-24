"""Render HTML documents to PDF via Chromium (Playwright)."""

from __future__ import annotations

import asyncio

from fastapi import HTTPException, status


def _html_to_pdf_sync(
    html: str,
    *,
    page_size: str = "A4",
    orientation: str = "portrait",
    margins: dict | None = None,
) -> bytes:
    """Sync Playwright render (runs in a worker thread on Windows)."""
    _ = margins
    try:
        from playwright.sync_api import sync_playwright
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
    launch_args = ["--disable-dev-shm-usage", "--no-sandbox"]

    def _launch_browser(p):
        """Bundled Chromium, then installed Chrome, then Edge (Windows)."""
        last_err = None
        for channel in (None, "chrome", "msedge"):
            try:
                if channel:
                    return p.chromium.launch(
                        headless=True,
                        channel=channel,
                        args=launch_args,
                    )
                return p.chromium.launch(headless=True, args=launch_args)
            except Exception as exc:
                last_err = exc
                msg = str(exc)
                if "Executable doesn't exist" not in msg and "playwright install" not in msg.lower():
                    raise
        raise last_err

    try:
        with sync_playwright() as p:
            browser = _launch_browser(p)
            try:
                page = browser.new_page()
                page.set_content(
                    html or "<html><body></body></html>",
                    wait_until="networkidle",
                )
                page.emulate_media(media="print")
                pdf = page.pdf(
                    format=size if size != "TABLOID" else "Tabloid",
                    landscape=landscape,
                    margin={"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"},
                    print_background=True,
                    prefer_css_page_size=True,
                )
                return pdf
            finally:
                browser.close()
    except HTTPException:
        raise
    except Exception as exc:
        msg = str(exc)
        if "Executable doesn't exist" in msg or "playwright install" in msg.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "No Chromium browser available for PDF. Install Google Chrome or Edge, or from "
                    "the backend folder run: .\\venv\\Scripts\\playwright install chromium"
                ),
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF render failed: {msg}",
        ) from exc


async def html_to_pdf(
    html: str,
    *,
    page_size: str = "A4",
    orientation: str = "portrait",
    margins: dict | None = None,
) -> bytes:
    """Return PDF bytes for the given HTML using Playwright Chromium.

    Uses sync Playwright in a thread pool so subprocess launch works on Windows
    under uvicorn (async Playwright raises NotImplementedError there).

    Page margins are expected in the HTML ``@page`` CSS (production-completion
    style). The ``margins`` argument is accepted for API compatibility only.
    """
    return await asyncio.to_thread(
        _html_to_pdf_sync,
        html,
        page_size=page_size,
        orientation=orientation,
        margins=margins,
    )
