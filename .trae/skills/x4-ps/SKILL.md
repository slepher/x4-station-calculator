---
name: x4-ps
description: "Capture clipboard image and let the agent view it directly with multimodal vision. Trigger with /x4:ps."
---

# X4 Clipboard Image Vision

Use this skill for `/x4:ps` when the user wants the agent to see an image quickly.

## Trigger

- `/x4:ps`
- User asks: "看图", "解析剪贴板图片", "让 agent 看到图片"

## Purpose

Capture the current clipboard image into a file, then inspect it with multimodal vision (not OCR by default).

## Workflow (MANDATORY)

1. Run:

```bash
bash skill-scripts/copy-img-clip.sh
```

2. If command exits `1`, stop and report failure (clipboard has no image or capture failed).
3. If command exits `0`, read the stdout path (full image path).
4. Open that local image path with vision tool and analyze visual content.
5. Return:
   - image path
   - concise visual summary
   - any text/structure recognized visually (without claiming exact OCR-level precision)

## Policy

- Default path source must come from script stdout.
- Do not run OCR unless user explicitly requests OCR.
- Keep analysis grounded in visible content only; do not fabricate hidden details.

## Output

- `Image: <full-path>`
- `Result: <what is visible>`
- `Confidence/limits: <if small or unclear regions exist>`
