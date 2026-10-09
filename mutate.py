import subprocess, re, sys
src = open("proofline-mockup-studio.jsx").read()
M = [
 ("no blank-name guard",            "    if (!trimmed) return;\n    const settings", "    const settings"),
 ("same name no longer replaces",   "      ...prev.filter((p) => p.name !== trimmed),\n", "      ...prev,\n"),
 ("delete removes wrong preset",    "prev.filter((p) => p.id !== id)", "prev.filter((p) => p.id === id)"),
 ("apply skips caption color",      "    if (s.captionColor) setCaptionColor(s.captionColor);\n", ""),
 ("presets never loaded on mount",  "          setPresets(\n            Array.isArray(parsed)", "          (() => {})(\n            Array.isArray(parsed)"),
 ("presets not saved on change",    "    storage.set(PRESETS_KEY, JSON.stringify(presets));\n", ""),
 ("apply unguarded for missing field", "if (s.captionColor) setCaptionColor(s.captionColor);", "setCaptionColor(s.captionColor);"),
 ("save omits caption position",    "      captionColor, captionPosition, fontId, padding, exportScale,\n    });\n    setPresets", "      captionColor, fontId, padding, exportScale,\n    });\n    setPresets"),
]
for name, a, b in M:
    if src.count(a) != 1:
        print(f"!! mutation '{name}': anchor found {src.count(a)} times — skipped"); continue
    open("mut.jsx","w").write(src.replace(a, b))
    subprocess.run(["npx","esbuild","mut.jsx","--format=esm","--outfile=mut.built.mjs","--log-level=error"], check=True)
    r = subprocess.run(["node","--test","presets-ui.test.mjs"], env={**__import__("os").environ,"BUILT":"./mut.built.mjs"}, capture_output=True, text=True)
    failed = re.findall(r"^not ok \d+ - (.*)$", r.stdout, re.M)
    print(("CAUGHT  " if failed else "MISSED  ") + name + ("  ->  " + "; ".join(f[:55] for f in failed) if failed else ""))
