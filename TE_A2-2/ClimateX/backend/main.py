from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import dataset, historical, anomaly, ml, prediction, scenarios, future

app = FastAPI(title="ClimateX API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dataset.router, prefix="/api")
app.include_router(historical.router, prefix="/api")
app.include_router(anomaly.router, prefix="/api")
app.include_router(ml.router, prefix="/api")
app.include_router(prediction.router, prefix="/api")
app.include_router(scenarios.router, prefix="/api")
app.include_router(future.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "ClimateX API is running"}
