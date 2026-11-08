# Optional local contradiction verifier

The user authorized `E:\Basis-model-cache` for optional model weights and the Python environment. Source code remains in `backend-matvey`. This verifier processes text locally; it does not send project questions or excerpts to a hosted model.

This device has the environment at `E:\Basis-model-cache\.venv` and the model at `E:\Basis-model-cache\model`. The preparation script verifies SHA-256 checksums against a pinned revision of [cross-encoder/nli-deberta-v3-small](https://huggingface.co/cross-encoder/nli-deberta-v3-small). It reuses verified files and downloads only missing or mismatched files.

From this folder, check the model and rerun the offline benchmark:

```powershell
node prepare-verifier.mjs E:/Basis-model-cache/model
& 'E:\Basis-model-cache\.venv\Scripts\python.exe' tests/entailment-benchmark.py --model-dir E:/Basis-model-cache/model --output test-results/entailment-benchmark.json
```

For a fresh environment, keep temporary files and pip's cache on E as well:

```powershell
New-Item -ItemType Directory -Force E:\Basis-model-cache\tmp | Out-Null
$env:TEMP='E:\Basis-model-cache\tmp'
$env:TMP=$env:TEMP
$env:PIP_CACHE_DIR='E:\Basis-model-cache\pip-cache'
python -m venv E:\Basis-model-cache\.venv
& 'E:\Basis-model-cache\.venv\Scripts\python.exe' -m pip install -r requirements-verifier.txt
node prepare-verifier.mjs E:/Basis-model-cache/model
```

To enable it for a development API, set these variables before starting the server:

```powershell
$env:PORT='8788'
$env:LOCAL_SYNTHESIS='1'
$env:ENTAILMENT_MODEL_DIR='E:/Basis-model-cache/model'
$env:ENTAILMENT_PYTHON='E:/Basis-model-cache/.venv/Scripts/python.exe'
node src/server.mjs
```

It is enabled on the development service, not the frozen demo snapshot on port 8787. These paths are not required for the ordinary API to start. Remove the variables to disable the extra check.

## Limits

The latest 16-case offline benchmark passed 15 cases, including one false approval of an incorrect numeric comparison. Therefore, an entailment score **never approves a claim**. Only a contradiction score of at least 0.95 vetoes a claim; ordinary source, numeric, scope and model-review checks remain required. Inputs exceeding 512 tokens abstain instead of truncating away qualifications. This small benchmark does not establish broad engineering accuracy.

ONNX graph optimizations, memory patterns, the CPU arena and prepacking are disabled to limit startup allocations. With the experimental llama.cpp provider, use the sleep and release settings in [LOCAL_RUNTIME.md](LOCAL_RUNTIME.md): the generation model releases memory before the verifier starts, then reloads for the next generation. A real integration test verifies this handoff and the subsequent strict-schema generation. A configured verifier failure withholds an answer instead of bypassing the check.

The environment, model weights and generated benchmark reports must remain outside Git. The setup script downloads public model artifacts; inference uses only local files.
