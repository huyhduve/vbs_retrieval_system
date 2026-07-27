from fastapi import APIRouter, HTTPException, status, Request
from schemas.response import ImageResult, ImageSearchResponse
from schemas.request import TextQueryRequest
from core.siglip_engine import SigLIP2Encoder
from milvus.connection import get_client
from config import settings

router = APIRouter()

@router.post("/search")
async def search(query : TextQueryRequest, requests : Request):
    encoder = requests.app.state.encoder
    milvus_client = requests.app.state.client
  
    embedding = encoder.encode_text(query.query)

    results = milvus_client.search(
        collection_name=settings.MILVUS_COLLECTION,
        data=[embedding],
        output_fields=["id"], 
        limit=query.top_k
    )


    hits = results[0]

    response = ImageSearchResponse(
        results=[
            ImageResult(id=hit["id"]) for hit in hits
        ]
    )
    
    return response

