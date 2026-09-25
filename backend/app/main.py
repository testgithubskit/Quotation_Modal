from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.exceptions import register_exception_handlers
from app.core.seed import seed_roles_and_permissions
from app.models import *  # noqa: F403
from app.routers import (
    activities,
    audit_logs,
    auth,
    custom_fields,
    customers,
    notifications,
    organizations,
    pdf_render,
    permissions,
    quotation_templates,
    quotations,
    roles,
    users,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db = SessionLocal()
    try:
        seed_roles_and_permissions(db)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Multi-tenant quotation management API",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

register_exception_handlers(app)

# In DEBUG, also allow LAN/localhost Vite origins (e.g. http://172.18.7.89:5176).
# Starlette returns 400 on OPTIONS when Origin is not allowed.
_cors_kwargs = {
    "allow_origins": settings.cors_origin_list,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if settings.debug:
    _cors_kwargs["allow_origin_regex"] = (
        r"https?://("
        r"localhost|127\.0\.0\.1|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}"
        r")(:\d+)?"
    )

app.add_middleware(CORSMiddleware, **_cors_kwargs)

prefix = settings.api_v1_prefix
app.include_router(auth.router, prefix=f"{prefix}/auth", tags=["Auth"])
app.include_router(users.router, prefix=f"{prefix}/users", tags=["Users"])
app.include_router(roles.router, prefix=f"{prefix}/roles", tags=["Roles"])
app.include_router(permissions.router, prefix=f"{prefix}/permissions", tags=["Permissions"])
app.include_router(organizations.router, prefix=f"{prefix}/organizations", tags=["Organizations"])
app.include_router(customers.router, prefix=f"{prefix}/customers", tags=["Customers"])
app.include_router(activities.router, prefix=f"{prefix}/activities", tags=["Activities"])
app.include_router(quotations.router, prefix=f"{prefix}/quotations", tags=["Quotations"])
app.include_router(
    quotation_templates.router,
    prefix=f"{prefix}/quotation-templates",
    tags=["Quotation Templates"],
)
app.include_router(custom_fields.router, prefix=f"{prefix}/custom-fields", tags=["Custom Fields"])
app.include_router(notifications.router, prefix=f"{prefix}/notifications", tags=["Notifications"])
app.include_router(audit_logs.router, prefix=f"{prefix}/audit-logs", tags=["Audit Logs"])
app.include_router(pdf_render.router, prefix=f"{prefix}/pdf", tags=["PDF"])


@app.get("/health", tags=["Health"])
def health() -> dict:
    return {"status": "ok", "name": settings.app_name}
