#!/usr/bin/env python3
"""Zip a macOS .app folder the way macOS expects: symlinks kept as symlinks, executable bits kept.
usage: zipapp.py "<folder with Kin Relay.app>" out.zip"""
import os, sys, zipfile, stat
src, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for root, dirs, files in os.walk(src):
        for n in sorted(dirs + files):
            p = os.path.join(root, n); rel = os.path.relpath(p, src); st = os.lstat(p)
            if stat.S_ISLNK(st.st_mode):
                zi = zipfile.ZipInfo(rel); zi.create_system = 3; zi.external_attr = (0o120777 << 16)
                z.writestr(zi, os.readlink(p))
            elif stat.S_ISDIR(st.st_mode):
                zi = zipfile.ZipInfo(rel + "/"); zi.create_system = 3; zi.external_attr = ((0o40755) << 16) | 0x10
                z.writestr(zi, b"")
            else:
                zi = zipfile.ZipInfo.from_file(p, rel); zi.create_system = 3
                zi.external_attr = (stat.S_IFREG | (0o755 if st.st_mode & 0o111 else 0o644)) << 16
                zi.compress_type = zipfile.ZIP_DEFLATED
                with open(p, "rb") as f: z.writestr(zi, f.read(), compresslevel=9)
