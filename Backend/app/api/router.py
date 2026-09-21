from fastapi import APIRouter
from api.endpoints_v2 import health
from api.endpoints_v2 import search
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