\# Class-Imbalance and Cross-Dataset Generalization Aware Skin Disease Research Prototype



A reproducible machine-learning prototype developed as part of the Research Methodology project on AI-based skin disease classification.



> \*\*Current implementation note:\*\*  

> The original research proposal is focused on multi-class skin disease classification from clinical/dermoscopic images using deep learning and cross-dataset evaluation. The dataset currently available for implementation is a tabular dermatological-sign dataset rather than an image dataset. Therefore, this repository implements a re-scoped MVP that predicts the presence of the dermatological sign \*\*Plaque\*\* from other recorded skin signs. CNN-based image classification and cross-dataset image evaluation are identified as future extensions rather than being falsely represented as implemented components.



\---



\## 1. Project Overview



Skin disease classification is an important research area in medical artificial intelligence. Existing research has demonstrated strong performance using CNNs, transfer learning, and other machine-learning techniques, but several practical issues remain:



\- Class imbalance can cause models to favour majority classes.

\- Models trained on one dataset may not generalize well to another dataset.

\- Overall accuracy may hide poor performance on individual classes.

\- Different image acquisition conditions can affect model performance.

\- Dataset artefacts and biases may influence learned patterns.

\- High-performing models can be computationally expensive.

\- AI-generated summaries and claims about research papers require verification against the original publications.



These issues motivated the research problem investigated across the research-methodology experiments.



The current software prototype focuses on building a \*\*reproducible tabular classification pipeline\*\* using dermatological signs available in the provided CSV dataset.



\---



\# 2. Research Background



\## 2.1 Experiment 1 — Research Problem Identification



The initial research investigation examined several problems in AI-based skin disease detection, including:



1\. Inter-observer variability in dermatological diagnosis.

2\. Dataset bias and class imbalance.

3\. Visual similarity between different skin conditions.

4\. Poor cross-dataset generalization.

5\. Image-quality and acquisition artefacts.



The selected research direction was:



\*\*"Class-Imbalance and Cross-Dataset Generalization Aware Deep Learning Framework for Multi-Class Skin Disease Classification Using Clinical and Dermoscopic Image Datasets."\*\*



The original proposed system was intended to investigate whether a model trained on one skin-disease dataset would maintain its performance when evaluated on another dataset.



\---



\# 3. Literature Review and Research Gap



\## 3.1 Experiment 2 — Literature Survey



The literature review examined existing machine-learning and deep-learning approaches for skin disease classification.



Common approaches identified in the literature included:



\- CNNs

\- ResNet

\- DenseNet

\- Xception

\- EfficientNet

\- Vision transformers

\- SVM

\- Random Forest

\- Logistic Regression

\- Transfer learning



Common evaluation metrics included:



\- Accuracy

\- Precision

\- Recall

\- F1-score

\- ROC-AUC

\- Confusion matrix



The literature review identified several important research gaps:



\### Class imbalance



Many datasets contain unequal numbers of samples across disease classes. A model can therefore appear accurate while performing poorly on minority classes.



\### Cross-dataset generalization



Many studies evaluate models using a train/test split from the same dataset. This does not necessarily show how well a model transfers to images collected under different conditions.



\### Image-quality variation



Differences in illumination, resolution, acquisition devices, and image artefacts can influence model performance.



\### Interpretability



Predictions without sufficient explanation may be difficult to interpret in clinical research settings.



\### Computational efficiency



Large CNN and transformer models can require significant computational resources.



These observations were used to formulate the proposed methodology.



\---



\# 4. AI-Assisted Research and Verification



\## 4.1 Experiment 3 — Responsible Use of Generative AI



Generative AI tools were used during the research process for:



\- Literature exploration

\- Research-paper analysis

\- Methodology understanding

\- Research-gap identification

\- Objective formulation

\- Comparison of reported models and metrics



However, Experiment 3 also demonstrated that AI systems can generate unsupported information.



One example involved an incorrectly generated model description combining the term "Bullous" with the Xception architecture. The claim was checked against the original research paper and found to be incorrect.



This established an important research principle used throughout this project:



> \*\*AI-generated information is treated as preliminary assistance and is verified against original sources before being used as a research claim.\*\*



This repository therefore documents implemented results separately from the original proposed research direction.



\---



\# 5. Proposed Methodology



\## 5.1 Experiment 4 — Research Design



The original proposed methodology was based on the following workflow:



