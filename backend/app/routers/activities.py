from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.api.deps import DbSession, Pagination, require_permission
from app.core.exceptions import AppError
from app.models import User
from app.schemas.activity import ActivityCreate, ActivityResponse, ActivityUpdate
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.spreadsheet_import import (
    SpreadsheetConfirmRequest,
    SpreadsheetImportResponse,
    SpreadsheetPreviewResponse,
)
from app.services.catalog import activity_service
from app.services.catalog_import import catalog_import_service

router = APIRouter()


@router.get("", response_model=PaginatedResponse[ActivityResponse])
def list_activities(
    db: DbSession,
    pagination: Pagination,
    current_user: User = Depends(require_permission("activities:read")),
) -> PaginatedResponse[ActivityResponse]:
    items, total = activity_service.list(db, current_user, **pagination)
    return PaginatedResponse.build(
        [ActivityResponse.model_validate(item) for item in items],
        total,
        pagination["page"],
        pagination["page_size"],
    )


@router.post("/import/preview", response_model=SpreadsheetPreviewResponse)
async def preview_activities_import(
    db: DbSession,
    current_user: User = Depends(require_permission("activities:create")),
    file: UploadFile = File(...),
) -> SpreadsheetPreviewResponse:
    filename = file.filename or "upload.xlsx"
    data = await file.read()
    if not data:
        raise AppError("Empty file", status_code=400, code="empty_file")
    preview = catalog_import_service.preview_activities(db, current_user, data, filename)
    if not preview["rows"]:
        raise AppError(
            "No valid activity rows found (need Activity Code). Only columns already defined in the app are extracted.",
            status_code=400,
            code="empty_preview",
        )
    return SpreadsheetPreviewResponse(**preview)


@router.post("/import/confirm", response_model=SpreadsheetImportResponse)
def confirm_activities_import(
    payload: SpreadsheetConfirmRequest,
    db: DbSession,
    current_user: User = Depends(require_permission("activities:create")),
) -> SpreadsheetImportResponse:
    if not payload.rows:
        raise AppError("No rows to import", status_code=400, code="empty_import")
    result = catalog_import_service.confirm_activities(db, current_user, payload.rows)
    return SpreadsheetImportResponse.from_result(result, "Activities")


@router.post("", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def create_activity(
    payload: ActivityCreate,
    db: DbSession,
    current_user: User = Depends(require_permission("activities:create")),
) -> ActivityResponse:
    return ActivityResponse.model_validate(activity_service.create(db, current_user, payload))


@router.get("/{activity_id}", response_model=ActivityResponse)
def get_activity(
    activity_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("activities:read")),
) -> ActivityResponse:
    return ActivityResponse.model_validate(activity_service.get(db, current_user, activity_id))


@router.put("/{activity_id}", response_model=ActivityResponse)
def update_activity(
    activity_id: UUID,
    payload: ActivityUpdate,
    db: DbSession,
    current_user: User = Depends(require_permission("activities:update")),
) -> ActivityResponse:
    return ActivityResponse.model_validate(activity_service.update(db, current_user, activity_id, payload))


@router.delete("/{activity_id}", response_model=MessageResponse)
def delete_activity(
    activity_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("activities:delete")),
) -> MessageResponse:
    activity_service.delete(db, current_user, activity_id)
    return MessageResponse(message="Activity deleted")
