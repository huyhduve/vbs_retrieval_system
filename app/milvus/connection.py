from pymilvus import MilvusClient
from config import settings

def get_client():
    return MilvusClient(
        uri=settings.MILVUS_URI
    )