```text

Data Collection

&#x20;     ↓

Data Preprocessing

&#x20;     ↓

Feature / Representation Preparation

&#x20;     ↓

Model Development

&#x20;     ↓

Training

&#x20;     ↓

Testing

&#x20;     ↓

Prediction

&#x20;     ↓

Performance Evaluation

&#x20;     ↓

Error Analysis

&#x20;     ↓

Cross-Dataset Evaluation

```



The original image-based methodology proposed:



\- CNN-based image classification

\- ResNet/DenseNet as baseline architectures

\- Class weighting, oversampling, or targeted augmentation for imbalance

\- Rotation/flipping and controlled image augmentation

\- Cross-dataset testing

\- Confusion-matrix-based error analysis



The current MVP uses the same general research structure but applies it to the available tabular dataset.



\---



\# 6. Current MVP Scope



The available implementation dataset is:



```text

skin\_signs.csv

```



It contains \*\*3,690 rows and 51 columns\*\*.



The dataset contains binary dermatological signs such as:



\- Vesicle

\- Papule

\- Macule

\- Plaque

\- Abscess

\- Pustule

\- Bulla

\- Patch

\- Nodule

\- Ulcer

\- Crust

\- Erosion

\- Excoriation

\- Atrophy

\- Exudate

\- Purpura/Petechiae

\- Fissure

\- Induration

\- Xerosis

\- Telangiectasia

\- Scale

\- Scar

\- Sclerosis

\- Pigmented

\- Cyst

\- and other dermatological signs.



The current prediction target is:



```text

Plaque

```



The task is therefore:



> Predict whether the dermatological sign \*\*Plaque\*\* is present or absent based on the other recorded dermatological signs.



This is a \*\*binary tabular classification problem\*\*.



It is not currently a multi-class image classification system.



\---



\# 7. Data Preprocessing



The preprocessing pipeline is implemented in:



```text

src/preprocess.py

```



The pipeline performs the following operations:



\### 1. Load configuration



The project reads settings from:



```text

config.yaml

```



\### 2. Load the CSV dataset



The dataset is loaded using pandas.



\### 3. Remove unnecessary index columns



Columns such as:



```text

Unnamed: 0

```



are removed.



\### 4. Remove duplicate records



Duplicate rows are removed before model training.



\### 5. Remove unsuitable records



Rows marked using:



```text

Do not consider this image

```



are excluded.



\### 6. Separate target and input features



The target is:



```text

Plaque

```



The following are excluded from model features:



\- ImageID

\- Do not consider this image

\- Plaque



\### 7. Keep numeric features



The dermatological sign columns are represented as numeric binary features.



\### 8. Handle missing values



Missing feature values are replaced using the median of the corresponding feature.



\---



\# 8. Processed Dataset



After preprocessing:



```text

Original rows:       3690

Processed samples:   3230

Features:              47

```



The target distribution is:



```text

Plaque Present: 1967

Plaque Absent:  1263

```



This corresponds to an imbalanced binary classification problem, which is relevant to the class-imbalance motivation of the original research.



\---



\# 9. Machine Learning Models



Four models are currently compared:



\### Linear Discriminant Analysis



```text

LDA

```



\### K-Nearest Neighbours



```text

KNN

```



with:



```text

n\_neighbors = 5

```



\### Support Vector Machine



```text

SVM

```



The SVM is calibrated using:



```text

CalibratedClassifierCV

```



so that probability estimates can be used for ROC-AUC evaluation.



\### Random Forest



The Random Forest uses:



```text

n\_estimators = 200

class\_weight = balanced

```



\---



\# 10. Model Selection



The training pipeline uses:



```text

80% Training Data

20% Test Data

```



with:



```text

random\_state = 42

```



and stratification based on the target class.



The four models are compared using:



```text

5-Fold Cross-Validation

```



The primary model-selection metric is:



```text

F1-score

```



The model with the highest mean cross-validation F1-score is automatically selected.



\---



\# 11. Final Model Comparison



The final clean experiment produced the following 5-fold cross-validation results:



| Model | Mean F1-score | Standard Deviation |

|---|---:|---:|

| LDA | 0.8874 | 0.0143 |

| KNN | 0.8696 | 0.0196 |

| \*\*SVM\*\* | \*\*0.8884\*\* | \*\*0.0114\*\* |

| Random Forest | 0.8809 | 0.0186 |



The selected model was:



```text

SVM

```



because it achieved the highest mean cross-validation F1-score.



\---



\# 12. Final Test-Set Results



The selected SVM model was evaluated on the held-out test set containing:



```text

646 samples

```



Final results:



| Metric | Score |

|---|---:|

| Accuracy | \*\*89.16%\*\* |

| Precision | \*\*94.25%\*\* |

