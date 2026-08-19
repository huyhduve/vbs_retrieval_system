# # import threading
# # from pathlib import Path
# # from typing import Optional, Union, List
# # from PIL import Image
# # import torch
# # import torch.nn as nn
# # from transformers import AutoModelForZeroShotImageClassification, AutoProcessor
# # from config import settings


# # class SigLIP2Encoder:
# #     """
# #     Singleton Class dùng để trích xuất Embedding cho cả Image và Text Query.
# #     Được đồng nhất hoàn toàn về mặt không gian biểu diễn (Joint Embedding Space) 
# #     với pipeline Ingestion vào Milvus Lite.
# #     """
# #     _instance: Optional["SigLIP2Encoder"] = None
# #     _lock: threading.Lock = threading.Lock()

# #     def __new__(cls, ckpt: str = settings.MODEL_CKPT):
# #         # Thiết kế Double-Checked Locking đảm bảo Thread-Safe Singleton
# #         if cls._instance is None:
# #             with cls._lock:
# #                 if cls._instance is None:
# #                     cls._instance = super(SigLIP2Encoder, cls).__new__(cls)
# #                     cls._instance._initialized = False
# #         return cls._instance

# #     def __init__(self, ckpt: str = settings.MODEL_CKPT):
# #         if getattr(self, "_initialized", False):
# #             return

# #         with self._lock:
# #             if getattr(self, "_initialized", False):
# #                 return

# #             self.device = "cuda" if torch.cuda.is_available() else "cpu"
# #             print(f"📦 [Model Singleton] Đang nạp mô hình {ckpt} lên thiết bị: {self.device}...", flush=True)

# #             self.processor = AutoProcessor.from_pretrained(ckpt)
# #             # Dùng ZeroShot classification class để tự động map qua Projection Head chuẩn xác
# #             self.model = AutoModelForZeroShotImageClassification.from_pretrained(ckpt).to(self.device).eval()

# #             if self.device == "cuda" and hasattr(torch, "compile"):
# #                 try:
# #                     self.model = torch.compile(self.model)
# #                     print("⚡ [Model Singleton] Đã kích hoạt torch.compile thành công!", flush=True)
# #                 except Exception as e:
# #                     print(f"⚠️ [Model Singleton] Lỗi torch.compile: {e}", flush=True)

# #             self._initialized = True
# #             print("✅ [Model Singleton] Nạp mô hình hoàn tất thành công!", flush=True)

# #     @classmethod
# #     def get_instance(cls) -> "SigLIP2Encoder":
# #         if cls._instance is None or not getattr(cls._instance, "_initialized", False):
# #             raise RuntimeError("Mô hình chưa được nạp! Vui lòng khởi tạo qua lifespan event hoặc gọi SigLIP2Encoder().")
# #         return cls._instance

# # #     @torch.no_grad()
# # #     def encode_image(self, image_input: Union[Image.Image, str, Path]) -> List[float]:
# # #         """
# # #         Encode một bức ảnh thành vector 1D (List[float]) phục vụ tìm kiếm hoặc kiểm tra đơn lẻ.
# # #         """
# # #         if isinstance(image_input, (str, Path)):
# # #             image_input = Image.open(image_input).convert("RGB")
# # #         elif isinstance(image_input, Image.Image):
# # #             image_input = image_input.convert("RGB")

# # #         inputs = self.processor(images=image_input, return_tensors="pt")
# # #         inputs = {k: v.to(self.device, non_blocking=True) for k, v in inputs.items()}

# # #         use_amp = True if self.device == "cuda" else False

# # #         with torch.autocast(device_type=self.device, enabled=use_amp, dtype=torch.float16):
# # #             outputs = self.model.get_image_features(**inputs)

# # #             if hasattr(outputs, "pooler_output") and not isinstance(outputs, torch.Tensor):
# # #                 image_features = outputs.pooler_output
# # #             elif hasattr(outputs, "image_embeds"):
# # #                 image_features = outputs.image_embeds
# # #             else:
# # #                 image_features = outputs

# # #             # L2 Normalization
# # #             image_features = nn.functional.normalize(image_features, p=2, dim=-1)

# # #         # Trả về 1D List chuẩn Python [dim]
# # #         return image_features.squeeze(0).cpu().to(torch.float32).tolist()

