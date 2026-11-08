"""Optional offline verifier experiment; never used to approve live answers.

Run with an explicitly supplied model directory containing tokenizer.json,
config.json and model.onnx. Dependencies: numpy, tokenizers, onnxruntime.
No documents, queries or model requests are sent to a remote service.
"""
import argparse
import json
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

parser = argparse.ArgumentParser()
parser.add_argument('--model-dir', required=True, type=Path)
parser.add_argument('--cases', type=Path, default=Path(__file__).with_name('entailment-cases.json'))
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
config = json.loads((args.model_dir / 'config.json').read_text(encoding='utf-8'))
labels = [config['id2label'][str(i)].lower() for i in range(3)]
if set(labels) != {'contradiction', 'entailment', 'neutral'}:
    raise ValueError('Unexpected model label mapping; consult the original model card.')
tokenizer = Tokenizer.from_file(str(args.model_dir / 'tokenizer.json'))
options = ort.SessionOptions()
options.intra_op_num_threads = 4
options.inter_op_num_threads = 1
options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_DISABLE_ALL
options.enable_cpu_mem_arena = False
options.enable_mem_pattern = False
options.add_session_config_entry('session.disable_prepacking', '1')
session = ort.InferenceSession(str(args.model_dir / 'model.onnx'), sess_options=options,
                             providers=['CPUExecutionProvider'])
results = []
for case in json.loads(args.cases.read_text(encoding='utf-8')):
    started = time.monotonic()
    encoded = tokenizer.encode(case['premise'], case['claim'])
    result = {'id': case['id'], 'expected': case['entailed'], 'tokens': len(encoded.ids)}
    if len(encoded.ids) > 512:
        # Truncation could remove an exception or governing condition.
        result.update(entailed=False, skipped='Input exceeds the verified context limit')
    else:
        arrays = {'input_ids': encoded.ids, 'attention_mask': encoded.attention_mask,
                  'token_type_ids': encoded.type_ids}
        feeds = {item.name: np.asarray([arrays[item.name]], dtype=np.int64)
                 for item in session.get_inputs()}
        logits = session.run(None, feeds)[0][0]
        probabilities = np.exp(logits - np.max(logits))
        probabilities /= probabilities.sum()
        scores = dict(zip(labels, map(float, probabilities)))
        result.update(scores=scores, entailed=scores['entailment'] >= .85 and scores['contradiction'] <= .1)
    result.update(passed=result['entailed'] == case['entailed'], seconds=round(time.monotonic() - started, 3))
    results.append(result)
    print(json.dumps(result), flush=True)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps({'passed': sum(r['passed'] for r in results), 'total': len(results),
                  'false_approvals': sum(r['entailed'] and not r['expected'] for r in results)}))
