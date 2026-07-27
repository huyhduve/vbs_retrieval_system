from fastapi import FastAPI, HTTPException, status
from schemas.request import TextQueryRequest
from schemas.response import ErrorResponse, ImageResult, ImageSearchResponse
from config import settings

from core.siglip_engine import SigLIP2Encoder
from contextlib import asynccontextmanager
from milvus.connection import get_client
from api.v1.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n🚀 [FastAPI Lifespan] Bắt đầu khởi động server...")
    encoder = SigLIP2Encoder(ckpt=settings.MODEL_CKPT)
    app.state.encoder = encoder
    app.state.client = get_client()

    print("🎯 [FastAPI Lifespan] Nạp model, kết nối db \n")

    yield

    app.state.client.close()
    print("\n🛑 [FastAPI Lifespan] Tắt db, tắt model")


app = FastAPI(
    title="NSD WORM VEC",
    lifespan=lifespan
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message" : "NSD WORM VEC Engine is Running"}