from pydantic import BaseModel 

class ImageResult(BaseModel): 
    image_id: str
    ocr_text: str  
    asr_text: str 


class GroupImageResult(BaseModel):  
    video_id : str
    group: list[ImageResult]

class ImageSearchResponse(BaseModel):
    results: list[GroupImageResult]

class ErrorResponse(BaseModel): 
    description: str 
    status_code: int