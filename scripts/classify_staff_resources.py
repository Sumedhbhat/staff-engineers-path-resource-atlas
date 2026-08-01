#!/usr/bin/env python3
"""Build a chapter-ordered, type-classified Staff Engineer's Path resource list."""

from html.parser import HTMLParser
from pathlib import Path
import re
import sys

from extract_staff_resources import clean, title_case_section


class ResourceParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_h2 = self.in_p = self.in_a = False
        self.h2_text = []
        self.p_text = []
        self.a_text = []
        self.a_href = None
        self.p_links = []
        self.current_section = None
        self.sections = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "h2":
            self.in_h2, self.h2_text = True, []
        elif tag == "p" and self.current_section:
            self.in_p, self.p_text, self.p_links = True, [], []
        elif tag == "a" and self.in_p:
            self.in_a, self.a_text = True, []
            self.a_href = attrs.get("href")

    def handle_endtag(self, tag):
        if tag == "h2" and self.in_h2:
            title = clean("".join(self.h2_text))
            if title == "INTRODUCTION" or title.startswith("CHAPTER "):
                self.current_section = [title, []]
                self.sections.append(self.current_section)
            self.in_h2 = False
        elif tag == "a" and self.in_a:
            label = clean("".join(self.a_text))
            if label and self.a_href:
                self.p_links.append((label, self.a_href.strip()))
            self.in_a = False
        elif tag == "p" and self.in_p:
            context = clean("".join(self.p_text))
            for label, href in self.p_links:
                self.current_section[1].append((label, href, context))
            self.in_p = False

    def handle_data(self, data):
        if self.in_h2:
            self.h2_text.append(data)
        if self.in_p:
            self.p_text.append(data)
        if self.in_a:
            self.a_text.append(data)


CATEGORY_ORDER = [
    "Books and book chapters",
    "Articles and blog posts",
    "Videos, talks, and slide decks",
    "Courses and exercises",
    "Papers, RFCs, and reference documents",
    "Newsletters and conferences",
    "Tools, communities, and websites",
    "Social posts, comics, and other media",
]

# Labels whose surrounding paragraph contains a shared or misleading description.
EXACT_CATEGORIES = {
    "Staff Engineer": "Books and book chapters",
    "Fundamentals of Software Architecture": "Books and book chapters",
    "Writing the Good Vision": "Books and book chapters",
    "Good Strategy/Bad Strategy": "Books and book chapters",
    "Technology Strategy Patterns": "Books and book chapters",
    "Architecture Characteristics Defined": "Books and book chapters",
    "The Art of Travel": "Books and book chapters",
    "The Checklist Manifesto: How to Get Things Right": "Books and book chapters",
    "99 Bottles of OOP": "Books and book chapters",
    "Debugging Teams": "Books and book chapters",
    "Software Engineering at Google": "Books and book chapters",
    "Refactoring: Improving the Design of Existing Code": "Books and book chapters",
    "Resilient Management": "Books and book chapters",
    "Automating Inequality": "Books and book chapters",
    "Manipulating Your Organization": "Articles and blog posts",
    "Estimating": "Books and book chapters",
    "Overview of technical writing courses": "Courses and exercises",
    "Kotlin Koans": "Courses and exercises",
    "Codelabs": "Courses and exercises",
    "Coaching Drills and Exercises": "Articles and blog posts",
    "Science Faculty’s Subtle Gender Biases Favor Male Students": "Papers, RFCs, and reference documents",
    "The 5 Biases Pushing Women Out of STEM": "Articles and blog posts",
    "An Investigation of the Therac-25 Accident": "Papers, RFCs, and reference documents",
    "A Typology of Organisational Cultures": "Papers, RFCs, and reference documents",
    "Principal Engineering Community Tenets": "Papers, RFCs, and reference documents",
    "Technology Radar": "Papers, RFCs, and reference documents",
    "Thoughtworks Technology Radar": "Papers, RFCs, and reference documents",
    "On Consensus and Humming in the IETF": "Papers, RFCs, and reference documents",
    "Manifesto for Agile Software Development": "Papers, RFCs, and reference documents",
    "Definition of Done:": "Papers, RFCs, and reference documents",
    "ACSE Guidelines for Engineering Grades:": "Papers, RFCs, and reference documents",
    "Google Style Guides": "Papers, RFCs, and reference documents",
    "Social Rules": "Papers, RFCs, and reference documents",
    "Providing Feedback": "Papers, RFCs, and reference documents",
    "Hiring": "Papers, RFCs, and reference documents",
    "StaffPlus conference": "Newsletters and conferences",
    "Lead Dev, Staff Plus, and Leading Eng": "Newsletters and conferences",
    "SRECon": "Newsletters and conferences",
    "The Software Architects’ Newsletter": "Newsletters and conferences",
    "SRE Weekly:": "Newsletters and conferences",
    "Raw Signal": "Newsletters and conferences",
    "Regular Expressions": "Social posts, comics, and other media",
    "Average Familiarity": "Social posts, comics, and other media",
    "Map of Earth's principal tectonic plates": "Social posts, comics, and other media",
    "Civilization II Technology Tree": "Social posts, comics, and other media",
    "Is Tech A Meritocracy:": "Tools, communities, and websites",
    "Focus Retreat Center": "Tools, communities, and websites",
    "“in a few cases it was agreed that moving forward was more important than one person’s argument carrying the day, so we made decisions by flipping a coin”": "Books and book chapters",
}


