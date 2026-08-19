from fastapi import FastAPI
# from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from config import settings
import os

from core.siglip_engine import SigLIP2Encoder
from contextlib import asynccontextmanager
from milvus.connection import get_client
from api.v1.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n [FastAPI Lifespan] Bắt đầu khởi động server...")
    encoder = SigLIP2Encoder(ckpt=settings.MODEL_CKPT)
    app.state.encoder = encoder
    app.state.client = get_client()
    print(f"\n load collection '{settings.MILVUS_COLLECTION}' vào bộ nhớ RAM...")
    app.state.client.load_collection(collection_name=settings.MILVUS_COLLECTION)
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