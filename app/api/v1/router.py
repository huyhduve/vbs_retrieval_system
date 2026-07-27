from fastapi import APIRouter
from .endpoints import search, health
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