from fastapi import APIRouter, HTTPException, status, Request
from schemas.response import ImageResult, ImageSearchResponse, GroupImageResult
from schemas.request import QueryRequest
from milvus.connection import get_client
from config import settings

router = APIRouter()

@router.post("/search", response_model=ImageSearchResponse)
async def search(query: QueryRequest, requests: Request):
    encoder = requests.app.state.encoder
    milvus_client = requests.app.state.client
    
    embedding = encoder.encode_text(query.text)

    results = milvus_client.search(
        collection_name=settings.MILVUS_COLLECTION,
        data=embedding.tolist(),
        output_fields=["id"], 
        limit=query.top_k
    )

    hits = results[0]

    groups_map = {}

    for hit in hits:
        raw_id = str(hit["id"])  # VD: "L21_V023/234"
        
        video_id = raw_id.split("/")[0] if "/" in raw_id else raw_id
        
        image_item = ImageResult(
            image_id=f"{raw_id}.webp",
            ocr_text="",
            asr_text=""
        )
        
        if video_id not in groups_map:
            groups_map[video_id] = []
        groups_map[video_id].append(image_item)

    grouped_results = [
        GroupImageResult(video_id=v_id, group=images)
        for v_id, images in groups_map.items()
    ]

    return ImageSearchResponse(results=grouped_results)