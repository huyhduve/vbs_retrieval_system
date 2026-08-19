from fastapi import APIRouter
from .endpoints import health, search
api_router = APIRouter()

api_router.include_router(
    search.router, 
    prefix="", 
    tags=["Search"]
)

api_router.include_router(
    health.router, 
    prefix="", 
    tags=["Health"]
)