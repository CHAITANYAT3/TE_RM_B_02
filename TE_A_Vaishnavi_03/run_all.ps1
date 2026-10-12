Write-Host "========================================"
Write-Host "Research Prototype"
Write-Host "========================================"

Write-Host ""
Write-Host "Training model..."
python -m src.train

if ($LASTEXITCODE -ne 0) {
    Write-Host "Training failed."
    exit 1
}

Write-Host ""
Write-Host "Evaluating model..."
python -m src.evaluate

if ($LASTEXITCODE -ne 0) {
    Write-Host "Evaluation failed."
    exit 1
}

Write-Host ""
Write-Host "Running tests..."
pytest

if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests failed."
    exit 1
}

Write-Host ""
Write-Host "========================================"
Write-Host "All steps completed successfully."
Write-Host "========================================"