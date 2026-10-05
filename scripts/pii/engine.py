"""The Fold's PII analyzer: Presidio's recognizers + a spaCy pipeline, plus three recognizers for what informal, lowercase
typing needs (a proper-noun TAG without an NER head, handles and nicks, street addresses). No word lists: every judgement
here is a trained model's or a pattern's. Used by server.py (the page's local door) and measure.py (the eval)."""
from presidio_analyzer import AnalyzerEngine, EntityRecognizer, RecognizerResult, Pattern, PatternRecognizer
from presidio_analyzer.nlp_engine import NlpEngineProvider


class PropnRecognizer(EntityRecognizer):
    """A token the tagger reads as a proper noun even where its NER head stays silent — lowercase, SMS-style and nick names."""
    def __init__(self):
        super().__init__(supported_entities=["NAME_CANDIDATE"], supported_language="en", name="propn")

    def load(self):
        pass

    def analyze(self, text, entities, nlp_artifacts=None):
        out = []
        for t in (nlp_artifacts.tokens if nlp_artifacts else []):
            if t.pos_ == "PROPN" and len(t.text) >= 3 and any(ch.isalpha() for ch in t.text) and not t.like_url and not t.like_email:
                out.append(RecognizerResult("NAME_CANDIDATE", t.idx, t.idx + len(t.text), 0.5, recognition_metadata={"recognizer_name": "propn"}))
        return out


def build(model="en_core_web_lg"):
    nlp = NlpEngineProvider(nlp_configuration={"nlp_engine_name": "spacy", "models": [{"lang_code": "en", "model_name": model}]}).create_engine()
    eng = AnalyzerEngine(nlp_engine=nlp, supported_languages=["en"])
    eng.registry.add_recognizer(PropnRecognizer())
    eng.registry.add_recognizer(PatternRecognizer("HANDLE", patterns=[
        Pattern("at", r"@[A-Za-z0-9_.]{2,}", 0.8), Pattern("nick", r"\b[A-Za-z]{4,}_?\d{2,}\b", 0.6), Pattern("snake", r"\b[A-Za-z]+_\d{2,}\b", 0.6)]))
    eng.registry.add_recognizer(PatternRecognizer("ADDRESS", patterns=[
        Pattern("street", r"\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,2}(?:st|street|ave|avenue|rd|road|blvd|lane|ln|dr|drive|way|ct|court)\b", 0.7)]))
    return eng
