#!/bin/sh
# excer_bot.py 안의 DUMPER_JAR(화면 읽기 도우미)와 CLICK_JAR(가린 칸 누르기 도우미, 2026-11-01)를 다시 만든다. 개발 PC 에서(JDK 와 인터넷 필요),
# 태블릿에서는 할 필요 없음.
#   sh tools/excer_dump/build.sh   ->  excer_dump.jar 와 jar.b64, excer_click.jar 와 click.b64. b64 를 excer_bot.py 의 DUMPER_JAR, CLICK_JAR 에 넣는다.
#   (지금 excer_bot.py 의 DUMPER_JAR 는 예전에 dalvik-dx 로 만든 것이라 sha1 이 다르다. 읽기 도우미를 고칠 때만 바꾼다)
# stubs/ 는 컴파일에만 쓰는 껍데기다(기기에서는 진짜 안드로이드 것이 쓰인다). dex 로 바꾸는 도구는 구글 Maven 의 R8 안 D8
# (2026-11-01 부터. 받은 jar 는 sha1 로 확인한다. 예전 dalvik-dx 는 Maven Central 이 막을 때가 있어 바꿈).
set -e
cd "$(dirname "$0")"
OUT=${OUT:-/tmp/excer_dump_build}
R8_VER=8.5.35
R8_SHA1=6b41e4ac5e238c953246d07c006585aecc16c546
R8="$OUT/../r8-$R8_VER.jar"
rm -rf "$OUT" && mkdir -p "$OUT/stubcls" "$OUT/build"
[ -f "$R8" ] || curl -sSfL -o "$R8" https://dl.google.com/android/maven2/com/android/tools/r8/$R8_VER/r8-$R8_VER.jar
echo "$R8_SHA1  $R8" | sha1sum -c - >/dev/null
javac -encoding UTF-8 --release 8 -d "$OUT/stubcls" $(find stubs -name '*.java')
for C in ExcerDump ExcerClick; do
  mkdir -p "$OUT/build/$C" "$OUT/dex/$C"
  javac -encoding UTF-8 --release 8 -cp "$OUT/stubcls" -d "$OUT/build/$C" $C.java
  java -cp "$R8" com.android.tools.r8.D8 --min-api 26 --no-desugaring --output "$OUT/dex/$C" $(find "$OUT/build/$C" -name '*.class')
done
python3 - "$OUT" <<'PY'
import base64, hashlib, io, sys, zipfile
out = sys.argv[1]
for cls, jar, b64 in (("ExcerDump", "excer_dump.jar", "jar.b64"), ("ExcerClick", "excer_click.jar", "click.b64")):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        zi = zipfile.ZipInfo("classes.dex", date_time=(2026, 10, 1, 0, 0, 0)); zi.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(zi, open("%s/dex/%s/classes.dex" % (out, cls), "rb").read())
    open(out + "/" + jar, "wb").write(buf.getvalue())
    open(out + "/" + b64, "w").write(base64.b64encode(buf.getvalue()).decode())
    print(out + "/" + b64, hashlib.sha1(buf.getvalue()).hexdigest())
PY
