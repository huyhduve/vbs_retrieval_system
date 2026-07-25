# model.py
from pathlib import Path
from typing import Optional
import torch
import torch.nn as nn
from PIL import Image
from transformers import AutoModel, AutoProcessor
from config import settings


class SigLIP2Encoder:
    _instance: Optional["SigLIP2Encoder"] = None

    def __new__(cls, ckpt: str = settings.MODEL_CKPT):
        if cls._instance is None:
            cls._instance = super(SigLIP2Encoder, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, ckpt: str = settings.MODEL_CKPT):
        if getattr(self, "_initialized", False):
            return

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"📦 [Model Singleton] Đang nạp mô hình {ckpt} lên thiết bị: {self.device}")

        self.processor = AutoProcessor.from_pretrained(ckpt)
        self.model = AutoModel.from_pretrained(ckpt).to(self.device).eval()

        if self.device == "cuda" and hasattr(torch, "compile"):
            try:
                self.model = torch.compile(self.model)
                print("⚡ [Model Singleton] Đã kích hoạt torch.compile")
            except Exception as e:
                print(f"⚠️ [Model Singleton] Lỗi torch.compile: {e}")

        self._initialized = True
        print("✅ [Model Singleton] Nạp mô hình hoàn tất thành công!")

    @classmethod
    def get_instance(cls) -> "SigLIP2Encoder":
        if cls._instance is None:
            raise RuntimeError("Mô hình chưa được nạp! Vui lòng khởi tạo qua lifespan event.")
        return cls._instance

    @torch.no_grad()
    def encode_image(self, image_input: Image.Image | str | Path) -> torch.Tensor:
        if isinstance(image_input, (str, Path)):
            image_input = Image.open(image_input).convert("RGB")
        elif isinstance(image_input, Image.Image):
            image_input = image_input.convert("RGB")

        inputs = self.processor(images=image_input, return_tensors="pt")
        inputs = {k: v.to(self.device, non_blocking=True) for k, v in inputs.items()}

        use_amp = True if self.device == "cuda" else False

        with torch.autocast(device_type=self.device, enabled=use_amp, dtype=torch.float16):
            outputs = self.model.get_image_features(**inputs)

            if hasattr(outputs, "image_embeds"):
                image_features = outputs.image_embeds
            elif hasattr(outputs, "pooler_output"):
                image_features = outputs.pooler_output
            elif isinstance(outputs, torch.Tensor):
                image_features = outputs
            else:
                image_features = outputs[0]

            image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)

        return image_features.squeeze(0).cpu().to(torch.float32)


    @torch.no_grad()
    def encode_image(self, image_input: Image.Image | str | Path) -> torch.Tensor:
        if isinstance(image_input, (str, Path)):
            image_input = Image.open(image_input).convert("RGB")
        elif isinstance(image_input, Image.Image):
            image_input = image_input.convert("RGB")

        inputs = self.processor(images=image_input, return_tensors="pt")
        inputs = {k: v.to(self.device, non_blocking=True) for k, v in inputs.items()}

        use_amp = True if self.device == "cuda" else False

        with torch.autocast(device_type=self.device, enabled=use_amp, dtype=torch.float16):
            outputs = self.model.get_image_features(**inputs)

            if hasattr(outputs, "image_embeds"):
                image_features = outputs.image_embeds
            elif hasattr(outputs, "pooler_output"):
                image_features = outputs.pooler_output
            elif isinstance(outputs, torch.Tensor):
                image_features = outputs
            else:
                image_features = outputs[0]

            # L2 Normalization
            image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)

        return image_features.squeeze(0).cpu().to(torch.float32)

    @torch.no_grad()
    def encode_text(self, text: str) -> torch.Tensor: 
        inputs = self.processor(
            text=text, 
            padding="max_length" if isinstance(text, list) else True,
            truncation=True, 
            return_tensors="pt"
        )
        inputs = {k: v.to(self.device, non_blocking=True) for k, v in inputs.items()}

        use_amp = True if self.device == "cuda" else False

        with torch.autocast(device_type=self.device, enabled=use_amp, dtype=torch.float16):
            outputs = self.model.get_text_features(**inputs)

            if hasattr(outputs, "text_embeds"):
                text_features = outputs.text_embeds
            elif hasattr(outputs, "pooler_output"):
                text_features = outputs.pooler_output
            elif isinstance(outputs, torch.Tensor):
                text_features = outputs
            else:
                text_features = outputs[0]

            text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)

        if isinstance(text, str):
            return text_features.squeeze(0).cpu().to(torch.float32)
        return text_features.cpu().to(torch.float32)