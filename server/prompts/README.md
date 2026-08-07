# Private prompt files (never committed)
Runtime expects here: `vai.system.md`, `gai.system.md`, `facts.vai.md`,
`deflections.json`. Live copies: locally for dev, and on the box next to
`.env` (mode 600, owner deploy). Deploying a facts update = scp + restart
(see vault runbook). This README is the only tracked file in this dir.
