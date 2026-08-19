from fastapi import APIRouter, HTTPException, status, Request
from schemas.response import ImageResult, ImageSearchResponse, GroupImageResult
from schemas.request import QueryRequest
from core.siglip_engine import SigLIP2Encoder
from milvus.connection import get_client
from config import settings

router = APIRouter()

@router.post("/search", response_model=ImageSearchResponse)
async def search(query : QueryRequest, requests : Request):
    print(query.text)
    if query.text == "r": 
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
                        image_id="L21_V001/19.webp",
                        ocr_text="day la vi du ocr", 
                        asr_text="day la vi du asr" 
                    ), 
                    ImageResult(
                        image_id="L21_V001/324.webp",
                        ocr_text="day la vi du ocr", 
                        asr_text="day la vi du asr" 
                    ), 
                    ImageResult(
                        image_id="L21_V001/403.webp",
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
                                image_id="L21_V002/2541.webp",
                                ocr_text="day la vi du ocr", 
                                asr_text="day la vi du asr" 
                            ), 
                        ]
                    ), 

        ])
    else: 
        response = ImageSearchResponse(results=[
                    GroupImageResult(
                        video_id="L21_V002/2541.webp", 
                        group=[
                            ImageResult(
                                image_id="L21_V002/2541.webp",
                                ocr_text="day la vi du ocr", 
                                asr_text="day la vi du asr" 
                            ), 
                            ImageResult(
                                image_id="L21_V002/2859.webp",
                                ocr_text="day la vi du ocr", 
                                asr_text="day la vi du asr" 
                            ), 
                            ImageResult(
                                image_id="L21_V002/3160.webp",
                                ocr_text="day la vi du ocr", 
                                asr_text="day la vi du asr" 
                            ), 
                            ImageResult(
                                image_id="L21_V002/3235.webp",
                                ocr_text="day la vi du ocr", 
                                asr_text="day la vi du asr" 
                            ), 
                            
                        ]
                    ), 
        
                    GroupImageResult(
                                video_id="L21_V005", 
                                group=[
                                    ImageResult(
                                        image_id="L21_V005/0.webp",
                                        ocr_text="day la vi du ocr", 
                                        asr_text="day la vi du asr" 
                                    ), 
                                    ImageResult(
                                        image_id="L21_V005/736.webp",
                                        ocr_text="day la vi du ocr", 
                                        asr_text="day la vi du asr" 
                                    ), 
                                    ImageResult(
                                        image_id="L21_V005/868.webp",
                                        ocr_text="day la vi du ocr", 
                                        asr_text="day la vi du asr" 
                                    ), 
                                ]
                            ), 
        
                ])


    return response

