from pydantic import BaseModel, Field

class QueryRequest(BaseModel): 
    text : str = Field(..., max_length=500, examples=["Donald Trump"])
    text_score: float = Field(default=0, ge=0, le=1)
    asr : str = Field(..., max_length=200)
    asr_score: float = Field(default=0, ge=0, le=1)
    ocr : str = Field(..., max_length=200)
    ocr_score : float = Field(default=0, ge=0, le=1)
    top_k : int = Field(default=100, ge=1, le=200) 