# # #     @torch.no_grad()
# # #     def encode_text(self, text: Union[str, List[str]]) -> Union[List[float], List[List[float]]]: 
# # #         """
# # #         Encode chuỗi hoặc danh sách chuỗi văn bản thành vector phục vụ Query Milvus.
# # #         - Trả về List[float] (Vectơ 1D) nếu đầu vào là `str` đơn lẻ.
# # #         - Trả về List[List[float]] (Ma trận 2D) nếu đầu vào là `List[str]`.
# # #         """
# # #         is_single_str = isinstance(text, str)
# # #         if is_single_str:
# # #             text = [text]

# # #         inputs = self.processor(
# # #             text=text, 
# # #             padding="max_length", 
# # #             truncation=True, 
# # #             return_tensors="pt"
# # #         )
# # #         inputs = {k: v.to(self.device, non_blocking=True) for k, v in inputs.items()}

# # #         use_amp = True if self.device == "cuda" else False

# # #         with torch.autocast(device_type=self.device, enabled=use_amp, dtype=torch.float16):
# # #             outputs = self.model.get_text_features(**inputs)

# # #             if hasattr(outputs, "pooler_output") and not isinstance(outputs, torch.Tensor):
# # #                 text_features = outputs.pooler_output
# # #             elif hasattr(outputs, "text_embeds"):
# # #                 text_features = outputs.text_embeds
# # #             else:
# # #                 text_features = outputs

# # #             # L2 Normalization
# # #             text_features = nn.functional.normalize(text_features, p=2, dim=-1)

# # #         text_features = text_features.cpu().to(torch.float32)

# # #         if is_single_str:
# # #             return text_features.squeeze(0).tolist()  # Trả về List[float] (1D)
        
# # #         return text_features.tolist()  # Trả về List[List[float]] (2D)


# #     @torch.no_grad()
# #     def encode_image(self, image_input: Union[Image.Image, str, Path]) -> List[float]:
# #         if isinstance(image_input, (str, Path)):
# #             image_input = Image.open(image_input).convert("RGB")
# #         elif isinstance(image_input, Image.Image):
# #             image_input = image_input.convert("RGB")

# #         inputs = self.processor(images=image_input, return_tensors="pt")
# #         inputs = {k: v.to(self.device, non_blocking=True) for k, v in inputs.items()}

# #         # Với GTX 1060: Tắt autocast, ép chạy thuần FP32 để tránh lỗi NaN và tụt FPS
# #         outputs = self.model.get_image_features(**inputs)

# #         if hasattr(outputs, "pooler_output") and not isinstance(outputs, torch.Tensor):
# #             image_features = outputs.pooler_output
# #         elif hasattr(outputs, "image_embeds"):
# #             image_features = outputs.image_embeds
# #         else:
# #             image_features = outputs

# #         # L2 Normalization
# #         image_features = nn.functional.normalize(image_features, p=2, dim=-1)

# #         return image_features.squeeze(0).cpu().to(torch.float32).tolist()

# #     @torch.no_grad()
# #     def encode_text(self, text: Union[str, List[str]]) -> Union[List[float], List[List[float]]]: 
# #         is_single_str = isinstance(text, str)
# #         if is_single_str:
# #             text = [text]

# #         inputs = self.processor(
# #             text=text, 
# #             padding="max_length", 
# #             truncation=True, 
# #             return_tensors="pt"
# #         )
# #         inputs = {k: v.to(self.device, non_blocking=True) for k, v in inputs.items()}

# #         # Với GTX 1060: Chạy trực tiếp FP32
# #         outputs = self.model.get_text_features(**inputs)

# #         if hasattr(outputs, "pooler_output") and not isinstance(outputs, torch.Tensor):
# #             text_features = outputs.pooler_output
# #         elif hasattr(outputs, "text_embeds"):
# #             text_features = outputs.text_embeds
# #         else:
# #             text_features = outputs

# #         # L2 Normalization
# #         text_features = nn.functional.normalize(text_features, p=2, dim=-1)

# #         text_features = text_features.cpu().to(torch.float32)

# #         if is_single_str:
# #             return text_features.squeeze(0).tolist()
            
# #         return text_features.tolist()


import threading
from typing import Union, List, Optional, Dict
from PIL import Image
import numpy as np
import torch
import torch.nn as nn
from transformers import AutoModel, AutoProcessor

