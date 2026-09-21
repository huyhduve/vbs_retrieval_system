from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    MILVUS_URI: str 
    VISUAL_COLLECTION: str 
    ASR_COLLECTION: str
    OCR_COLLECTION: str 
    EMBEDDING_PATH:str
    MODEL_CKPT: str 
    ASR_MODEL_CKPT: str
    model_config = SettingsConfigDict(
        env_file=r"./app/.env",
        extra="ignore"
    )

settings = Settings()
