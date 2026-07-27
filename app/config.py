from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    MILVUS_HOST: str
    MILVUS_PORT: int
    MILVUS_DB_NAME: str = "default"
    MILVUS_COLLECTION: str = "embeddings"
    IMAGE_DATA_PATH: str 
    MODEL_CKPT:str
    model_config = SettingsConfigDict(
        env_file=r"D:\Workspace\DevOps\FastAPI-Backend\app\.env",
        extra="ignore"
    )

settings = Settings()

if __name__ == "__main__": 
    print(settings.MILVUS_PORT)
