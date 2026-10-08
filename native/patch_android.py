# -*- coding: utf-8 -*-
"""在 `npx cap add android` 之后运行:加入版本号/签名配置,并放入原生打印插件。
任何一处替换没有命中就直接报错退出,避免静默构出错误的 APK。"""
import pathlib, shutil, sys

root = pathlib.Path(__file__).resolve().parent.parent
gradle = root / "android/app/build.gradle"
s = gradle.read_text(encoding="utf-8")

OLD_VER = '''        versionCode 1
        versionName "1.0"'''
NEW_VER = '''        // 版本号由 GitHub Actions 通过环境变量传入
        versionCode Integer.parseInt(System.getenv("VERSION_CODE") ?: "1")
        versionName(System.getenv("VERSION_NAME") ?: "1.0.0")'''
OLD_BT = '''    buildTypes {
        release {
            minifyEnabled false'''
NEW_BT = '''    signingConfigs {
        release {
            // 签名密钥库来自 GitHub Secrets
            def ksFile = System.getenv("KEYSTORE_FILE")
            if (ksFile) {
                storeFile file(ksFile)
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias "familystudy"
                keyPassword System.getenv("KEYSTORE_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            if (System.getenv("KEYSTORE_FILE")) {
                signingConfig signingConfigs.release
            }
            minifyEnabled false'''
for old, new in ((OLD_VER, NEW_VER), (OLD_BT, NEW_BT)):
    if old not in s:
        sys.exit("补丁失败:build.gradle 模板与预期不一致:\n" + old)
    s = s.replace(old, new)
gradle.write_text(s, encoding="utf-8")

dst = root / "android/app/src/main/java/com/lin/familystudy"
if not dst.is_dir():
    sys.exit("补丁失败:找不到 " + str(dst))
for f in ("PrintPlugin.java", "MainActivity.java"):
    shutil.copy(root / "native" / f, dst / f)
print("patch ok")
