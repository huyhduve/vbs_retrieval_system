from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
import os

from core.text_visual import SigLIP2Encoder
from core.asr import Vietnamesev2Encoder

from contextlib import asynccontextmanager
from milvus.connection import get_client
from api.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n[FastAPI Lifespan] Bắt đầu khởi động server...")

    image_text_encoder = SigLIP2Encoder(ckpt=settings.MODEL_CKPT)
    app.state.image_text_encoder = image_text_encoder
    print("\n[Siglip2Engine] Đã load model Siglip2")

    asr_text_encoder = Vietnamesev2Encoder(ckpt=settings.ASR_MODEL_CKPT)
    app.state.asr_text_encoder = asr_text_encoder
    print("\n[VietnameseV2] Đã load model Vietnamese_EmbeddingV2")


    app.state.client = get_client()
    print(f"\n load collection '{settings.ASR_COLLECTION}' vào bộ nhớ RAM...")
    app.state.client.load_collection(collection_name=settings.ASR_COLLECTION)
    print(f"\n load collection '{settings.IMAGE_COLLECTION}' vào bộ nhớ RAM...")
    app.state.client.load_collection(collection_name=settings.IMAGE_COLLECTION)
    yield

    app.state.client.close()
    print("\n [FastAPI Lifespan] Tắt db, tắt model")


app = FastAPI(
    title="NSD WORM VEC",
    lifespan=lifespan
)

app.include_router(api_router, prefix="/api/v1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message" : "NSD WORM VEC Engine is Running"}