#!/usr/bin/env python3
"""Run a livereload server for the project directory.

Usage: ./run.sh [port]
"""
import argparse
import os
from livereload import Server


def gather_patterns():
    exts = ('.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.svg')
    patterns = set()
    for root, dirs, files in os.walk('.'):
        for f in files:
            if f.lower().endswith(exts):
                patterns.add(os.path.join(root, f))
    return sorted(patterns)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--port', type=int, default=8000)
    p.add_argument('--host', type=str, default='127.0.0.1')
    p.add_argument('--open', dest='open', action='store_true', help='Automatically open the browser')
    p.add_argument('--no-open', dest='open', action='store_false', help="Don't open the browser automatically")
    p.set_defaults(open=True)
    args = p.parse_args()

    server = Server()
    # Watch top-level simple globs
    server.watch('*.html')
    server.watch('*.css')
    server.watch('*.js')

    # Also add all discovered static files in subfolders
    for path in gather_patterns():
        server.watch(path)

    print(f"Serving on http://{args.host}:{args.port} (livereload enabled)")
    open_delay = 1 if args.open else None
    server.serve(root='.', host=args.host, port=args.port, open_url_delay=open_delay)


if __name__ == '__main__':
    main()
