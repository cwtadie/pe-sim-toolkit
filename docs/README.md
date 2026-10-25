# 文档与验证方法

- [实验台完整说明](../examples/buck-boost-lab/README.md)：参数、接口和数值模型。
- [学习说明](../examples/buck-boost-lab/学习说明.md)：Buck 与 Boost 推导。
- [历史验证报告](../examples/buck-boost-lab/验证报告.md)：2026-10-17 的 MATLAB 与浏览器验证记录。
- [发布说明](发布说明.md)：公开范围和本次验证边界。

## 数值检查

在仓库根目录执行 `npm test`，运行 Buck 和 Boost 数值检查；执行 `npm run test:cross`，与已有 MATLAB 输出比较。需要 Node.js 22 或更高版本；公开版本本地使用 Node.js 24.15.0 验证。无需安装 npm 包。

测试会重写实验台 `validation/` 中相应的 JavaScript 和跨端 JSON 结果。已有 MATLAB 结果不会被这些命令重新生成。

## 浏览器检查（可选）

日常打开网页无需依赖。只有自动化检查需要安装 Playwright，并准备 Chromium 浏览器。

1. 在仓库根目录执行 `npm install --no-save --package-lock=false playwright`，仅安装本地验证依赖。
2. Windows 默认使用标准安装位置的 Chrome；其他 Chromium 安装位置可通过进程环境变量 `BUCK_BROWSER` 指定。
3. 执行 `npm run test:browser`。脚本以离线 `file://` 模式打开网页，检查交互、参数导入导出和多种视口宽度。

浏览器检查会更新对应 JSON 报告与 PNG 截图，并在 `validation/downloads/` 生成测试下载文件。这些临时下载和 `node_modules/` 已被 Git 忽略。手机宽度模拟不等于实体手机测试。

## MATLAB 检查（可选）

在 MATLAB 中运行实验台 `matlab/run_buck_lab.m` 与 `matlab/run_boost_lab.m`，再回到仓库根目录执行 `npm run test:cross`。脚本会更新计算结果和 MATLAB 验证 JSON。基础 MATLAB 即可，历史实测版本为 R2025b。

本次发布准备是否重新运行 MATLAB 或浏览器，以发布说明为准；保留历史证据不等于重新执行。