| Recall | \*\*87.53%\*\* |

| F1-score | \*\*90.77%\*\* |

| ROC-AUC | \*\*94.16%\*\* |



These values are results from the current implementation and should not be interpreted as results from the proposed CNN/image-based research framework.



\---



\# 13. Classification Report



The final test-set classification report was:



| Class | Precision | Recall | F1-score | Support |

|---|---:|---:|---:|---:|

| Plaque Absent | 0.83 | 0.92 | 0.87 | 253 |

| Plaque Present | 0.94 | 0.88 | 0.91 | 393 |



Overall:



```text

Accuracy: 0.89

Macro F1: 0.89

Weighted F1: 0.89

```



\---



\# 14. Confusion Matrix



The final confusion matrix was:



```text

\[\[232  21]

&#x20;\[ 49 344]]

```



Interpreted as:



```text

&#x20;                    Predicted

&#x20;                 Absent   Present



Actual Absent       232       21

Actual Present       49      344

```



The confusion matrix is saved automatically to:



```text

results/confusion\_matrix.png

```



\---



\# 15. Project Architecture



```text

&#x20;                   ┌─────────────────────┐

&#x20;                   │   skin\_signs.csv    │

&#x20;                   └──────────┬──────────┘

&#x20;                              │

&#x20;                              ▼

&#x20;                   ┌─────────────────────┐

&#x20;                   │    Preprocessing    │

&#x20;                   │                     │

&#x20;                   │ • Remove unwanted   │

&#x20;                   │   columns           │

&#x20;                   │ • Remove duplicates │

&#x20;                   │ • Remove unsuitable │

&#x20;                   │   records           │

&#x20;                   │ • Handle missing    │

&#x20;                   │   values            │

&#x20;                   └──────────┬──────────┘

&#x20;                              │

&#x20;                              ▼

&#x20;                   ┌─────────────────────┐

&#x20;                   │ Train/Test Split    │

&#x20;                   │       80 / 20       │

&#x20;                   └──────────┬──────────┘

&#x20;                              │

&#x20;                              ▼

&#x20;             ┌──────────────────────────────────┐

&#x20;             │       Model Comparison            │

&#x20;             │                                  │

&#x20;             │ LDA │ KNN │ SVM │ Random Forest │

&#x20;             └────────────────┬─────────────────┘

&#x20;                              │

&#x20;                              ▼

&#x20;                   ┌─────────────────────┐

&#x20;                   │  5-Fold CV F1      │

&#x20;                   └──────────┬──────────┘

&#x20;                              │

&#x20;                              ▼

&#x20;                   ┌─────────────────────┐

&#x20;                   │   Select Best Model │

&#x20;                   │        SVM          │

&#x20;                   └──────────┬──────────┘

&#x20;                              │

&#x20;                              ▼

&#x20;                   ┌─────────────────────┐

&#x20;                   │   Test Evaluation   │

&#x20;                   │                     │

&#x20;                   │ Accuracy            │

&#x20;                   │ Precision           │

&#x20;                   │ Recall              │

&#x20;                   │ F1-score            │

&#x20;                   │ ROC-AUC             │

&#x20;                   │ Confusion Matrix    │

&#x20;                   └──────────┬──────────┘

&#x20;                              │

&#x20;                              ▼

&#x20;                   ┌─────────────────────┐

&#x20;                   │ Prediction Interface│

&#x20;                   │     predict.py      │

&#x20;                   └─────────────────────┘

```



\---



\# 16. Repository Structure



```text

Research\_Prototype/

│

├── data/

│   └── skin\_signs.csv

│

├── src/

│   ├── preprocess.py

│   ├── models.py

│   ├── train.py

│   ├── evaluate.py

│   └── predict.py

│

├── tests/

│   └── test\_pipeline.py

│

├── results/

│   ├── model.joblib              # generated, ignored by Git

│   └── confusion\_matrix.png      # generated, ignored by Git

│

├── notebooks/

│

├── docs/

│

├── config.yaml

├── requirements.txt

├── pytest.ini

├── run\_all.ps1

├── .gitignore

└── README.md

```



\---



\# 17. Description of Source Files



\## `src/preprocess.py`



Responsible for:



\- Loading configuration

\- Loading the CSV dataset

\- Cleaning the dataset

\- Removing unsuitable records

\- Selecting features

\- Handling missing values

\- Returning `X` and `y`



\---



\## `src/models.py`



Contains the four candidate machine-learning models:



\- LDA

\- KNN

\- SVM

\- Random Forest



\---



\## `src/train.py`



Responsible for:



\- Loading the data

