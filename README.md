# Codex Transcript Translator

A personal local CLI that turns a copied YouTube transcript txt file into a bilingual transcript:

```txt
[2:03] All right, this is CS50.
[2:03] 좋아요, 이것이 CS50입니다.
```

It is built on top of the official `@openai/codex-sdk`, so the program uses Codex from your local machine instead of calling the OpenAI API directly from custom code.

## What it does

- Accepts a local `txt` file path as an argument
- Parses YouTube transcript lines such as `2:032분 3초All right, this is CS50`
- Supports both `m:ss` and `h:mm:ss`
- Keeps every parsed line and translates it into natural Korean
- Writes a final `*_번역본.txt` file beside the original input
- Saves progress after each chunk so long transcripts can resume

## Requirements

- Node.js 18+
- A working Codex login on this machine

## One-time setup

```powershell
cd "C:\Users\USER\OneDrive\Documents\New project\codex-transcript-translator"
npm install
npx codex login
```

When the login prompt appears, sign in with ChatGPT.

## Usage

```powershell
npm run translate -- "C:\Users\USER\Downloads\챕터 1 Introduction.txt"
```

Optional flags:

- `--output "C:\path\custom_output.txt"`
- `--model gpt-5.4`
- `--reasoning low`
- `--chunk-size 25`
- `--max-chars 6000`
- `--overwrite`
- `--fresh`

## Output

If the input file is:

```txt
2:032분 3초All right, this is CS50.
2:122분 12초Harvard University's introduction to computer science.
```

The output will look like:

```txt
[2:03] All right, this is CS50.
[2:03] 좋아요, 이것이 CS50입니다.

[2:12] Harvard University's introduction to computer science.
[2:12] 하버드 대학교의 컴퓨터 과학 입문 강좌입니다.
```

## Notes

- The translator keeps timestamps in the final file, but asks Codex to translate only the spoken text.
- Non-timestamp lines such as chapter headings are also preserved and translated.
- A progress file is written as `*.progress.json` while translation is running. If the process stops midway, rerun the same command to resume.

