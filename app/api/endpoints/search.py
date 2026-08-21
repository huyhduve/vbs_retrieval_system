import numpy as np 
import os 

from fastapi import APIRouter, Request
from schemas.response import ImageResult, ImageSearchResponse, GroupImageResult
from schemas.request import QueryRequest, SimSearchRequest
from config import settings
router = APIRouter()


@router.post("/search", response_model=ImageSearchResponse)
def search(query: QueryRequest | SimSearchRequest, requests: Request):

    encoder = requests.app.state.encoder
    milvus_client = requests.app.state.client

    TOP_K = 100 

    if(isinstance(query, QueryRequest)): 
        embedding = encoder.encode_text(query.text)
        TOP_K=query.top_k

    if(isinstance(query, SimSearchRequest)): 
        file_path = query.image_id.replace(".webp", ".npy")
        emb_path = os.path.join(settings.EMBEDDING_PATH, file_path)
        embedding = np.load(emb_path)
        embedding = np.expand_dims(embedding, axis=0)

    results = milvus_client.search(
        collection_name=settings.MILVUS_COLLECTION,
        data=embedding.tolist(),
        output_fields=["id"], 
        limit=TOP_K
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