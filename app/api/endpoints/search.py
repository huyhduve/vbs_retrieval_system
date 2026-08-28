import os
import io
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import numpy as np

from fastapi import APIRouter, Request, HTTPException, status, UploadFile, File
from schemas.response import ImageResult, ImageSearchResponse, GroupImageResult
from schemas.request import QueryRequest, SimSearchRequest

from config import settings

router = APIRouter()

# Tên 2 collection riêng biệt trong Settings/Config
IMAGE_COLLECTION = getattr(settings, "IMAGE_COLLECTION", "keyframe_image")
ASR_COLLECTION = getattr(settings, "ASR_COLLECTION", "keyframe_asr")

ALLOW_EXTENSIONS = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 1.5 * 1024 * 1024  # MAX 1.5MB


def _format_milvus_res(hits: List[dict]) -> ImageSearchResponse:
    groups_map: Dict[str, List[ImageResult]] = {}

    for hit in hits:
        raw_id = str(hit["id"])
        video_id = raw_id.split("/")[0] if "/" in raw_id else raw_id

        # Tránh trùng đuôi .webp nếu ID gốc đã có sẵn
        image_id = raw_id if raw_id.endswith(".webp") else f"{raw_id}.webp"

        image_item = ImageResult(
            image_id=image_id,
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


def _apply_rrf_fusion(results_list: List[List[dict]], k: int = 60, top_k: int = 100) -> List[dict]:
    """Thuật toán RRF Fusion: Score = sum(1 / (k + rank))"""
    scores: Dict[str, float] = {}

    for hits in results_list:
        for rank, hit in enumerate(hits):
            doc_id = hit["id"]
            rrf_score = 1.0 / (k + rank + 1)
            scores[doc_id] = scores.get(doc_id, 0.0) + rrf_score

    sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
    return [{"id": doc_id, "score": score} for doc_id, score in sorted_docs]


def _apply_weighted_fusion(
    img_hits: List[dict], 
    asr_hits: List[dict], 
    img_w: float, 
    asr_w: float, 
    top_k: int = 100
) -> List[dict]:
    """Thuật toán Weighted Fusion dựa trên Cosine Distance"""
    scores: Dict[str, float] = {}

    total_w = img_w + asr_w
    if total_w == 0:
        img_w, asr_w = 0.5, 0.5
    else:
        img_w, asr_w = img_w / total_w, asr_w / total_w

    for hit in img_hits:
        doc_id = hit["id"]
        distance = hit.get("distance", hit.get("score", 0.0))
        scores[doc_id] = scores.get(doc_id, 0.0) + (distance * img_w)

    for hit in asr_hits:
        doc_id = hit["id"]
        distance = hit.get("distance", hit.get("score", 0.0))
        scores[doc_id] = scores.get(doc_id, 0.0) + (distance * asr_w)

    sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
    return [{"id": doc_id, "score": score} for doc_id, score in sorted_docs]


def _to_plain_list(vec: Any) -> List[float]:
    """Chuyển đổi an toàn từ Tensor/NumPy Array/List sang List thuần."""
    if isinstance(vec, list):
        return vec
    if hasattr(vec, "flatten"):
        return vec.flatten().tolist()
    return list(vec)


@router.post("/search", response_model=ImageSearchResponse)
def text_base_search(query: QueryRequest, requests: Request):
    image_text_encoder = requests.app.state.image_text_encoder
    asr_text_encoder = requests.app.state.asr_text_encoder
    milvus_client = requests.app.state.client

    top_k = query.top_k

    # 1. Hàm thực thi query Milvus độc lập
    def _search_image_branch(text_query: str) -> List[dict]:
        img_emb = image_text_encoder.encode_text(text_query)
        img_vec = _to_plain_list(img_emb)

        res = milvus_client.search(
            collection_name=IMAGE_COLLECTION,
            data=[img_vec],
            anns_field="image_embedding",
            limit=top_k,
            output_fields=["id"]
        )
        return res[0] if res else []

    def _search_asr_branch(asr_query: str) -> List[dict]:
        asr_emb = asr_text_encoder.encode(asr_query)
        asr_vec = _to_plain_list(asr_emb)

        res = milvus_client.search(
            collection_name=ASR_COLLECTION,
            data=[asr_vec],
            anns_field="asr_embedding",
            limit=top_k,
            output_fields=["id"]
        )
        return res[0] if res else []

    # 2. Sử dụng ThreadPoolExecutor để chạy tính toán & Search SONG SONG
    img_hits: List[dict] = []
    asr_hits: List[dict] = []

    has_text = bool(query.text and query.text.strip())
    has_asr = bool(query.asr and query.asr.strip())

    if not has_text and not has_asr:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cần truyền ít nhất nội dung 'text' hoặc 'asr' để tìm kiếm.",
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        future_img = executor.submit(_search_image_branch, query.text) if has_text else None
        future_asr = executor.submit(_search_asr_branch, query.asr) if has_asr else None

        if future_img:
            img_hits = future_img.result()
        if future_asr:
            asr_hits = future_asr.result()

    # 3. Phân nhánh Fusion (RRF vs Weighted Ranker)
    use_rrf = getattr(query, "RRF", getattr(query, "rrf", False))

    if img_hits and not asr_hits:
        final_hits = [{"id": h["id"], "score": h.get("distance", 0.0)} for h in img_hits[:top_k]]
    elif asr_hits and not img_hits:
        final_hits = [{"id": h["id"], "score": h.get("distance", 0.0)} for h in asr_hits[:top_k]]
    else:
        if use_rrf:
            final_hits = _apply_rrf_fusion([img_hits, asr_hits], k=60, top_k=top_k)
        else:
            final_hits = _apply_weighted_fusion(
                img_hits, asr_hits,
                img_w=query.text_score,
                asr_w=query.asr_score,
                top_k=top_k
            )

    return _format_milvus_res(final_hits)


@router.post("/search/image", response_model=ImageSearchResponse)
def image_base_search(requests: Request, file: UploadFile = File(...)):
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

    image_text_encoder = requests.app.state.image_text_encoder
    milvus_client = requests.app.state.client

    TOP_K = 100
    embedding = image_text_encoder.encode_image(image)
    emb_vec = _to_plain_list(embedding)

    results = milvus_client.search(
        collection_name=IMAGE_COLLECTION,
        data=[emb_vec],
        anns_field="image_embedding",
        output_fields=["id"],
        limit=TOP_K
    )

    return _format_milvus_res(results[0])


@router.post("/search/sim", response_model=ImageSearchResponse)
def sim_base_search(query: SimSearchRequest, requests: Request):
    milvus_client = requests.app.state.client

    TOP_K = 100

    file_path = query.image_id.replace(".webp", ".npy")
    emb_path = os.path.join(settings.EMBEDDING_PATH, file_path)

    if not os.path.exists(emb_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy file embedding: {emb_path}"
        )

    embedding = np.load(emb_path)
    emb_vec = _to_plain_list(embedding)

    results = milvus_client.search(
        collection_name=IMAGE_COLLECTION,
        data=[emb_vec],
        anns_field="image_embedding",
        output_fields=["id"],
        limit=TOP_K
    )

    return _format_milvus_res(results[0])