"""Database-free local preview server for the Crows Blog."""

from __future__ import annotations

import argparse
import json
import math
import re
from datetime import date
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


PROJECT_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = PROJECT_DIR / "public"
POSTS_DIR = PROJECT_DIR / "posts"
VALID_COVERS = {"rose", "web", "terminal"}


def parse_post(path: Path, include_body: bool = False) -> dict:
    raw = path.read_text(encoding="utf-8-sig").replace("\r\n", "\n").replace("\r", "\n")
    lines = raw.split("\n")
    if not lines or lines[0].strip() != "---":
        raise ValueError("o arquivo deve começar com ---")

    try:
        closing_line = lines.index("---", 1)
    except ValueError as error:
        raise ValueError("faltou fechar os metadados com ---") from error

    metadata = {}
    for line in lines[1:closing_line]:
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, separator, value = line.partition(":")
        if not separator or not key.strip():
            raise ValueError(f"metadado inválido: {line}")
        value = value.strip()
        if value in {">", "|"}:
            raise ValueError("metadados multilinha não são suportados")
        if len(value) >= 2 and value[0] == value[-1] == '"':
            value = json.loads(value)
        elif len(value) >= 2 and value[0] == value[-1] == "'":
            value = value[1:-1].replace("''", "'")
        metadata[key.strip().lower()] = value

    title = metadata.get("title", "").strip()
    if not title:
        raise ValueError("adicione title: no início do arquivo")
    post_date = metadata.get("date", "")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", post_date):
        raise ValueError("date deve usar o formato AAAA-MM-DD")
    try:
        parsed_date = date.fromisoformat(post_date)
    except ValueError as error:
        raise ValueError("date deve usar o formato AAAA-MM-DD") from error
    if parsed_date.isoformat() != post_date:
        raise ValueError("date deve usar o formato AAAA-MM-DD")

    body = "\n".join(lines[closing_line + 1:]).strip()
    first_paragraph = next((line.strip() for line in body.splitlines() if line.strip()), "")
    excerpt = metadata.get("excerpt") or re.sub(r"[>#*_`~\[\]()!]", "", first_paragraph).strip()[:220]
    if "reading_time" in metadata:
        try:
            reading_time = int(metadata["reading_time"])
        except ValueError as error:
            raise ValueError("reading_time deve ser um inteiro maior que zero") from error
        if reading_time < 1:
            raise ValueError("reading_time deve ser um inteiro maior que zero")
    else:
        reading_time = max(1, math.ceil(len(body.split()) / 200))

    cover = metadata.get("cover") or "web"
    if cover not in VALID_COVERS:
        raise ValueError("cover deve ser rose, web ou terminal")

    post = {
        "slug": path.stem,
        "title": title,
        "date": post_date,
        "category": (metadata.get("category") or "DIÁRIO").upper(),
        "reading_time": reading_time,
        "cover": cover,
        "excerpt": excerpt,
    }
    if include_body:
        post["body"] = body
    return post


def get_posts() -> tuple[list[dict], list[dict]]:
    posts = []
    skipped = []
    if not POSTS_DIR.is_dir():
        return posts, skipped

    for path in POSTS_DIR.glob("*.md"):
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", path.stem):
            skipped.append({"file": path.name, "reason": "use minúsculas, números e hífens no nome"})
            continue
        try:
            posts.append(parse_post(path))
        except (OSError, UnicodeError, ValueError) as error:
            skipped.append({"file": path.name, "reason": str(error)})

    posts.sort(key=lambda post: (post["date"], post["slug"]), reverse=True)
    return posts, skipped


class BlogHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        request_path = unquote(urlsplit(self.path).path)
        if request_path == "/posts-index.json":
            posts, skipped = get_posts()
            self.send_json({"posts": posts, "skipped": skipped})
            return

        match = re.fullmatch(r"/posts/([a-z0-9][a-z0-9-]*)\.md", request_path)
        if match:
            post_path = POSTS_DIR / f"{match.group(1)}.md"
            try:
                post = parse_post(post_path, include_body=True)
            except FileNotFoundError:
                self.send_error(404, "post não encontrado")
                return
            except (OSError, UnicodeError, ValueError):
                self.send_error(404, "post indisponível")
                return

            body = post["body"].encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/markdown; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return

        super().do_GET()


def main() -> None:
    parser = argparse.ArgumentParser(description="Servidor estático local do Crows Blog, sem banco de dados")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), BlogHandler)
    print(f"Crows Blog: http://{args.host}:{args.port}")
    print("Posts carregados diretamente da pasta posts/ (sem banco de dados).")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
