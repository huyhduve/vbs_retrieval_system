import numpy as np 
import os 
from PIL import Image
import io 
from typing import List

from fastapi import APIRouter, Request, HTTPException, status, UploadFile, File
from schemas.response import ImageResult, ImageSearchResponse, GroupImageResult
from schemas.request import QueryRequest, SimSearchRequest
from config import settings
router = APIRouter()

def _format_milvus_res(hits : List[dict]): 
    groups_map = {}

    for hit in hits:
        raw_id = str(hit["id"]) 
        
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


@router.post("/search", response_model=ImageSearchResponse)
def text_base_search(query: QueryRequest | SimSearchRequest, requests: Request):
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

    return _format_milvus_res(results[0])
    

ALLOW_EXTENSIONS = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 1.5 * 1024 * 1024 # MAX 1.5MB 

@router.post("/search/image", response_model=ImageSearchResponse)
def image_base_search(requests : Request, file : UploadFile = File(...)):
    if file.content_type not in ALLOW_EXTENSIONS: 
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Sai định dạng [.jpeg, .png, .webp]"
        )

    contents = file.file.read()

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Kích thước file vượt quá giới hạn 1.5MB."
        )

    try: 
        image = Image.open(io.BytesIO(contents)).convert("RGB")

    except Exception: 
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="File image bị lỗi"
        )

    encoder = requests.app.state.encoder 
    milvus_client = requests.app.state.client

    TOP_K = 100
    embedding = encoder.encode_image(image)

    results = milvus_client.search(
            collection_name=settings.MILVUS_COLLECTION,
            data=embedding.tolist(),
            output_fields=["id"], 
            limit=TOP_K
        )
    
    return _format_milvus_res(results[0])