"""Shared wording. The dashboard and the PDF both import from here so the
definitions, caveats and terminology cannot drift apart."""

PROXY_LABEL_NAME = "inactivity-based rug-pull proxy label"

PROXY_STATEMENT = (
    "The positive class is an inactivity-based proxy derived from SolRPDS, "
    "not an independently verified rug-pull ground truth."
)

SCORE_TERM = "model risk score"
SCORE_NOTE = (
    "Scores are uncalibrated model probabilities: no calibration map was fitted, "
    "so a score of 0.80 does not mean an 80% chance of anything. They are useful for "
    "ranking within one model and are not comparable across datasets."
)
ABOVE = "Model-indicated risk: ABOVE decision threshold"
BELOW = "Model-indicated risk: BELOW decision threshold"

SHAP_STATEMENT = (
    "SHAP values describe how the trained model's output depends on its inputs. They are "
    "associative explanations of the model, not causal claims about why an address, "
    "transaction or pool is risky."
)

ZERO_ACTIVITY_NOTE = (
    "Addresses with zero observed on-chain transactions are marked report-only / no observed "
    "on-chain activity. In the Full BTC model a classifier can learn that 'no observed activity "
    "= criminal', which is a property of how the dataset was assembled and not a behavioural "
    "fraud signal. The activity-filtered BTC model is the headline BTC result."
)

SEPARATE_MODELS_NOTE = (
    "Each dataset has its own model. Datasets are never merged, scores from different models "
    "are not comparable, and no cross-dataset generalisation is claimed."
)

LIMITATIONS_TITLE = "Label Definitions, Limitations, and Threats to Validity"

LIMITATIONS = [
    ("SolRPDS: proxy-label limitation",
     "SolRPDS provides no independently verified rug-pull label. The target used here is "
     "y = (INACTIVITY_STATUS == 'Inactive'), called the " + PROXY_LABEL_NAME + ". "
     + PROXY_STATEMENT + " A pool can be inactive for benign reasons (abandoned project, "
     "migration, low interest) and a fraudulent pool can still be recorded as active. Because the "
     "inactivity status is probably derived from activity timestamps, LAST_SWAP_TIMESTAMP, "
     "LAST_SWAP_TX_ID and every feature derived from them are excluded from the primary model. "
     "The ablation model adds timestamp-derived duration features and is reported separately "
     "because those features may define or strongly determine the outcome."),
    ("Real-CATS: report-only address bias",
     "Many criminal Bitcoin addresses have zero observed on-chain transactions and therefore no "
     "timestamps, whereas very few benign addresses do. " + ZERO_ACTIVITY_NOTE + " Undated "
     "zero-activity addresses cannot be placed on a chronological split. They are kept only in the "
     "Full BTC model, as training-only rows, and are scored separately as report-only diagnostics. "
     "They are excluded from the activity-filtered BTC model and from the ETH model. "
     "Full and activity-filtered metrics are reported separately and never averaged."),
    ("Real-CATS: whole-history feature aggregation",
     "Real-CATS features summarise each address's entire observed history (totals, variances, "
     "lifetime, activity counts). A split by first_time orders addresses by when they first appeared, "
     "but a feature vector can still include behaviour that happened after the split date. "
     "Chronological splitting therefore reduces, but does not eliminate, temporal leakage. "
     "Class mix may also differ across periods, so each split's class counts are reported."),
    ("Elliptic: temporal distribution shift",
     "Transaction behaviour and illicit activity patterns change over time, so a model trained on "
     "time steps 1-29 and tuned on 30-34 may degrade on steps 35-49. This is why validation and test "
     "metrics are both reported together with their gap. The unknown class (unlabelled transactions) is "
     "not treated as licit and is excluded from training, validation and testing; "
     "it is used only for descriptive graph and trend statistics."),
    ("Why the models are separate",
     "The four datasets describe different entities (Solana pools, Bitcoin addresses, Ethereum "
     "addresses, Bitcoin transactions), use different feature spaces, label definitions and time "
     "ranges, and are not merged. " + SEPARATE_MODELS_NOTE),
    ("Why scores are not comparable across datasets",
     "A model risk score is a function of one model, one feature space and one class balance. "
     "Class prevalence in each dataset reflects how it was collected, not real-world base rates, and "
     "the scores are uncalibrated. A score of 0.9 from one model therefore means nothing "
     "relative to a 0.9 from another."),
    ("Why SHAP is associative, not causal",
     SHAP_STATEMENT + " Correlated features share credit, and features that are artefacts of "
     "dataset construction can appear important. Importance rankings should be read together with the "
     "leakage controls described above."),
    ("General threats to validity",
     "Labels come from dataset curators and carry their own errors. Hyper-parameters are fixed defaults "
     "and were not tuned on the test split. The validation split is used for early stopping and "
     "threshold selection, so validation metrics are optimistic relative to test metrics. "
     "Results describe these datasets and split rules only."),
]
