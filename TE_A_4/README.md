\# Imbalance-Aware Machine Learning Framework for Credit Card Fraud Detection



\## Problem Statement



Credit card fraud detection is a highly imbalanced binary classification problem.

Fraudulent transactions represent a very small proportion of all transactions.

Therefore, accuracy alone is not sufficient for evaluating the model.



\## Objectives



\- Handle severe class imbalance using SMOTE.

\- Prevent data leakage through train-only preprocessing.

\- Compare Logistic Regression, Decision Tree and Random Forest.

\- Compare models with and without SMOTE.

\- Evaluate using Precision, Recall, F1-score and PR-AUC.

\- Select the best model programmatically.

\- Perform classification threshold analysis.

\- Provide a reproducible command-line prediction interface.



\## Dataset



Kaggle Credit Card Fraud Detection dataset.



The dataset contains:



\- 284,807 transactions

\- 30 input features

\- 1 target feature (`Class`)

\- 492 fraudulent transactions



The dataset is not included in the repository.



Download `creditcard.csv` and place it inside:



data/creditcard.csv



\## Technologies



\- Python

\- pandas

\- NumPy

\- scikit-learn

\- imbalanced-learn

\- matplotlib

\- joblib

\- pytest

\- Git

\- GitHub



\## Project Structure



Research\_Prototype/

├── data/

├── src/

├── notebooks/

├── results/

├── docs/

├── tests/

├── README.md

├── requirements.txt

└── .gitignore



\## Installation



```bash

py -m pip install -r requirements.txt

