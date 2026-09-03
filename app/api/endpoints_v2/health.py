from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["Health"])

@router.get("/health")
def health(request: Request):
    report = {
        "status": "healthy",
        "milvus": {},
        "model": {},
        "gpu": {}
    }

    # Milvus
    report["milvus"] = {
        "status": "healthy"
    }

    # Model
    try:
        encoder = request.app.state.encoder

        report["model"] = {
            "status": "healthy",
            "class": encoder.__class__.__name__,
        }

        device = getattr(encoder.model, "device", None)

        report["gpu"] = {
            "available": device is not None and device.type == "cuda",
            "device": str(device)
        }

    except Exception as e:

        report["status"] = "unhealthy"

        report["model"] = {
            "status": "unhealthy",
            "error": str(e)
        }

    status_code = 200 if report["status"] == "healthy" else 503

    return JSONResponse(
        status_code=status_code,
        content=report
    )