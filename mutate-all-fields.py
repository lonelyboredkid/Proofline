import subprocess, re, os
src = open("proofline-mockup-studio.jsx").read()
lines = [l for l in src.split("\n") if re.match(r"\s+if \((typeof )?s\.\w+", l) and "set" in l]
print(f"{len(lines)} applyPreset field lines found")
missed = []
for l in lines:
    open("mut.jsx","w").write(src.replace(l + "\n", "", 1))
    subprocess.run(["npx","esbuild","mut.jsx","--format=esm","--outfile=mut.built.mjs","--log-level=error"], check=True)
    r = subprocess.run(["node","--test","presets-ui.test.mjs"], env={**os.environ,"BUILT":"./mut.built.mjs"}, capture_output=True, text=True)
    if not re.findall(r"^not ok \d+ - (.*)$", r.stdout, re.M): missed.append(l.strip())
print("MISSED:", missed if missed else "none — every applyPreset field is protected")
