from pydantic import BaseModel 

class ImageResult(BaseModel): 
    image_id: str

class ImageSearchResponse(BaseModel):
    results: list[ImageResult]

class ErrorResponse(BaseModel): 
    description: str 
    status_code: int