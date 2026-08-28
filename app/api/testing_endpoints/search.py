import numpy as np 
import os 
from PIL import Image
import io 

from fastapi import APIRouter, Request, HTTPException, status, UploadFile, File
from pydantic import BaseModel
from schemas.response import ImageResult, ImageSearchResponse, GroupImageResult
from schemas.request import QueryRequest, SimSearchRequest

router = APIRouter()


class ImageMetadataResponse(BaseModel):
    file_size: int
    width: int
    height: int

def _format_milvus_res(): 
    response = ImageSearchResponse(results=[
                    GroupImageResult(
                        video_id="L21_V001", 
                        group=[
                            ImageResult(
                                image_id="L21_V001/0.webp",
                                ocr_text="day la vi du ocr", 
                                asr_text="day la vi du asr" 
                            ), 
                            ImageResult(
                                image_id="L21_V001/3368.webp",
                                ocr_text="day la vi du ocr", 
                                asr_text="day la vi du asr" 
                            ), 
                            ImageResult(
                                image_id="L21_V001/8954.webp",
                                ocr_text="day la vi du ocr", 
                                asr_text="day la vi du asr" 
                            ), 
                            ImageResult(
                                image_id="L21_V001/10265.webp",
                                ocr_text="day la vi du ocr", 
                                asr_text="day la vi du asr" 
                            ), 
                            
                        ]
                    ), 
    
                    GroupImageResult(
                                video_id="L21_V002", 
                                group=[
                                    ImageResult(
                                        image_id="L21_V002/0.webp",
                                        ocr_text="day la vi du ocr", 
                                        asr_text="day la vi du asr" 
                                    ), 
                                    ImageResult(
                                        image_id="L21_V002/1605.webp",
                                        ocr_text="day la vi du ocr", 
                                        asr_text="day la vi du asr" 
                                    ), 
                                    ImageResult(
                                        image_id="L21_V002/5673.webp",
                                        ocr_text="day la vi du ocr", 
                                        asr_text="day la vi du asr" 
                                    ), 
                                ]
                            ), 
    
                ])

    return response


@router.post("/search", response_model=ImageSearchResponse)
def text_base_search(query: QueryRequest | SimSearchRequest, requests: Request):
    return _format_milvus_res()

@router.post("/search/sim", response_model=ImageSearchResponse)
def text_base_search(query: QueryRequest | SimSearchRequest, requests: Request):
    return _format_milvus_res()
    

ALLOW_EXTENSIONS = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 1.5 * 1024 * 1024 # MAX 1.5MB 

@router.post("/search/image", response_model=ImageMetadataResponse)
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

    file_size = len(contents)
    width, height = image.size

    return ImageMetadataResponse(
        file_size=file_size,
        width=width,
        height=height,
    )




