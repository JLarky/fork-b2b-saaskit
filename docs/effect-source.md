# Effect Source Reference (VM + Cloud Safe)

Use `scripts/setup-effect-source.sh` to clone or update the local Effect source reference.

The script picks a path in this order:

1. `EFFECT_SOURCE_DIR` (if set)
2. `${XDG_DATA_HOME:-$HOME/.local/share}/effect-solutions/effect`
3. `${PWD}/.cache/effect-source/effect` (workspace fallback)

It is idempotent:

- Clones if missing
- Pulls latest shallow history (`--depth 1`) if already cloned

## Usage

```bash
bash scripts/setup-effect-source.sh
```

Optional custom location:

```bash
EFFECT_SOURCE_DIR=/some/path/effect bash scripts/setup-effect-source.sh
```
