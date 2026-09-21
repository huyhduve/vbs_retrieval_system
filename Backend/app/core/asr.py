import os
from typing import List, Union
import numpy as np
import torch
from sentence_transformers import SentenceTransformer

torch.set_num_threads(4)

class Vietnamesev2Encoder:
    def __init__(
        self,
        ckpt: str = "AITeamVN/Vietnamese_Embedding_v2",
        max_seq_length: int = 64,
        device: str = "cpu",
    ):
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        print(
            f"[*] Đang khởi tạo mô hình '{ckpt}' trên thiết bị: {self.device}"
        )

        # 2. Load model 1 lần duy nhất trong hàm __init__
        self.model = SentenceTransformer(ckpt, device=self.device)
        self.model.max_seq_length = max_seq_length

        print("[+] Mô hình đã sẵn sàng cho Inference.")

    def encode(
        self, text: str, convert_to_list: bool = True
    ) -> Union[List[float], np.ndarray]:
        
        if not text or not text.strip():
            raise ValueError("Đầu vào không được là chuỗi rỗng.")

        # Tắt gradient calculation để tối ưu bộ nhớ GPU và tốc độ xử lý
        with torch.no_grad():
            embedding = self.model.encode(
                text,
                normalize_embeddings=True,  # Chuẩn hóa L2 để tính Cosine Similarity nhanh bằng tích vô hướng (@)
                convert_to_numpy=True,
            )

        if convert_to_list:
            return embedding.tolist()

        return embedding


# Singleton Pattern (Tùy chọn): Khởi tạo sẵn một instance dùng chung nếu cần
_default_encoder_instance = None


def get_default_encoder() -> Vietnamesev2Encoder:
    global _default_encoder_instance
    if _default_encoder_instance is None:
        _default_encoder_instance = Vietnamesev2Encoder()
    return _default_encoder_instance