import pandas as pd

# Dataset path
DATA_PATH = "data/creditcard.csv"

# Load dataset
df = pd.read_csv(DATA_PATH)

# Basic information
print("Dataset shape:", df.shape)

print("\nColumn names:")
print(df.columns.tolist())

# Missing values
print("\nMissing values:")
print(df.isnull().sum().sum())

# Class distribution
print("\nClass distribution:")
print(df["Class"].value_counts())

# Class percentages
print("\nClass percentage:")
print(df["Class"].value_counts(normalize=True) * 100)

# First five rows
print("\nFirst five rows:")
print(df.head())