# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse  # 用于返回 index.html
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

# 核心修改：让访问根域名时直接打开你的 HTML 页面
@app.get("/")
async def read_index():
    # 确保你的 HTML 文件在 static 文件夹内
    return FileResponse('static/index.html')

# 挂载静态资源（CSS, JS）
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

DIFY_API_KEY = os.getenv("DIFY_API_KEY")
DIFY_API_BASE = "https://api.dify.ai/v1"

class ReportRequest(BaseModel):
    companies: List[str]
    date: Optional[str] = ""
    key_words: Optional[str] = ""

# ---------- 解析与格式化工具 ----------
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
    except Exception as e:
        return {"company": company_default, "overview": "内容解析异常", "items": [], "sources": []}

    formatted_sources = []
    source_list = data.get("sources", [])
    if not source_list:
        for item in data.get("items", []):
            if "sources" in item:
                source_list.extend(item["sources"])

    seen_urls = set()
    for s in source_list:
        url = s.get("url", "")
        if url and url not in seen_urls:
            formatted_sources.append({
                "id": len(formatted_sources) + 1,
                "title": s.get("title", "参考资料"),
                "url": url
            })
            seen_urls.add(url)

    return {
        "company": data.get("company", company_default),
        "overview": data.get("overview", "暂无概览"),
        "items": data.get("items", []),
        "formatted_sources": formatted_sources
    }

# ---------- API 接口 ----------
@app.post("/api/generate-report")
async def generate_report(req: ReportRequest):
    if not req.companies:
        raise HTTPException(status_code=400, detail="至少选择一个企业")

    tasks = [call_dify_raw(c, req.date, req.key_words) for c in req.companies]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    final_reports = []
    for i, res in enumerate(raw_results):
        company_name = req.companies[i]
        if isinstance(res, Exception):
            final_reports.append({
                "company": company_name,
                "overview": f"搜索服务异常: {str(res)}",
                "items": [],
                "formatted_sources": []
            })
        else:
            formatted = parse_dify_to_standard_format(res, company_name)
            final_reports.append(formatted)

    return {"success": True, "reports": final_reports}

async def call_dify_raw(company_name: str, date: str, key_words: str):
    payload = {
        "inputs": {"company_name": company_name, "date": date or "", "key_words": key_words or ""},
        "response_mode": "blocking",
        "user": f"user-{company_name}"
    }
    async with httpx.AsyncClient(timeout=120.0, verify=False) as client:
        resp = await client.post(
            f"{DIFY_API_BASE}/workflows/run",
            headers={"Authorization": f"Bearer {DIFY_API_KEY}", "Content-Type": "application/json"},
            json=payload
        )
        if resp.status_code != 200:
            raise Exception(f"Dify Error {resp.status_code}")
        return resp.json().get("data", {}).get("outputs", {})

@app.get("/api/companies")
async def get_companies():
    return {"companies": ["阿里巴巴", "腾讯", "字节跳动", "美团", "京东", "百度", "拼多多", "小米"]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
