import json
import os
import io
import base64
import argparse
import asyncio
from pathlib import Path
from typing import List

import torch
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from diffusers.pipelines.z_image.pipeline_z_image import ZImagePipeline
except ImportError:
    # Fallback or mock for development if diffusers is not updated yet
    print("ZImagePipeline not found in diffusers. Please install from source.")
    ZImagePipeline = None


# ============================================================================
# Configuration Management
# ============================================================================

CONFIG_FILE = "config.json"

def load_config():
    """Load configuration file"""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding='utf8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading config: {e}")
    
    return {
        "cache_dir": None,
        "model_id": "Tongyi-MAI/Z-Image-Turbo"
    }

def save_config(config):
    """Save configuration file"""
    try:
        with open(CONFIG_FILE, "w", encoding='utf8') as f:
            json.dump(config, f, indent=4)
    except Exception as e:
        print(f"Error saving config: {e}")


# ============================================================================
# Model Management
# ============================================================================

# Global variables
model_config = load_config()
if "cpu_offload" not in model_config:
    model_config["cpu_offload"] = False
pipe = None

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except:
            pass

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

# Notification types
NOTIFICATION_INFO = "info"
NOTIFICATION_SUCCESS = "success"
NOTIFICATION_ERROR = "error"
NOTIFICATION_WARNING = "warning"

async def send_notification(notification_type: str, message: str, persistent: bool = False):
    """Send notification to all connected clients"""
    notification = {
        "type": "notification",
        "notification_type": notification_type,
        "message": message,
        "persistent": persistent
    }
    await manager.broadcast(notification)

def get_model_directory():
    """Get model storage directory"""
    model_dir = Path(__file__).resolve().parent.parent.parent / "models"
    model_id = model_config.get('model_id', "Tongyi-MAI/Z-Image-Turbo")
    safe_model_id = model_id.replace("/", "_").replace("-", "_")
    return model_dir / safe_model_id

def download_model(model_id, model_subdir):
    """Download model"""
    print(f"Model not found at {model_subdir}. Downloading...")
    try:
        from modelscope.hub.snapshot_download import snapshot_download
        snapshot_download(
            model_id=model_id,
            local_dir=str(model_subdir)
        )
        print(f"Model downloaded successfully to {model_subdir}")
    except Exception as e:
        print(f"Error downloading model: {e}")
        raise e

async def load_pipeline():
    """Load model pipeline"""
    global pipe
    
    if ZImagePipeline is None:
        raise HTTPException(status_code=500, detail="ZImagePipeline class not available. Install diffusers from source.")
    
    model_id = model_config.get('model_id', "Tongyi-MAI/Z-Image-Turbo")
    print(f"Loading model {model_id}...")
    
    # Send loading notification
    await send_notification(NOTIFICATION_INFO, f"开始加载模型 {model_id}...", persistent=False)
    
    model_subdir = get_model_directory()
    print(f"Using model directory: {model_subdir}")
    
    # Check if model exists
    if not model_subdir.exists():
        await send_notification(NOTIFICATION_INFO, "模型未找到，开始下载...", persistent=False)
        download_model(model_id, model_subdir)
    
    try:
        # Check device
        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.bfloat16 if device == "cuda" else torch.float32
        
        # Load model
        pipe = ZImagePipeline.from_pretrained(
            str(model_subdir),
            torch_dtype=dtype,
            low_cpu_mem_usage=False
        )
        
        # Configure device
        if model_config.get("cpu_offload", False) and device == "cuda":
            print("Enabling CPU Offload")
            pipe.enable_model_cpu_offload()
        else:
            pipe.to(device)
            
        print(f"Model loaded on {device}")
        # Send success notification (persistent)
        await send_notification(NOTIFICATION_SUCCESS, f"模型加载成功！设备: {device}", persistent=True)
    except Exception as e:
        print(f"Error loading model: {e}")
        # Send error notification (persistent)
        await send_notification(NOTIFICATION_ERROR, f"模型加载失败: {str(e)}", persistent=True)
        raise e

async def get_pipeline():
    """Get model pipeline (lazy loading)"""
    global pipe
    if pipe is None:
        await load_pipeline()
    return pipe

def unload_pipeline():
    """Unload model pipeline"""
    global pipe
    if pipe is not None:
        pipe = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        print("Model pipeline unloaded")


# ============================================================================
# Request Models
# ============================================================================

class SettingsRequest(BaseModel):
    """Settings request model"""
    cache_dir: str
    cpu_offload: bool = False

class GenerateRequest(BaseModel):
    """Generation request model"""
    prompt: str
    height: int = 1024
    width: int = 1024
    steps: int = 8
    guidance_scale: float = 0.0
    seed: int = -1


# ============================================================================
# API Endpoint Handler Functions
# ============================================================================

def handle_set_settings(req: SettingsRequest):
    """Handle settings update request"""
    try:
        if req.cache_dir and not os.path.exists(req.cache_dir):
            os.makedirs(req.cache_dir, exist_ok=True)
        
        model_config["cache_dir"] = req.cache_dir
        model_config["cpu_offload"] = req.cpu_offload
        save_config(model_config)
        
        # Force model reload
        unload_pipeline()
        
        return {"status": "success", "message": "Settings saved. Model will reload on next generation."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def handle_get_settings():
    """Handle get settings request"""
    return model_config

async def handle_generate_image(req: GenerateRequest):
    """Handle image generation request"""
    # Validate dimensions
    if req.height % 16 != 0 or req.width % 16 != 0:
        raise HTTPException(status_code=400, detail="Height and Width must be divisible by 16.")
    
    try:
        pipeline = await get_pipeline()
        
        if pipeline is None:
            raise ValueError('Cannot get pipeline.')
        
        # Configure generator
        device = "cuda" if torch.cuda.is_available() else "cpu"
        generator = None
        if req.seed != -1:
            generator = torch.Generator(device).manual_seed(req.seed)
        
        # Execute inference
        print(f"Generating with prompt: {req.prompt}")
        image = pipeline(
            prompt=req.prompt,
            height=req.height,
            width=req.width,
            num_inference_steps=req.steps,
            guidance_scale=req.guidance_scale,
            generator=generator,
        ).images[0]
        
        # Convert to base64
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        return {"image": f"data:image/png;base64,{img_str}"}
    except Exception as e:
        print(f"Error generating image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def handle_health_check():
    """Handle health check request"""
    return {"status": "ok"}


# ============================================================================
# FastAPI Application
# ============================================================================

async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time notifications"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

def create_app():
    """Create FastAPI application"""
    app = FastAPI()
    
    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Register routes
    app.post("/settings/model-path")(handle_set_settings)
    app.get("/settings")(handle_get_settings)
    app.post("/generate")(handle_generate_image)
    app.get("/health")(handle_health_check)
    app.websocket("/ws")(websocket_endpoint)
    
    return app


# ============================================================================
# Main Function
# ============================================================================

def main():
    """Main function"""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Z-Image Turbo WebUI Backend")
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to run the server on (default: 8000)"
    )
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host to bind the server to (default: 0.0.0.0)"
    )
    
    args = parser.parse_args()
    
    # Create application
    app = create_app()
    
    # Run application
    import uvicorn
    uvicorn.run(app, host=args.host, port=args.port)


# ============================================================================
# Program Entry Point
# ============================================================================

if __name__ == "__main__":
    main()
