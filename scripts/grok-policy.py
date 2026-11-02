#!/usr/bin/env python3
"""Fail when an xAI chat model can compact at or past the 200k price cliff.

The checker does not send a provider request. A blocked send prototype counts
network calls and must stay at 0.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

LONG_CONTEXT = 200_000
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "config.yml"


def parse_entry(value):
    """Return fixed, percent, or base. None clears a lower layer."""
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError(f"bad threshold {value!r}")
    if isinstance(value, (int, float)):
        if value != int(value) or value <= 0:
            raise ValueError(f"bad threshold {value!r}")
        return ("base", int(value))
    text = str(value).strip()
    if text.lower() == "null":
        return None
    fixed = re.fullmatch(r"f(\d+)", text)
    if fixed:
        count = int(fixed.group(1))
        if count <= 0:
            raise ValueError(f"bad threshold {value!r}")
        return ("fixed", count)
    percent = re.fullmatch(r"(\d+(?:\.\d+)?)%", text)
    if percent:
        number = float(percent.group(1))
        if not 0 < number <= 100:
            raise ValueError(f"bad threshold {value!r}")
        return ("percent", number)
    if re.fullmatch(r"\d+", text):
        return ("base", int(text))
    raise ValueError(f"bad threshold {value!r}")


def match_key(selector, thresholds):
    """Exact provider/model key, else the longest *-terminated prefix."""
    if selector in thresholds and thresholds[selector] is not None:
        return selector
    best = None
    for key, value in thresholds.items():
        if value is None or not key.endswith("*"):
            continue
        prefix = key[:-1]
        if selector.startswith(prefix) and (best is None or len(prefix) > len(best[:-1])):
            best = key
    return best


def trigger_tokens(entry, context_window, threshold_percent):
    """Resolve one entry to a token trigger.

    A bare number is a window base. With thresholdPercent set, the trigger is
    that percent of the base. With no percent, the trigger is the base minus
    the default reserve: max(16384, 15% of the base). fN is exact. N% scales
    the real context window.
    """
    kind, number = entry
    if kind == "fixed":
        return number
    if kind == "percent":
        return int(context_window * number / 100)
    if threshold_percent is not None:
        return int(number * threshold_percent / 100)
    reserve = max(16384, int(number * 0.15))
    return number - reserve


def load_thresholds(path):
    text = Path(path).read_text()
    try:
        import yaml
    except ImportError:
        return _thresholds_without_yaml(text), None
    document = yaml.safe_load(text) or {}
    compaction = document.get("compaction") or {}
    raw = compaction.get("modelThresholds") or {}
    parsed = {}
    for key, value in raw.items():
        parsed[str(key)] = parse_entry(value)
    percent = compaction.get("thresholdPercent")
    return parsed, percent


def _thresholds_without_yaml(text):
    """Read only the compaction.modelThresholds map. Enough for this repo file."""
    lines = text.splitlines()
    start = None
    for index, line in enumerate(lines):
        if line.strip() == "modelThresholds:":
            start = index + 1
            break
    if start is None:
        return {}
    parsed = {}
    for line in lines[start:]:
        if line and not line.startswith((" ", "\t")):
            break
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if ":" not in stripped:
            break
        key, value = stripped.split(":", 1)
        key = key.strip().strip("\"'")
        value = value.split("#", 1)[0].strip().strip("\"'")
        parsed[key] = parse_entry(value)
    return parsed


def violations_for(models, thresholds, threshold_percent=None):
    found = []
    for model in models:
        provider = model.get("provider", "")
        if model.get("kind") != "chat" or not provider.startswith("xai"):
            continue
        selector = model.get("selector") or f"{provider}/{model.get('id')}"
        key = match_key(selector, thresholds)
        if key is None:
            found.append({
                "selector": selector,
                "reason": "no matching key",
                "trigger": None,
            })
            continue
        trigger = trigger_tokens(
            thresholds[key],
            int(model.get("contextWindow") or 0),
            threshold_percent,
        )
        if trigger >= LONG_CONTEXT:
            found.append({
                "selector": selector,
                "reason": f"trigger {trigger} >= {LONG_CONTEXT}",
                "trigger": trigger,
                "key": key,
            })
    return found


def send_or_block(estimated_tokens, transport):
    """Block at the inclusive 200k cliff. A block must not call transport."""
    if estimated_tokens >= LONG_CONTEXT:
        return {"blocked": True, "network_calls": 0}
    transport()
    return {"blocked": False, "network_calls": 1}


def load_models(path):
    if path:
        document = json.loads(Path(path).read_text())
    else:
        raw = subprocess.run(
            ["omp", "models", "--json", "xai-oauth"],
            check=True,
            capture_output=True,
            text=True,
            timeout=40,
        )
        document = json.loads(raw.stdout)
    if isinstance(document, dict):
        return document.get("models", [])
    return document


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--models", help="model JSON file; default is live omp models")
    args = parser.parse_args(argv)
    thresholds, percent = load_thresholds(args.config)
    models = load_models(args.models)
    found = violations_for(models, thresholds, percent)
    if not found:
        print("ok")
        return 0
    for item in found:
        print(f"{item['selector']}: {item['reason']}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
