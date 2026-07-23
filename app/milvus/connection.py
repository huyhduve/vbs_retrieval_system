from pymilvus import MilvusClient
from app.config import settings

def get_client():
    return MilvusClient(
        uri=f"http://{settings.MILVUS_HOST}:{settings.MILVUS_PORT}"
    )
