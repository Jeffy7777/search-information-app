import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import httpx
import json
import asyncio
import re
from dotenv import load_dotenv
from typing import List, Optional

load_dotenv()

app = FastAPI()

# 允许跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 【关键：绝对路径计算】
# 这样无论在本地还是 Render，都能精准找到 static 文件夹
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# 1. 首页路由：用户访问域名时，直接把 static 里的 index.html 扔给浏览器
@app.get("/")
async def read_index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"error": "index.html 不存在", "checked_path": index_file}

# 2. 挂载静态资源：CSS 和 JS 将通过 /static/xxx 访问
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# --- Dify 配置 ---
DIFY_API_KEY = os.getenv("DIFY_API_KEY")
DIFY_API_BASE = "https://api.dify.ai/v1"

class ReportRequest(BaseModel):
    companies: List[str]
    date: Optional[str] = ""
    key_words: Optional[str] = ""

async def call_dify_raw(company_name: str, date: str, key_words: str):
    payload = {
        "inputs": {"company_name": company_name, "date": date or "", "key_words": key_words or ""},
        "response_mode": "blocking",
        "user": "online-user"
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{DIFY_API_BASE}/workflows/run",
            headers={"Authorization": f"Bearer {DIFY_API_KEY}", "Content-Type": "application/json"},
            json=payload
        )
        return resp.json().get("data", {}).get("outputs", {})

@app.post("/api/generate-report")
async def generate_report(req: ReportRequest):
    if not req.companies:
        raise HTTPException(status_code=400, detail="未选择企业")
    
    tasks = [call_dify_raw(c, req.date, req.key_words) for c in req.companies]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 简单返回处理后的数据
    reports = []
    for i, res in enumerate(raw_results):
        reports.append({
            "company": req.companies[i],
            "overview": "检索已完成，请查看详情。" if not isinstance(res, Exception) else f"错误: {str(res)}",
            "items": []
        })
    return {"success": True, "reports": reports}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
