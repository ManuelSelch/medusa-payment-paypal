# 发布指南

## 📦 发布到 npm

### 1. 修改 package.json

将 scope 改为你的 npm 组织或用户名：

```json
{
  "name": "@yourscope/medusa-payment-paypal",
  // 或者去掉 scope 使用
  "name": "medusa-payment-paypal"
}
```

### 2. 登录 npm

```bash
npm login
```

### 3. 构建并发布

```bash
# 构建
npm run build

# 检查将要发布的文件
npm pack --dry-run

# 发布
npm publish --access public
```

### 4. 后续更新

```bash
# 更新版本号
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0

# 发布新版本
npm publish
```

## 🔧 本地测试

### 方法 1: npm link

在包目录：
```bash
cd medusa-payment-paypal
npm link
```

在你的 Medusa 项目：
```bash
npm link @yourscope/medusa-payment-paypal
```

### 方法 2: 本地路径

在 medusa-config.ts：
```typescript
{
  resolve: "file:../medusa-payment-paypal",
  id: "paypal",
  options: { ... }
}
```

## 📝 发布检查清单

- [ ] 更新版本号 (`npm version`)
- [ ] 更新 CHANGELOG.md
- [ ] 运行测试 (`npm test`)
- [ ] 构建成功 (`npm run build`)
- [ ] 检查 package.json 信息
  - [ ] name
  - [ ] version
  - [ ] description
  - [ ] author
  - [ ] repository
  - [ ] keywords
- [ ] README.md 完整
- [ ] LICENSE 文件存在
- [ ] .npmignore 正确配置
- [ ] 发布 (`npm publish`)
- [ ] 创建 Git tag (`git tag v1.0.0 && git push --tags`)

## 🌐 发布到 GitHub

```bash
# 创建 GitHub 仓库
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/medusa-payment-paypal.git
git push -u origin master

# 创建 release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

## 📊 npm 统计

发布后可以在以下地方查看：
- https://www.npmjs.com/package/@yourscope/medusa-payment-paypal
- https://npm.io/@yourscope/medusa-payment-paypal

