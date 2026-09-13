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