def classify(label, href, context):
    if label in EXACT_CATEGORIES:
        return EXACT_CATEGORIES[label]
    text = f"{label} {context}".lower()
    domain = href.lower()
    # Tag the linked destination itself. A Wikipedia page about a book is an
    # article; the underlying subject does not change the link's format.
    if "wikipedia.org/wiki/" in domain:
        return "Articles and blog posts"
    if any(word in text for word in (" book by ",)):
        return "Books and book chapters"
    if any(word in text for word in ("course", "exercises", "codelab")):
        return "Courses and exercises"
    if any(word in text for word in ("conference talk", "keynote", "panel discussion", "slide deck", "video by", "talk by")) or "youtube.com" in domain:
        return "Videos, talks, and slide decks"
    if any(word in text for word in ("paper by", "research paper", "rfc-", "guidelines", "memo from")) or domain.endswith(".pdf"):
        return "Papers, RFCs, and reference documents"
    if any(word in text for word in ("newsletter", "upcoming conference", "annual conference")):
        return "Newsletters and conferences"
    if any(word in text for word in ("article by", "article on", "article about", "blog about", "advice from", "post manager", "guide to", "explanation from")):
        return "Articles and blog posts"
    if any(site in domain for site in ("twitter.com", "x.com", "linkedin.com", "xkcd.com", "genius.com")) or any(word in text for word in ("tweet", "twitter thread", "linkedin post", "lyrics", "cartoon")):
        return "Social posts, comics, and other media"
    if any(word in text for word in ("wikipedia article", "wikipedia page", "wikipedia’s article", "website", "homepage", "community", "app", "subreddit", "official ea", "official website", "resources from", "how to request", "downloadable")):
        return "Tools, communities, and websites"
    return "Articles and blog posts"


def main():
    parser = ResourceParser()
    parser.feed(Path(sys.argv[1]).read_text(encoding="utf-8"))
    total = sum(len(items) for _, items in parser.sections)

    print("# The Staff Engineer’s Path — Resources by Chapter and Type")
    print()
    print("Resources are grouped first by chapter and then by format. Within each format, entries remain in their original order of appearance. Repeated resources are retained in every chapter where they occur.")
    print()
    print("Source: [Staff Engineer’s Path Resource List](https://www.noidea.dog/staff-resources) by Tanya Reilly. Book: [O’Reilly catalog page](https://www.oreilly.com/library/view/the-staff-engineers/9781098118723/).")
    print()
    print(f"Total linked resource occurrences: {total}.")

    overall = 0
    for raw_title, items in parser.sections:
        print()
        print(f"## {title_case_section(raw_title)}")
        grouped = {category: [] for category in CATEGORY_ORDER}
        for chapter_order, (label, href, context) in enumerate(items, 1):
            overall += 1
            grouped[classify(label, href, context)].append((chapter_order, label, href))
        for category in CATEGORY_ORDER:
            if not grouped[category]:
                continue
            print()
            print(f"### {category}")
            print()
            for chapter_order, label, href in grouped[category]:
                safe = label.replace("[", "\\[").replace("]", "\\]")
                print(f"- [{safe}](<{href}>) — appearance {chapter_order} in this chapter")


if __name__ == "__main__":
    main()
