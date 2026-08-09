from pydantic import BaseModel 

class ImageResult(BaseModel): 
    image_id: str
    ocr_text: str  
    asr_text: str 


class GroupImageResult(BaseModel): 
    groups: list[ImageResult]

class ImageSearchResponse(BaseModel):
    results: list[GroupImageResult]

class ErrorResponse(BaseModel): 
    description: str 
    status_code: int