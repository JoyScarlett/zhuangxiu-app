# GitHub Pages 部署说明

这个项目是纯静态网页，直接用 GitHub Pages 托管即可。

## 第一次部署

1. 在 GitHub 新建仓库，例如 `zhuangxiu-app`。
2. 把本地项目推送到 `main` 分支根目录。
3. 进入仓库 `Settings` -> `Pages`。
4. `Build and deployment` 的 `Source` 选择 `Deploy from a branch`。
5. `Branch` 选择 `main`，目录选择 `/ root`。
6. 保存后等待 1-3 分钟，网站会发布到：

```text
https://你的GitHub用户名.github.io/zhuangxiu-app/
```

## 以后更新

以后只需要提交并推送代码：

```bash
git add .
git commit -m "Update site"
git push
```

推送后 GitHub Pages 会自动重新部署。

## 关于令牌

只有在这台电脑第一次 `git push` 到 GitHub 时，可能需要登录 GitHub 或输入个人访问令牌。登录成功后，Git Credential Manager 通常会保存凭据，后面更新网站一般不用重新输入。
