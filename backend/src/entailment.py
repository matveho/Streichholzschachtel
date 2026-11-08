"""Offline contradiction scores, not engineering approvals."""
import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

model_dir = Path(sys.argv[1])
config = json.loads((model_dir / 'config.json').read_text(encoding='utf-8'))
labels = [config['id2label'][str(i)].lower() for i in range(3)]
if set(labels) != {'contradiction', 'entailment', 'neutral'}:
    raise ValueError('Unexpected verifier label mapping')
tokenizer = Tokenizer.from_file(str(model_dir / 'tokenizer.json'))
options = ort.SessionOptions()
options.intra_op_num_threads = 4
options.inter_op_num_threads = 1
options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_DISABLE_ALL
options.enable_cpu_mem_arena = False
options.enable_mem_pattern = False
options.add_session_config_entry('session.disable_prepacking', '1')
session = ort.InferenceSession(str(model_dir / 'model.onnx'), sess_options=options,
                             providers=['CPUExecutionProvider'])
cases = json.loads(sys.stdin.buffer.read(262145).decode('utf-8'))
if not isinstance(cases, list) or len(cases) > 12:
    raise ValueError('Invalid verifier batch')
results = []
for case in cases:
    encoded = tokenizer.encode(case['premise'], case['claim'])
    if len(encoded.ids) > 512:
        results.append({'id': case['id'], 'abstained': True})
        continue
    arrays = {'input_ids': encoded.ids, 'attention_mask': encoded.attention_mask,
              'token_type_ids': encoded.type_ids}
    feeds = {item.name: np.asarray([arrays[item.name]], dtype=np.int64)
             for item in session.get_inputs()}
    logits = session.run(None, feeds)[0][0]
    probabilities = np.exp(logits - np.max(logits))
    probabilities /= probabilities.sum()
    results.append({'id': case['id'], 'scores': dict(zip(labels, map(float, probabilities)))})
sys.stdout.buffer.write(json.dumps(results).encode('utf-8'))
