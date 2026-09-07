from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    def __init__(self, detail: str, status_code: int = 400, code: str = "app_error") -> None:
        self.detail = detail
        self.status_code = status_code
        self.code = code
        super().__init__(detail)


class NotFoundError(AppError):
    def __init__(self, detail: str = "Resource not found") -> None:
        super().__init__(detail=detail, status_code=404, code="not_found")


class ForbiddenError(AppError):
    def __init__(self, detail: str = "Insufficient permissions") -> None:
        super().__init__(detail=detail, status_code=403, code="forbidden")


class UnauthorizedError(AppError):
    def __init__(self, detail: str = "Not authenticated") -> None:
        super().__init__(detail=detail, status_code=401, code="unauthorized")


class ConflictError(AppError):
    def __init__(self, detail: str = "Conflict") -> None:
        super().__init__(detail=detail, status_code=409, code="conflict")


def _error_body(status_code: int, detail: str, code: str) -> dict:
    return {"success": False, "error": {"code": code, "detail": detail, "status": status_code}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.status_code, exc.detail, exc.code),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.status_code, str(exc.detail), "http_error"),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": {
                    "code": "validation_error",
                    "detail": "Request validation failed",
                    "status": 422,
                    "errors": exc.errors(),
                },
            },
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(_request: Request, exc: IntegrityError) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content=_error_body(409, "A unique constraint or database integrity rule was violated", "conflict"),
        )
