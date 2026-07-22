from pydantic import BaseModel, Field

class TextQueryRequest(BaseModel): 
    query : str = Field(..., min_length=1, max_length=500, examples=["Donald Trump"])
    top_k : int = Field(default=100, ge=1, le=200) 


