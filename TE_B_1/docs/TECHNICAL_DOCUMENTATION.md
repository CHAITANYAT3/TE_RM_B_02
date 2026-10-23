# Experiment 7: Technical Documentation

## Project title
CO2 Emission Prevention – Transport Emissions Comparison Prototype

## Problem statement
Individuals may not understand the difference in estimated per-passenger travel CO2 between transport choices. This prototype illustrates such a comparison for one entered distance.

## Objectives
Build a small MVP, track 5 versions with Git, compare modes, visualize results, document how to reproduce results, and demonstrate automated tests.

## System requirements
Windows/macOS/Linux; Python 3.9+; Git; optional VS Code; terminal.

## Technologies used
Python standard library (csv, pathlib, math, unittest), CSV, Git, GitHub, Markdown.

## System architecture
User distance input -> validation -> read CSV factors -> calculate by mode -> compare emissions -> ASCII chart in terminal.

## Methodology
1. Take a positive finite distance in km.
2. Read illustrative per-passenger emission factors from a CSV file.
3. Multiply distance by each mode factor (kg CO2 per passenger-km).
4. Report estimated kg CO2 per passenger for each mode and the difference from car to the lowest estimated mode.
5. Print a scaled text bar chart.

## Installation instructions
Clone the class repository fork, change directory to this student folder, and use Python 3.9+. The requirements.txt states that no external dependencies are required.

## Execution instructions
Run `python src/main.py` in this folder and enter `10` at the prompt. Run `python -m unittest discover -s tests -v` to check the implementation.

## Input/output description
Input: travel distance in km, e.g. 10. Output: car 1.920 kg, bus 0.820 kg, train 0.410 kg CO2, and a difference of 1.510 kg comparing train to car in this instructional example.

## Results
For the sample input, results match the formula and documented CSV factors. See `results/sample_run.txt`. These are calculated example figures, not research findings about actual transport fleets.

## Limitations
Illustrative factors have no cited empirical source. The method does not account for real occupancy, vehicle characteristics, electricity-generation mix, road congestion, lifecycle boundaries, geographic variation, or uncertainty. Not a trained predictive machine-learning model.

## Future scope
Use independently sourced regional factors; add data provenance, uncertainty bands, trip segmentation, and real datasets; optionally build a dashboard.

## References
1. A.P. Shah Institute of Technology, Research Methodology Lab, Experiment 7 instruction handout (2026–27).
2. Internal `data/emission_factors.csv` sample data created for classroom demonstration (not an external factual reference).

## Reproducibility statement
Using the supplied CSV, the documented command, and Python 3.9+, another user can reproduce the same sample calculations and run the tests. Commit history and version tags record development changes.
