"""Store FP32 ISNet weights in FP16 and cast to FP32 before unchanged computation.
Requires onnx==1.23.2. Original model MD5 is checked before deriving this artifact.
"""
import hashlib, argparse, numpy as np, onnx
from pathlib import Path
from onnx import numpy_helper,helper,TensorProto
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('source',type=Path)
parser.add_argument('output',type=Path)
args=parser.parse_args()
source=args.source
assert hashlib.md5(source.read_bytes()).hexdigest()=='fc16ebd8b0c10d971d3513d564d01e29'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a'
model=onnx.load(str(source));casts=[]
for i,initializer in enumerate(model.graph.initializer):
 if initializer.data_type!=TensorProto.FLOAT:continue
 a=numpy_helper.to_array(initializer)
 if a.size<=16:continue
 original=initializer.name;stored=original+'_fp16_storage'
 model.graph.initializer[i].CopyFrom(numpy_helper.from_array(a.astype(np.float16),name=stored))
 casts.append(helper.make_node('Cast',[stored],[original],name=original+'_restore_fp32',to=TensorProto.FLOAT))
nodes=list(model.graph.node);del model.graph.node[:];model.graph.node.extend(casts+nodes)
onnx.checker.check_model(model)
first=model.graph.output[0];del model.graph.output[:];model.graph.output.append(first)
path=args.output;onnx.save(model,str(path))
print('casts',len(casts),'bytes',path.stat().st_size,'sha256',hashlib.sha256(path.read_bytes()).hexdigest())
