"""Download pinned CPU test artifacts; never import a model-supplied chat template."""
import sys, json, hashlib, urllib.request, tarfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
cache = Path(sys.argv[1]); profile = json.loads(sys.argv[2]); cache.mkdir(parents=True, exist_ok=True)
def artifact(values):
    name, url, checksum = values
    target = cache / name
    if not target.exists():
        temporary = target.with_suffix('.download')
        with urllib.request.urlopen(url, timeout=120) as response, temporary.open('wb') as output:
            while chunk := response.read(1024 * 1024): output.write(chunk)
        temporary.replace(target)
    with target.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != checksum: raise ValueError('Artifact checksum mismatch: ' + name)
    print(name + ' checksum verified', flush=True)
with ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(artifact, [('runtime.tar.gz', profile['runtimeURL'], profile['runtimeSHA256']), ('model.gguf', profile['modelURL'], profile['modelSHA256'])]))
with tarfile.open(cache / 'runtime.tar.gz') as archive:
    archive.extractall(cache / 'runtime', filter='data')
