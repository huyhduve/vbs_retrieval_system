import os
import io
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import numpy as np

from fastapi import APIRouter, Request, HTTPException, status, UploadFile, File
from schemas.response import ImageResult, ImageSearchResponse, GroupImageResult
from schemas.request import QueryRequest, SimSearchRequest
from api.endpoints_v2.utils import _apply_rrf_fusion, _format_milvus_res, _apply_weighted_fusion, _to_plain_list, _norm_text

from config import settings

router = APIRouter()


ALLOW_EXTENSIONS = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 1.5 * 1024 * 1024  # MAX 1.5MB


@router.post("/search", response_model=ImageSearchResponse)
def text_base_search(query: QueryRequest, requests: Request):
    image_text_encoder = requests.app.state.image_text_encoder
    asr_text_encoder = requests.app.state.asr_text_encoder
    milvus_client = requests.app.state.client

    top_k = query.top_k

    partitions = query.topic

    def _search_visual(text_query: str) -> List[dict]:
        img_emb = image_text_encoder.encode_text(text_query)
        img_vec = _to_plain_list(img_emb)

        res = milvus_client.search(
            collection_name=settings.VISUAL_COLLECTION,
            data=[img_vec],
            anns_field="embedding",
            partition_names=partitions,
            limit=top_k,
            search_params = {"metric_type": "COSINE", "params": {}}, 
            output_fields=["id"]
        )
        return res[0] if res else []

    def _search_asr_dense(asr_query: str) -> List[dict]:
        asr_emb = asr_text_encoder.encode(asr_query)
        asr_vec = _to_plain_list(asr_emb)

        res = milvus_client.search(
            collection_name=settings.ASR_COLLECTION,
            data=[asr_vec],
            anns_field="embedding",
            partition_names=partitions,
            limit=top_k,
            search_params= {"metric_type": "COSINE", "params": {}}, 
            output_fields=["id"]
        )
        return res[0] if res else []
    
    def _search_asr_bm25(asr_query: str) -> List[dict]: 
        asr_text = _norm_text(asr_query)

        res = milvus_client.search(
            collection_name = settings.ASR_COLLECTION,
            data = [asr_text], 
            anns_field = "sparse_vector", 
            partition_names=partitions,
            limit=top_k,
            search_params = {"metric_type": "BM25", "params": {}}, 
            output_fields=["id"]
        )
        return res[0] if res else []

    def _search_ocr_bm25(ocr_query: str) -> List[dict]: 
        ocr_text = _norm_text(ocr_query)

        res = milvus_client.search(
            collection_name = settings.OCR_COLLECTION, 
            data = [ocr_text], 
            anns_field = "sparse_vector", 
            partition_names = partitions, 
            limit=top_k,
            search_params = {"metric_type": "BM25", "params": {}}, 
            output_fields=["id"]
        )
        return res[0] if res else []


    # 2. Sử dụng ThreadPoolExecutor để chạy tính toán & Search SONG SONG
    channel_hits: Dict[str, List[dict]] = {}
    weights: Dict[str, float] = {}

    has_text = bool(query.text and query.text.strip())
    has_asr = bool(query.asr and query.asr.strip())
    has_ocr = bool(query.ocr and query.ocr.strip()) 

    if not has_text and not has_asr and not has_ocr:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cần truyền ít nhất nội dung 'text' hoặc 'asr' hoặc 'ocr' để tìm kiếm.",
        )

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {}

        if has_text: 
            futures["visual"] = executor.submit(_search_visual, query.text)
            weights["visual"] = query.text_score

        if has_asr: 
            futures["asr_dense"] = executor.submit(_search_asr_dense, query.asr)
            futures["asr_bm25"] = executor.submit(_search_asr_bm25, query.asr)
            weights["asr_dense"] = query.asr_score*0.3 
            weights["asr_bm25"] = query.asr_score*0.7

        if has_ocr: 
            futures["ocr"] = executor.submit(_search_ocr_bm25, query.ocr)
            weights["ocr"] = query.ocr_score


    for channel, future in futures.items():
            try:
                channel_hits[channel] = future.result()
            except Exception as e:
                print(f"⚠️ [Search Error] Lỗi kênh {channel}: {e}")
                channel_hits[channel] = []

    all_results_list = [hits for hits in channel_hits.values() if hits]
    if not all_results_list:
        return _format_milvus_res([])


    if len(all_results_list) == 1:
            single_hits = all_results_list[0]
            final_hits = [{"id": h["id"], "score": h.get("distance", h.get("score", 0.0))} for h in single_hits[:top_k]]
    else:
        if query.RRF:
            final_hits = _apply_rrf_fusion(all_results_list, k=60, top_k=top_k)
        else:
            final_hits = _apply_weighted_fusion(channel_hits, weights, top_k=top_k)

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
        collection_name=settings.VISUAL_COLLECTION,
        data=[emb_vec],
        anns_field="image_embedding",
        output_fields=["id"],
        limit=TOP_K
    )

    return _format_milvus_res(results[0])



@router.post("/search/sim", response_model=ImageSearchResponse)
def sim_base_search(query: SimSearchRequest, requests: Request):
    milvus_client = requests.app.state.client

    TOP_K = 200

    PARTITION_NAMES = [
        "News", "Tech", "Race", "Dragon", 
        "Food", "Lecture", "Travel", "Life"
    ]

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
        collection_name=settings.VISUAL_COLLECTION,
        data=[emb_vec],
        anns_field="embedding",
        partition_names = PARTITION_NAMES, 
        output_fields=["id"],
        limit=TOP_K, 
    )

    return _format_milvus_res(results[0])