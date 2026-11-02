#!/usr/bin/env bash
# Fetches the Qwen3Guard-Gen-0.6B GGUF used by the Layer 0 content guard.
# Place: models/Qwen3Guard-Gen-0.6B.Q8_0.gguf (mounted into the guard container)
set -euo pipefail
cd "$(dirname "$0")/.."

MODEL_DIR="models"
GGUF_NAME="Qwen3Guard-Gen-0.6B.Q8_0.gguf"
URL="https://huggingface.co/QuantFactory/Qwen3Guard-Gen-0.6B-GGUF/resolve/main/${GGUF_NAME}"

mkdir -p "$MODEL_DIR"
if [ -f "$MODEL_DIR/$GGUF_NAME" ]; then
    echo "[fetch] Model already present: $MODEL_DIR/$GGUF_NAME"
    exit 0
fi

echo "[fetch] Downloading $URL"
if command -v curl >/dev/null 2>&1; then
    curl -L --fail --progress-bar "$URL" -o "$MODEL_DIR/$GGUF_NAME"
elif command -v wget >/dev/null 2>&1; then
    wget --show-progress -O "$MODEL_DIR/$GGUF_NAME" "$URL"
else
    echo "[fetch] ERROR: need curl or wget" >&2
    exit 1
fi
echo "[fetch] Done -> $MODEL_DIR/$GGUF_NAME"
