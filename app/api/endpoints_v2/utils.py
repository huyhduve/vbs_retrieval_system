from typing import List, Dict, Any
from schemas.response import ImageResult, ImageSearchResponse, GroupImageResult
from pyvi import ViTokenizer 


def _format_milvus_res(hits: List[dict]) -> ImageSearchResponse:
    groups_map: Dict[str, List[ImageResult]] = {}

    for hit in hits:
        raw_id = str(hit["id"])
        video_id = raw_id.split("/")[0] if "/" in raw_id else raw_id

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

def _norm_text(txt: str) -> str: 
    txt = txt.lower()
    txt = ViTokenizer.tokenize(txt)
    return txt 