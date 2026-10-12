from sklearn.calibration import CalibratedClassifierCV
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.ensemble import RandomForestClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC


def get_models(seed=42):
    return {
        "LDA": LinearDiscriminantAnalysis(),

        "KNN": KNeighborsClassifier(
            n_neighbors=5
        ),

        "SVM": CalibratedClassifierCV(
            SVC(random_state=seed),
            ensemble=False
        ),

        "Random Forest": RandomForestClassifier(
            n_estimators=200,
            random_state=seed,
            class_weight="balanced"
        ),
    }