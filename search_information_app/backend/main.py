# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import httpx
import os
import json
import asyncio
import re
from dotenv import load_dotenv
from typing import List, Optional

load_dotenv()

app = FastAPI(title="企业资讯搜索系统", version="4.0.0")

# ---------- CORS 配置 ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 路径兼容处理：获取 static 文件夹的绝对路径 ---
# 无论是在本地还是 Render，这段代码都能找到 main.py 旁边的 static 文件夹
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# 根路径返回 index.html
@app.get("/")
async def read_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "index.html not found", "path": index_path}

# 挂载静态资源（必须在 @app.get("/") 之后）
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

DIFY_API_KEY = os.getenv("DIFY_API_KEY")
DIFY_API_BASE = "https://api.dify.ai/v1"

class ReportRequest(BaseModel):
    companies: List[str]
    date: Optional[str] = ""
    key_words: Optional[str] = ""

def parse_dify_to_standard_format(raw_output: dict, company_default: str) -> dict:
    content_str = ""
    if "text1" in raw_output:
        content_str = raw_output["text1"]
    elif "text" in raw_output:
        content_str = raw_output["text"]
    elif isinstance(raw_output, dict) and "overview" in raw_output:
        return raw_output
    else:
        content_str = str(raw_output)

    try:
        if isinstance(content_str, str):
            clean_str = re.sub(r'```json\s*|```', '', content_str).strip()
            data = json.loads(clean_str)
        else:
            data = raw_output
    except:
        return {"company": company_default, "overview": "内容解析异常", "items": [], "sources": []}

    formatted_sources = []
    source_list = data.get("sources", [])
    seen_urls = set()
    for s in source_list:
        url = s.get("url", "")
        if url and url not in seen_urls:
            formatted_sources.append({"id": len(formatted_sources) + 1, "title": s.get("title", "参考资料"), "url": url})
            seen_urls.add(url)

    return {
        "company": data.get("company", company_default),
        "overview": data.get("overview", "暂无概览"),
        "items": data.get("items", []),
        "formatted_sources": formatted_sources
    }

@app.post("/api/generate-report")
async def generate_report(req: ReportRequest):
    if not req.companies:
        raise HTTPException(status_code=400, detail="未选择企业")
    tasks = [call_dify_raw(c, req.date, req.key_words) for c in req.companies]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)
    final_reports = []
    for i, res in enumerate(raw_results):
        company_name = req.companies[i]
        if isinstance(res, Exception):
            final_reports.append({"company": company_name, "overview": f"错误: {str(res)}", "items": [], "formatted_sources": []})
        else:
            final_reports.append(parse_dify_to_standard_format(res, company_name))
    return {"success": True, "reports": final_reports}

async def call_dify_raw(company_name: str, date: str, key_words: str):
    payload = {
        "inputs": {"company_name": company_name, "date": date or "", "key_words": key_words or ""},
        "response_mode": "blocking",
        "user": "web-user"
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{DIFY_API_BASE}/workflows/run",
            headers={"Authorization": f"Bearer {DIFY_API_KEY}", "Content-Type": "application/json"},
            json=payload
        )
        return resp.json().get("data", {}).get("outputs", {})

@app.get("/api/companies")
async def get_companies():
    return {"companies": ["阿里巴巴", "腾讯", "字节跳动", "美团", "京东", "百度"]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
