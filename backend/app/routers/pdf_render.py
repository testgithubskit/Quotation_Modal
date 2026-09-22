from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.api.deps import get_current_active_user
from app.models import User
from app.schemas.pdf_render import PdfRenderRequest
from app.services.pdf_render import html_to_pdf

router = APIRouter()


@router.post("/render")
async def render_pdf(
    body: PdfRenderRequest,
    _user: User = Depends(get_current_active_user),
) -> Response:
    pdf_bytes = await html_to_pdf(
        body.html,
        page_size=body.page_size,
        orientation=body.orientation,
        margins=body.margins,
    )
    filename = (body.filename or "document").strip() or "document"
    if not filename.lower().endswith(".pdf"):
        filename = f"{filename}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )
