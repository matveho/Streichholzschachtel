# Experimental local generation runtime

The deployed demo still uses its saved engine on port 8787. Development on port 8788 can use Qwen3.5-4B through a separate loopback runtime on port 11436. This is an experiment, not a completed answer-quality release.

All inference runs on this device. Weights, binaries, the runtime key and optional Python environments are stored in the user-authorized `E:\Basis-model-cache`; source changes remain in `backend`.

## Prepare

Run from this folder:

```powershell
node prepare-local-runtime.mjs E:/Basis-model-cache
if ($LASTEXITCODE -ne 0) { throw 'Local runtime verification failed' }
Expand-Archive -LiteralPath E:\Basis-model-cache\llama-b12196-vulkan-x64.zip -DestinationPath E:\Basis-model-cache\llama-b12196-vulkan -Force
```

The preparation script pins and checks SHA-256 digests for the model from Ollama's registry, its license and llama.cpp build b12196. It reuses verified files. Model provenance: [Qwen3.5-4B](https://huggingface.co/Qwen/Qwen3.5-4B); runtime: [llama.cpp](https://github.com/ggml-org/llama.cpp).

This device already has `E:\Basis-model-cache\runtime-key.txt`. Keep it private. A new machine needs a random key file supplied to both processes; it must never enter the frontend or Git.

## Run on this device

Start the model in a terminal and leave it running:

```powershell
& 'E:\Basis-model-cache\llama-b12196-vulkan\llama-server.exe' --model E:\Basis-model-cache\qwen3.5-4b.gguf --alias basis-qwen35 --host 127.0.0.1 --port 11436 --ctx-size 8192 --batch-size 256 --ubatch-size 128 --parallel 1 --threads 6 --threads-batch 6 --gpu-layers 16 --reasoning off --cache-ram 0 --ctx-checkpoints 1 --no-cache-idle-slots --no-webui --sleep-idle-seconds 1 --api-key-file E:\Basis-model-cache\runtime-key.txt
```

The cache limits are necessary on this computer. The default prompt-cache allocation exhausted available virtual memory during the CPU experiment. The bounded configuration completed the 24-case benchmark with stable memory. Sixteen GPU layers leave room for the demo's existing Ollama runtime. Hardware and available memory must be checked before increasing that value.

In a separate terminal, configure and start the development API:

```powershell
$env:PORT='8788'
$env:GENERATION_PROVIDER='llamacpp'
$env:LOCAL_SYNTHESIS='1'
$env:LOCAL_MODEL_URL='http://127.0.0.1:11436'
$env:LOCAL_MODEL_NAME='basis-qwen35'
$env:LOCAL_MODEL_KEY_FILE='E:/Basis-model-cache/runtime-key.txt'
$env:LOCAL_MODEL_MANIFEST='E:/Basis-model-cache/qwen35-source.json'
$env:LOCAL_MODEL_RELEASE_FOR_VERIFIER='1'
$env:ENTAILMENT_MODEL_DIR='E:/Basis-model-cache/model'
$env:ENTAILMENT_PYTHON='E:/Basis-model-cache/.venv/Scripts/python.exe'
node src/server.mjs
```

With the optional verifier configured, the API waits for the generation runtime to sleep before loading the verifier. This avoids allocating both models together on this device. The runtime wakes automatically for the next generation request. Keep the one-second idle sleep and release flag together; omitting them previously caused verifier allocation failures.

The local provider rejects non-loopback URLs and incomplete generation. It uses the nested `response_format.json_schema.schema` contract verified against the actual runtime; a top-level `schema` field was silently ignored by this build. Backend citation, quantity, applicability and review checks still apply to every answer.

## Verify

```powershell
node --test tests/local-runtime.integration.mjs
node tests/local-model-benchmark.mjs llamacpp http://127.0.0.1:11436 basis-qwen35
$env:BASIS_TEST_URL='http://127.0.0.1:8788'
$env:BASIS_QUALITY_SUITE='engineering'
node tests/quality.mjs
```

Use the API environment variables above when invoking the live runtime check. The reasoning benchmark records its script fingerprint; benchmark scores alone do not prove consolidated-answer quality. Engine changes require the engineering suite, source review, unsupported-query tests and frontend integration checks before promotion.