\- Preprocessing

\- Train/test splitting

\- 5-fold cross-validation

\- Comparing models

\- Selecting the best model

\- Training the selected model

\- Saving the model artifact



The trained model is saved to:



```text

results/model.joblib

```



\---



\## `src/evaluate.py`



Responsible for:



\- Loading the trained model

\- Evaluating the held-out test set

\- Calculating accuracy

\- Calculating precision

\- Calculating recall

\- Calculating F1-score

\- Calculating ROC-AUC

\- Generating the classification report

\- Generating the confusion matrix

\- Saving the confusion-matrix figure



\---



\## `src/predict.py`



Provides a simple command-line prediction interface.



Example:



```powershell

python -m src.predict --signs "Papule,Erythema,Scale"

```



Example output:



```text

Predicted Plaque: ABSENT

```



Another example:



```powershell

python -m src.predict --signs "Macule,Patch,Brown(Hyperpigmentation)"

```



The model then returns either:



```text

Predicted Plaque: PRESENT

```



or:



```text

Predicted Plaque: ABSENT

```



These predictions are model outputs and are \*\*not medical diagnoses\*\*.



\---



\# 18. Automated Testing



Automated tests are implemented using:



```text

pytest

```



The test suite verifies:



\- Configuration loading

\- Dataset loading

\- Preprocessing

\- Feature/target separation

\- Availability of all four models



Run:



```powershell

pytest

```



Current result:



```text

4 passed

```



\---



\# 19. One-Command Reproducibility



The entire training, evaluation, and testing workflow can be executed using:



```powershell

.\\run\_all.ps1

```



The script performs:



```text

1\. Train model

&#x20;      ↓

2\. Evaluate model

&#x20;      ↓

3\. Run automated tests

```



If any stage fails, the script stops and reports the failure.



The final verified run completed successfully with:



```text

Training       SUCCESS

Evaluation     SUCCESS

Tests          4 passed

Pipeline       SUCCESS

```



\---



\# 20. Installation



\## Requirements



Recommended environment:



```text

Python 3.13

```



Create a virtual environment:



```powershell

python -m venv .venv

```



Activate it:



```powershell

.\\.venv\\Scripts\\Activate.ps1

```



Install dependencies:



```powershell

pip install -r requirements.txt

```



\---



\# 21. Running the Project



\## Run the complete pipeline



```powershell

.\\run\_all.ps1

```



\## Train only



```powershell

python -m src.train

```



\## Evaluate the trained model



```powershell

python -m src.evaluate

```



\## Run tests



```powershell

pytest

```



\## Make a prediction



```powershell

python -m src.predict --signs "Papule,Erythema,Scale"

```



\---



\# 22. Configuration



The main configuration is stored in:



```text

config.yaml

```



Current configuration:



```yaml

data\_path: data/skin\_signs.csv



id\_column: ImageID



exclude\_flag\_column: "Do not consider this image"



target: Plaque



test\_size: 0.20



seed: 42



cv\_folds: 5



results\_dir: results

```



Keeping these settings outside the Python source code makes the pipeline easier to reproduce and modify.



\---



\# 23. Reproducibility



The project uses a fixed random seed:



```text

42

```



The training pipeline uses:



```text

80/20 stratified train/test split

```



and:



```text

5-fold cross-validation

```



The selected model and feature information are saved as a generated artifact.



The complete process can therefore be reproduced from the terminal using:



```powershell

.\\run\_all.ps1

```



\---



\# 24. Git Version Control



Git is used to maintain the development history of the prototype.



Current initial version:



```text

V1.0 Initial working research prototype

```



Git commit:



```text

e3718cb

```



The repository is connected to GitHub:



```text

https://github.com/vaishnavibhojak1005/Research\_Prototype

```



Generated files such as the virtual environment, trained model, cache files, and generated figures are excluded using `.gitignore`.



Future development versions will be represented by meaningful commits rather than artificially created history.



Planned development direction:



```text

V1.0  Initial working prototype

V1.1  Preprocessing improvements

V1.2  Model improvements

V1.3  Interface / visualization improvements

V2.0  Final tested prototype

```



\---



\# 25. Relationship Between Research Proposal and Current Prototype



The original research proposal focuses on:



```text

Multi-class skin disease classification

&#x20;       +

Clinical / dermoscopic images

&#x20;       +

CNN / deep learning

&#x20;       +

Class imbalance handling

&#x20;       +

Cross-dataset generalization

&#x20;       +

Confusion-matrix analysis

```



The current available dataset, however, contains structured dermatological signs rather than the required image files and disease-class labels.



