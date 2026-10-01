#!/bin/sh
# excer_bot.py 안의 DUMPER_JAR(화면 읽기 도우미)를 다시 만든다. 개발 PC 에서(JDK 와 인터넷 필요), 태블릿에서는 할 필요 없음.
#   sh tools/excer_dump/build.sh   ->  excer_dump.jar 와 그 base64(jar.b64)를 만든다. jar.b64 를 excer_bot.py 의 DUMPER_JAR 에 넣는다.
# stubs/ 는 컴파일에만 쓰는 껍데기다(기기에서는 진짜 안드로이드 것이 쓰인다). dex 로 바꾸는 도구는 dalvik-dx(Maven Central).
set -e
cd "$(dirname "$0")"
OUT=${OUT:-/tmp/excer_dump_build}
rm -rf "$OUT" && mkdir -p "$OUT/stubcls" "$OUT/build"
[ -f "$OUT/../dalvik-dx-16.0.1.jar" ] || curl -sSfL -o "$OUT/../dalvik-dx-16.0.1.jar" https://repo1.maven.org/maven2/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar
javac -encoding UTF-8 --release 8 -d "$OUT/stubcls" $(find stubs -name '*.java')
javac -encoding UTF-8 --release 8 -cp "$OUT/stubcls" -d "$OUT/build" ExcerDump.java
java -cp "$OUT/../dalvik-dx-16.0.1.jar" com.android.dx.command.Main --dex --min-sdk-version=26 --output="$OUT/classes.dex" "$OUT/build"
python3 - "$OUT" <<'PY'
import base64, hashlib, io, sys, zipfile
out = sys.argv[1]
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
    zi = zipfile.ZipInfo("classes.dex", date_time=(2026, 10, 1, 0, 0, 0)); zi.compress_type = zipfile.ZIP_DEFLATED
    z.writestr(zi, open(out + "/classes.dex", "rb").read())
open(out + "/excer_dump.jar", "wb").write(buf.getvalue())
open(out + "/jar.b64", "w").write(base64.b64encode(buf.getvalue()).decode())
print(out + "/jar.b64", hashlib.sha1(buf.getvalue()).hexdigest())
PY
