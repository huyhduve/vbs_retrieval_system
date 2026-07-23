import threading
from typing import Union, List, Tuple, Dict
from io import BytesIO
import requests
import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image
from transformers import AutoModel, AutoProcessor


class SigLIPEngine:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(SigLIPEngine, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(
        self,
        model_id: str = "google/siglip-base-patch16-256-multilingual",
        device: str = None,
    ):
        with self._lock:
            if getattr(self, "_initialized", False):
                return

            self.model_id = model_id
            self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")

            if self.device == "cuda":
                capability = torch.cuda.get_device_capability()
                self.dtype = torch.bfloat16 if capability[0] >= 8 else torch.float16
            else:
                self.dtype = torch.float32

            print(f"[SigLIPEngine] Initializing '{self.model_id}' on {self.device} ({self.dtype})...")

            self.processor = AutoProcessor.from_pretrained(self.model_id)
            self.model = AutoModel.from_pretrained(
                self.model_id, torch_dtype=self.dtype
            ).to(self.device)
            self.model.eval()

            self._initialized = True

    @torch.no_grad()
    def encode_text(
        self, 
        texts: Union[str, List[str]], 
        as_tensor: bool = False
    ) -> Union[np.ndarray, torch.Tensor]:
        if isinstance(texts, str):
            texts = [texts]

        inputs = self.processor(
            text=texts, padding="max_length", return_tensors="pt"
        ).to(self.device)

        output = self.model.get_text_features(**inputs)
        text_features = output.pooler_output if hasattr(output, "pooler_output") else output[0]

        normalized_features = F.normalize(text_features, p=2, dim=-1)

        if as_tensor:
            return normalized_features
        return normalized_features.to(torch.float32).cpu().numpy()

    @torch.no_grad()
    def encode_image(
        self, 
        images: Union[Image.Image, List[Image.Image]], 
        as_tensor: bool = False
    ) -> Union[np.ndarray, torch.Tensor]:
        if isinstance(images, Image.Image):
            images = [images]

        images = [img.convert("RGB") for img in images]

        inputs = self.processor(
            images=images, return_tensors="pt"
        ).to(self.device)

        output = self.model.get_image_features(**inputs)
        image_features = output.pooler_output if hasattr(output, "pooler_output") else output[0]

        normalized_features = F.normalize(image_features, p=2, dim=-1)

        if as_tensor:
            return normalized_features
        return normalized_features.to(torch.float32).cpu().numpy()

    def predict_confidence(self, image: Image.Image, text: str) -> Dict[str, float]:
        img_emb = self.encode_image(image, as_tensor=True)   # Shape: (1, dim)
        text_emb = self.encode_text(text, as_tensor=True)   # Shape: (1, dim)

        cosine_sim = torch.sum(img_emb * text_emb, dim=-1).item()

        # 3. Quy đổi sang Confidence Score (%) theo hàm Sigmoid hiệu chỉnh cho SigLIP
        k = 50.0       # Steepness
        x0 = 0.04      # Decision boundary
        confidence = 1.0 / (1.0 + np.exp(-k * (cosine_sim - x0)))

        return {
            "cosine_similarity": round(cosine_sim, 4),
            "confidence_score": round(confidence * 100, 2)
        }

if __name__ == "__main__": 
    engine = SigLIPEngine()

    img_url = "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=500"
    response = requests.get(img_url)
    image = Image.open(BytesIO(response.content))

    result_1 = engine.predict_confidence(image, "a photo of a dog")
    print(f"Query: 'a photo of a dog' -> Confidence: {result_1['confidence_score']}% (Cosine Sim: {result_1['cosine_similarity']})")

    result_2 = engine.predict_confidence(image, "a photo of a cat")
    print(f"Query: 'a photo of a cat' -> Confidence: {result_2['confidence_score']}% (Cosine Sim: {result_2['cosine_similarity']})")