class SigLIP2Encoder:
    _instance: Optional["SigLIP2Encoder"] = None
    _lock: threading.Lock = threading.Lock()

    def __new__(cls, ckpt: str = "google/siglip2-so400m-patch14-384"):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(SigLIP2Encoder, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self, ckpt: str = "google/siglip2-so400m-patch14-384"):
        if getattr(self, "_initialized", False):
            return

        with self._lock:
            if getattr(self, "_initialized", False):
                return

            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"📦 [SigLIP2 Engine] Loading model {ckpt} onto {self.device}...", flush=True)

            self.processor = AutoProcessor.from_pretrained(ckpt)
            # Dùng AutoModel thay vì ZeroShotImageClassification để giảm overhead
            self.model = AutoModel.from_pretrained(ckpt).to(self.device).eval()

            self._initialized = True
            print("✅ [SigLIP2 Engine] Model loaded successfully!", flush=True)

    @classmethod
    def get_instance(cls) -> "SigLIP2Encoder":
        if cls._instance is None or not getattr(cls._instance, "_initialized", False):
            raise RuntimeError("Engine has not been initialized!")
        return cls._instance

    def _get_amp_config(self):
        use_amp = True if self.device == "cuda" else False
        amp_dtype = (
            torch.bfloat16 
            if (self.device == "cuda" and torch.cuda.is_bf16_supported()) 
            else torch.float32
        )
        return use_amp, amp_dtype

    def _extract_features(self, outputs) -> torch.Tensor:
        """Trích xuất Tensor nguyên bản từ Hugging Face Model Output object."""
        if isinstance(outputs, torch.Tensor):
            return outputs
        if hasattr(outputs, "image_embeds") and outputs.image_embeds is not None:
            return outputs.image_embeds
        if hasattr(outputs, "text_embeds") and outputs.text_embeds is not None:
            return outputs.text_embeds
        if hasattr(outputs, "pooler_output") and outputs.pooler_output is not None:
            return outputs.pooler_output
        return outputs[0]

    @torch.no_grad()
    def encode_image(
        self, 
        images: Union[Image.Image, List[Image.Image]], 
        return_numpy: bool = True
    ) -> Union[np.ndarray, torch.Tensor]:
        if isinstance(images, Image.Image):
            images = [images]

        inputs = self.processor(images=images, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        use_amp, amp_dtype = self._get_amp_config()
        with torch.autocast(device_type=self.device, enabled=use_amp, dtype=amp_dtype):
            outputs = self.model.get_image_features(**inputs)

        features = self._extract_features(outputs)
        features = nn.functional.normalize(features, p=2, dim=-1)
        features = features.cpu().to(torch.float32)

        return features.numpy() if return_numpy else features

    @torch.no_grad()
    def encode_text(
        self, 
        text: Union[str, List[str]], 
        return_numpy: bool = True
    ) -> Union[np.ndarray, torch.Tensor]:
        if isinstance(text, str):
            text = [text]

        inputs = self.processor(
            text=text, 
            padding="max_length", 
            truncation=True, 
            return_tensors="pt"
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        use_amp, amp_dtype = self._get_amp_config()
        with torch.autocast(device_type=self.device, enabled=use_amp, dtype=amp_dtype):
            outputs = self.model.get_text_features(**inputs)

        features = self._extract_features(outputs)
        features = nn.functional.normalize(features, p=2, dim=-1)
        features = features.cpu().to(torch.float32)

        return features.numpy() if return_numpy else features

if __name__ == "__main__": 
    import numpy as np

    def cosine_similarity(a, b):
        a = np.asarray(a, dtype=np.float32).flatten()
        b = np.asarray(b, dtype=np.float32).flatten()

        if a.shape != b.shape:
            raise ValueError(f"Shape mismatch: {a.shape} vs {b.shape}")

        return np.dot(a, b) / (
            np.linalg.norm(a) * np.linalg.norm(b)
        )

    texts = [
        "Donald Trump",
        "a photo of Donald Trump",
        "Donald Trump speaking",
        "a man",
        "a politician",
        "a person speaking",
        "a dog",
    ]

    engine = SigLIP2Encoder()
    text_embs = engine.encode_text(
        texts,
        return_numpy=False
    )

    img = Image.open(r"D:\Workspace\DevOps\FastAPI-Backend\licensed-image.webp")
    img_emb = engine.encode_image(
        img, 
        return_numpy=False
    )

    scores = torch.matmul(
        img_emb,
        text_embs.T
    ).squeeze(0)

    for text, score in zip(texts, scores):
        print(f"{score.item():.6f} | {text}")

