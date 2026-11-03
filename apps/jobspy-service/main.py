import os
import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("jobspy-service")

app = FastAPI(title="JobSpy Microservice", version="1.0.0")

class SearchRequest(BaseModel):
    site_names: List[str] = Field(default=["indeed", "linkedin", "glassdoor"])
    search_term: str = Field(default="Software Engineer Fresher")
    location: str = Field(default="India")
    results_wanted: int = Field(default=15, ge=1, le=50)
    hours_old: int = Field(default=48, ge=1, le=168)
    country_indeed: str = Field(default="India")
    is_remote: Optional[bool] = None

class JobItem(BaseModel):
    id: Optional[str] = None
    title: str
    company: str
    location: Optional[str] = None
    job_url: str
    is_remote: Optional[bool] = False
    description: Optional[str] = None
    date_posted: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    currency: Optional[str] = None

class SearchResponse(BaseModel):
    success: bool
    count: int
    jobs: List[JobItem]
    error: Optional[str] = None

@app.get("/health")
def health():
    return {"status": "ok", "service": "jobspy-service", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.post("/search", response_model=SearchResponse)
def search_jobs(req: SearchRequest):
    logger.info(f"Incoming search: query='{req.search_term}', location='{req.location}', hours_old={req.hours_old}")
    
    try:
        from jobspy import scrape_jobs
        
        jobs_df = scrape_jobs(
            site_name=req.site_names,
            search_term=req.search_term,
            location=req.location,
            results_wanted=req.results_wanted,
            hours_old=req.hours_old,
            country_indeed=req.country_indeed,
            is_remote=req.is_remote if req.is_remote is not None else False
        )
        
        if jobs_df is None or jobs_df.empty:
            logger.info("No jobs returned from scrape_jobs.")
            return SearchResponse(success=True, count=0, jobs=[])
            
        jobs_list: List[JobItem] = []
        for _, row in jobs_df.iterrows():
            job_url = str(row.get("job_url") or row.get("job_url_direct") or "").strip()
            if not job_url:
                continue
                
            title = str(row.get("title") or "Unknown Role").strip()
            company = str(row.get("company") or "Unknown Company").strip()
            location = str(row.get("location") or req.location).strip()
            
            job_item = JobItem(
                id=str(row.get("id") or ""),
                title=title,
                company=company,
                location=location,
                job_url=job_url,
                is_remote=bool(row.get("is_remote")),
                description=str(row.get("description") or "")[:2000],
                date_posted=str(row.get("date_posted") or ""),
                min_amount=float(row.get("min_amount")) if row.get("min_amount") is not None and str(row.get("min_amount")).replace('.', '', 1).isdigit() else None,
                max_amount=float(row.get("max_amount")) if row.get("max_amount") is not None and str(row.get("max_amount")).replace('.', '', 1).isdigit() else None,
                currency=str(row.get("currency") or "INR")
            )
            jobs_list.append(job_item)
            
        logger.info(f"Scraped {len(jobs_list)} jobs successfully.")
        return SearchResponse(success=True, count=len(jobs_list), jobs=jobs_list)
        
    except Exception as e:
        logger.error(f"Error scraping jobs with JobSpy: {str(e)}", exc_info=True)
        return SearchResponse(success=False, count=0, jobs=[], error=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
