#!/usr/bin/env python3
"""Resolve redirects for links in the classified Markdown resource index."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import json
import re
import subprocess
import sys


LINK = re.compile(r"^- \[(.*?)\]\(<(.*?)>\) — appearance (\d+) in this chapter$")

KNOWN_DESTINATIONS = {
    "https://charity.wtf/2017/05/11/the-engineer-manager-pendulum/": "https://charity.wtf/p/the-engineer-manager-pendulum",
    "https://charity.wtf/2019/01/04/engineering-management-the-pendulum-or-the-ladder/": "https://charity.wtf/p/engineering-management-the-pendulum-or-the-ladder",
    "https://www.thoughtworks.com/radar/byor": "https://www.thoughtworks.com/en-gb/radar/byor",
    "https://www.thoughtworks.com/de-de/radar/techniques/lightweight-architecture-decision-records": "https://www.thoughtworks.com/en-es/radar/techniques/lightweight-architecture-decision-records",
    "https://www.thoughtworks.com/en-us/radar": "https://www.thoughtworks.com/radar",
}


def curl(url, head=True):
    command = [
        "curl", "--location", "--silent", "--show-error",
        "--max-time", "25", "--connect-timeout", "8",
        "--user-agent", "Mozilla/5.0 StaffEngineersPathResourceIndex/1.0",
        "--output", "/dev/null", "--write-out", "%{url_effective}\t%{http_code}",
    ]
    if head:
        command.append("--head")
    else:
        command.extend(["--range", "0-0"])
    command.append(url)
    result = subprocess.run(command, capture_output=True, text=True)
    value = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ""
    if "\t" in value:
        final_url, code = value.rsplit("\t", 1)
    else:
        final_url, code = url, "000"
    return final_url or url, int(code) if code.isdigit() else 0, result.returncode


def resolve(url):
    candidate = KNOWN_DESTINATIONS.get(url, url[:-1] if "wikipedia.org/wiki/" in url and url.endswith(":") else url)
    final_url, status, returncode = curl(candidate, head=True)
    if returncode or status in {0, 403, 405, 406, 429, 500, 501, 502, 503}:
        get_url, get_status, get_returncode = curl(candidate, head=False)
        if get_status and (get_returncode == 0 or status == 0):
            final_url, status, returncode = get_url, get_status, get_returncode
    return {"originalUrl": url, "resolvedUrl": final_url, "status": status}


def parse_markdown(path):
    chapter = category = None
    entries = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            chapter = line[3:]
        elif line.startswith("### "):
            category = line[4:]
        else:
            match = LINK.match(line)
            if match:
                label, url, appearance = match.groups()
                entries.append({
                    "chapter": chapter,
                    "category": category,
                    "title": label.replace("\\[", "[").replace("\\]", "]"),
                    "appearance": int(appearance),
                    "originalUrl": url,
                })
    return entries


def main():
    source, destination = sys.argv[1:3]
    entries = parse_markdown(source)
    urls = list(dict.fromkeys(entry["originalUrl"] for entry in entries))
    resolved = {}
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = {pool.submit(resolve, url): url for url in urls}
        for index, future in enumerate(as_completed(futures), 1):
            item = future.result()
            resolved[item["originalUrl"]] = item
            print(f"Resolved {index}/{len(urls)}", file=sys.stderr)
    for entry in entries:
        entry.update({key: value for key, value in resolved[entry["originalUrl"]].items() if key != "originalUrl"})
    chapter_order = {chapter: index for index, chapter in enumerate(dict.fromkeys(entry["chapter"] for entry in entries))}
    entries.sort(key=lambda entry: (chapter_order[entry["chapter"]], entry["appearance"]))
    payload = {
        "source": "https://www.noidea.dog/staff-resources",
        "book": "The Staff Engineer’s Path by Tanya Reilly",
        "resourceOccurrences": len(entries),
        "uniqueOriginalUrls": len(urls),
        "resources": entries,
    }
    Path(destination).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
