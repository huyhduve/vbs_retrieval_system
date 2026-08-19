from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    MILVUS_URI: str 
    MILVUS_COLLECTION: str 
    MODEL_CKPT: str 
    IMAGE_DATA_PATH: str 
    MODEL_CKPT:str
    model_config = SettingsConfigDict(
        env_file=r"./app/.env",
        extra="ignore"
    )

settings = Settings()
