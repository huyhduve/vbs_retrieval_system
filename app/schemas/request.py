from pydantic import BaseModel, Field
from typing import Literal, List

TopicType = Literal["News", "Tech", "Race", "Dragon", "Food", "Lecture", "Travel", "Life"]

class QueryRequest(BaseModel): 
    topic : List[TopicType] = Field(
        default=[], 
        description="Selected Topic"
    )
    RRF : bool
    text : str = Field(...,max_length=500, examples=["Donald Trump"])
    text_score: float = Field(default=0, ge=0, le=1)
    asr : str = Field(max_length=200)
    asr_score: float = Field(default=0, ge=0, le=1)
    ocr : str = Field(max_length=200)
    ocr_score : float = Field(default=0, ge=0, le=1)
    top_k : int = Field(default=100, ge=1, le=200) 

class SimSearchRequest(BaseModel): 
    image_id : str = Field(..., max_length=50, examples=["L21_V001/2548.webp"])