Therefore, the implemented MVP currently focuses on:



```text

Dermatological signs

&#x20;       ↓

Tabular preprocessing

&#x20;       ↓

Binary Plaque classification

&#x20;       ↓

LDA / KNN / SVM / Random Forest

&#x20;       ↓

5-fold CV

&#x20;       ↓

Held-out test evaluation

&#x20;       ↓

Prediction interface

```



This distinction is intentional and documented so that experimental results are not incorrectly presented as results from the original image-based research proposal.



\---



\# 26. Current Limitations



The current prototype has several limitations.



\### 1. Tabular rather than image-based data



The available CSV contains dermatological signs and does not contain the clinical/dermoscopic image data required for CNN experimentation.



\### 2. Binary target



The current implementation predicts:



```text

Plaque Present

```



versus:



```text

Plaque Absent

```



It does not perform multi-class disease classification.



\### 3. No CNN



CNNs are part of the proposed future image-based methodology but are not implemented in the current MVP because image data is unavailable.



\### 4. No cross-dataset experiment



A second independent image dataset is not currently available in the implementation environment.



Therefore, cross-dataset generalization cannot honestly be reported from this version.



\### 5. No clinical diagnosis



The model is a research prototype and is not a medical diagnostic system.



\### 6. Limited interpretability



The current implementation does not provide clinical explanations or visual explanation techniques such as Grad-CAM.



\---



\# 27. Future Scope



If suitable clinical/dermoscopic image datasets become available, the prototype can be extended to the original research direction.



Possible extensions include:



1\. Add image preprocessing.

2\. Implement CNN-based classification.

3\. Add ResNet/DenseNet baselines.

4\. Add transfer learning.

5\. Implement class weighting.

6\. Implement oversampling or targeted augmentation.

7\. Compare imbalanced versus imbalance-aware training.

8\. Perform multi-class disease classification.

9\. Train on one dataset and evaluate on another.

10\. Analyse the cross-dataset performance gap.

11\. Perform per-class confusion analysis.

12\. Investigate performance across available skin-tone groups where reliable metadata exists.

13\. Investigate image artefacts such as hair, rulers, markings, lighting, and resolution.

14\. Add explainable-AI methods such as Grad-CAM or SHAP where technically appropriate.

15\. Evaluate computational efficiency.

16\. Extend the reproducible pipeline for larger datasets.



\---



\# 28. Research Ethics and Responsible AI



This project is an academic research prototype.



The system should not be interpreted as a medical diagnostic tool.



Important principles include:



\- Verify research claims against original publications.

\- Do not treat AI-generated information as automatically correct.

\- Document dataset limitations.

\- Report class-wise performance instead of relying only on accuracy.

\- Clearly distinguish implemented experiments from proposed future work.

\- Avoid presenting prototype predictions as clinical diagnoses.

\- Consider dataset bias and representation limitations when interpreting results.



\---



\# 29. Technologies Used



\### Programming



\- Python 3.13



\### Data Processing



\- pandas

\- NumPy



\### Machine Learning



\- scikit-learn

\- SciPy



\### Evaluation and Visualization



\- Matplotlib

\- Seaborn



\### Model Persistence



\- joblib



\### Configuration



\- PyYAML



\### Testing



\- pytest



\### Version Control



\- Git

\- GitHub



\### Research Assistance



\- ChatGPT

\- Scholarly databases and research sources used during the research methodology experiments



\---



\# 30. Conclusion



This repository provides a reproducible machine-learning MVP developed from the research problem identified during the research-methodology experiments.



The original research direction investigates class imbalance and cross-dataset generalization in deep-learning-based skin disease classification. The currently available dataset does not contain the required image data, so the implemented prototype uses structured dermatological signs to develop and validate a binary Plaque classification pipeline.



The final implementation:



\- preprocesses the dataset,

\- compares four machine-learning models,

\- uses 5-fold cross-validation,

\- automatically selects the best model,

\- evaluates the model on a held-out test set,

\- generates a confusion matrix,

\- provides a command-line prediction interface,

\- includes automated tests,

\- and can be reproduced using a single PowerShell command.



The current best model is an SVM with a test-set F1-score of \*\*90.77%\*\* and ROC-AUC of \*\*94.16%\*\*.



The implementation should be considered a \*\*working research MVP\*\*, while the CNN-based multi-class and cross-dataset image experiments remain future extensions requiring appropriate image datasets.



\---



\## Author



\*\*Vaishnavi Bhojak\*\*



Research Methodology Project



Academic Year: 2026–2027

