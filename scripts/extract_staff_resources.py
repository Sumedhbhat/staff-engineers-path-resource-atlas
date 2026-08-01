#!/usr/bin/env python3
"""Convert Tanya Reilly's Staff Engineer's Path resource page to Markdown."""

from html import unescape
from html.parser import HTMLParser
from pathlib import Path
import re
import sys


class ResourceParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_h2 = False
        self.in_p = False
        self.in_a = False
        self.h2_parts = []
        self.p_parts = []
        self.anchor_parts = []
        self.anchor_href = None
        self.current_section = None
        self.sections = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "h2":
            self.in_h2 = True
            self.h2_parts = []
        elif tag == "p" and self.current_section:
            self.in_p = True
            self.p_parts = []
        elif tag == "a" and self.in_p:
            self.in_a = True
            self.anchor_parts = []
            self.anchor_href = attrs.get("href")

    def handle_endtag(self, tag):
        if tag == "h2" and self.in_h2:
            title = clean("".join(self.h2_parts))
            if title == "INTRODUCTION" or title.startswith("CHAPTER "):
                self.current_section = [title, []]
                self.sections.append(self.current_section)
            self.in_h2 = False
        elif tag == "a" and self.in_a:
            label = clean("".join(self.anchor_parts))
            if self.anchor_href and label:
                self.p_parts.append((label, self.anchor_href.strip()))
            self.in_a = False
        elif tag == "p" and self.in_p:
            if self.p_parts:
                self.current_section[1].extend(self.p_parts)
            self.in_p = False

    def handle_data(self, data):
        if self.in_h2:
            self.h2_parts.append(data)
        if self.in_a:
            self.anchor_parts.append(data)


def clean(value):
    return re.sub(r"\s+", " ", unescape(value)).strip()


def title_case_section(raw):
    titles = {
        "INTRODUCTION": "Introduction",
        "CHAPTER 1": "Chapter 1: What Would You Say You Do Here?",
        "CHAPTER 2": "Chapter 2: Three Maps",
        "CHAPTER 3": "Chapter 3: Creating the Big Picture",
        "CHAPTER 4": "Chapter 4: Finite Time",
        "CHAPTER 5": "Chapter 5: Leading Big Projects",
        "CHAPTER 6": "Chapter 6: Why Have We Stopped?",
        "CHAPTER 7": "Chapter 7: You’re a Role Model Now (Sorry)",
        "CHAPTER 8": "Chapter 8: Influence at Scale",
        "CHAPTER 9": "Chapter 9: What’s Next?",
    }
    key = raw if raw == "INTRODUCTION" else raw.split(":", 1)[0]
    return titles[key]


def main():
    source = Path(sys.argv[1]).read_text(encoding="utf-8")
    parser = ResourceParser()
    parser.feed(source)

    print("# The Staff Engineer’s Path — Links and Referenced Resources")
    print()
    print("This index follows the resources in the order they appear in Tanya Reilly’s author-maintained resource list for *The Staff Engineer’s Path*. Each occurrence is retained, including links repeated in later chapters. “Chronological order” here means book reading order: Introduction, then Chapters 1–9, and order of appearance within each chapter.")
    print()
    print("Source: [Staff Engineer’s Path Resource List](https://www.noidea.dog/staff-resources) by Tanya Reilly. Book: [O’Reilly catalog page](https://www.oreilly.com/library/view/the-staff-engineers/9781098118723/).")
    print()
    print(f"Total linked resource occurrences: {sum(len(items) for _, items in parser.sections)}.")

    overall = 0
    for raw_title, items in parser.sections:
        print()
        print(f"## {title_case_section(raw_title)}")
        print()
        for chapter_order, (label, href) in enumerate(items, 1):
            overall += 1
            safe_label = label.replace("[", "\\[").replace("]", "\\]")
            print(f"{overall}. [{safe_label}](<{href}>) — chapter order {chapter_order}")


if __name__ == "__main__":
    main()
