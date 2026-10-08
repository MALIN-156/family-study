# 家庭学习 Android 应用

给孩子每天打卡、给家长记错题和看汇总的手机 APP。数据只存在手机里,不需要电脑和网络(只有"检查更新"需要联网)。

- 孩子页:选自己 → 点大卡片打卡
- 家长页(默认 PIN 1234,进去先改):总览、错题归因、任务、沟通话术、备份、检查更新
- 打印:一周安排、待订正错题单,走安卓系统打印(可选家里的打印机或存成 PDF)

## 一、第一次上线(只做一次)

我这边的云端环境连不上 Android 官方构建工具,所以 APK 由 GitHub 的免费云服务器来构建。

**1. 注册 GitHub 账号**:打开 https://github.com 注册,用邮箱验证。免费版就够。

**2. 新建仓库**:右上角 `+` → New repository
- Repository name:`family-study`
- 选 **Public**(公开)。原因:手机里的"检查更新"要读取这个仓库的发布信息,私有仓库读不到。仓库里只有程序代码,没有任何孩子的打卡数据(数据只在手机里)。
- 勾上 "Add a README file"(这样能进入文件管理页),点 Create repository。

**3. 上传文件**:进入仓库 → Add file → Upload files。把本文件夹里的**全部内容**(`.github`、`native`、`www` 三个文件夹和 `package.json`、`package-lock.json`、`capacitor.config.json`、`VERSION`、`.gitignore`、`README.md`)拖进去,点 Commit changes。
- 如果拖不上 `.github`(以点开头的文件夹),可以在仓库里 Add file → Create new file,文件名输入 `.github/workflows/build-apk.yml`,把本地同名文件内容粘贴进去。
- **不要**上传 `family_study_android_SECRETS` 文件夹。

**4. 添加签名密钥**(这是 APP 的"身份证",以后每次更新都用同一个):仓库 → Settings → Secrets and variables → Actions → New repository secret,添加两个:
- 名称 `KEYSTORE_B64`,内容:用记事本打开 `family_study_android_SECRETS\keystore.b64.txt`,全选复制粘贴(一整行)
- 名称 `KEYSTORE_PASSWORD`,内容:`family_study_android_SECRETS\password.txt` 里的一行密码

**5. 开始构建**:仓库 → Actions → 左边点"构建并发布 APK" → Run workflow → Run workflow。等 5-10 分钟,变成绿色对勾就成功了。
- 如果出现红色叉:点进去,把报错那一段文字复制给我,我来改。

**6. 下载安装**:仓库右侧 Releases → 点最新的"家庭学习 1.0.0" → 下载 `family-study-1.0.0.apk` → 发到手机上点开安装。第一次需要允许"安装未知来源应用"(小米手机会多弹几次安全提示,选"继续安装")。

## 二、以后怎么更新

1. 改好内容(我会给你改过的文件)。在仓库里点进对应文件 → 铅笔图标 → 粘贴 → Commit。
2. 把仓库根目录的 `VERSION` 文件改成更大的版本号(例如 `1.0.0` → `1.0.1`),提交。**只有改 VERSION 才会触发新构建。**
3. 等构建变绿。手机里打开 APP → 家长入口 → 会看到"有新版本" → 下载并安装,**打卡数据会保留**。

## 三、必须保管好

- `family_study_android_SECRETS` 文件夹里的 `release.jks` 和 `password.txt`:**请另外备份一份到网盘或U盘**。丢了就无法给已安装的 APP 做更新,只能卸载重装(卸载会丢数据)。
- 不要把这个文件夹上传到 GitHub,也不要发给别人。

## 四、备份手机数据

家长页 → 设置 → 复制备份文本 → 发给自己保存。换手机或重装时,在设置里粘贴恢复。
