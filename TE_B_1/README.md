# CO2 Emission Prevention – Research Prototype

## Project title
CO2 Emission Prevention: Transport Emissions Comparison Prototype

## Problem statement
Help users understand how estimated CO2 emissions can differ between car, bus, and train travel for the same distance.

## Objectives
- Calculate illustrative per-passenger travel emissions from distance.
- Compare three transport options.
- Display an ASCII bar chart and potential savings against car travel.
- Provide documented, reproducible Python execution and tests.

## Install
Requires Python 3.9 or later; no third-party packages. Clone the GitHub repository and enter this student folder.

## Run
`python src/main.py`
Enter `10` when asked for distance in km.

## Test
`python -m unittest discover -s tests -v`

## Data
`data/emission_factors.csv` contains instructional example factors in kg CO2 per passenger-km. They are **not authoritative values** and should be replaced with sourced, region-specific values for actual research use.

## Version history
- V1.0: working car estimate
- V1.1: factor CSV and CSV loading (preprocessing)
- V1.2: input validation, multiple modes and comparison
- V1.3: CLI visualization
- V2.0: tests, sample results and full technical documentation

## Technical documentation
Read `docs/TECHNICAL_DOCUMENTATION.md` for architecture, methodology, limitations, references, and reproducibility instructions.
