# pe-sim-toolkit：Buck 与 Boost 交互学习实验台

面向电力电子入门的开源教学项目：在离线网页中观察 Buck（降压）与 Boost（升压）变换器的开关状态、波形和频率响应，再用 MATLAB 脚本对照数值结果。

当前已实现的是 **Buck 与 Boost 理想非同步变换器**。本仓库尚未实现 DAB、逆变器、闭环控制器或 Python 模型；`src/` 仅为后续公共代码预留。

## 立即使用

1. 在 GitHub 点击 **Code → Download ZIP**，解压全部文件。
2. 用 Chrome 或 Edge 打开 `examples/buck-boost-lab/index.html`，从 Buck 四步引导开始。
3. 点击“下一站：Boost”，或打开同目录的 `boost.html`。

网页无需服务器、联网、Node.js、MATLAB 或 npm 依赖。请保留 HTML 旁的 JavaScript 和 CSS 文件；GitHub 仓库的源码预览不会直接运行 HTML。

- [入门步骤](examples/buck-boost-lab/明早先看这里.md)
- [实验台完整说明](examples/buck-boost-lab/README.md)
- [方程推导与学习说明](examples/buck-boost-lab/学习说明.md)
- [原始验证报告](examples/buck-boost-lab/验证报告.md)
- [公开版本的验证范围](docs/发布说明.md)

## 已有功能

- Buck 与 Boost 的开关状态、电流路径、周期观察和参数调节。
- 连续导通模式（CCM）和断续导通模式（DCM）的周期稳态模型。
- 四步引导、Buck 8 道自测与 Boost 6 道自测。
- 连续导通平均模型的频率响应，以及 Boost 占空比阶跃演示。
- 参数 JSON 导入导出、波形和频响 CSV 导出。
- MATLAB 数值模型、已有计算图表、Node.js 验证脚本和浏览器验证脚本。

## MATLAB 使用

运行 `examples/buck-boost-lab/matlab/run_buck_lab.m` 或 `run_boost_lab.m`。脚本使用基础 MATLAB，无需 Simulink 或额外工具箱；历史实测版本为 R2025b，其他版本未验证。

先修改实验台目录中的 `parameters.json`（Buck）或 `boost-parameters.json`（Boost），再运行对应脚本。运行会更新 `results/` 和相关验证结果；只看图时直接打开现有 PNG 即可。

## 开发者验证

安装 Node.js 后，在仓库根目录执行 `npm test`，运行两种模型的数值验证；执行 `npm run test:cross`，与仓库保留的 MATLAB 导出数据比较。这两个命令无需安装 npm 包。

跨端对照通过表示 JavaScript 与已有 MATLAB 数据一致，不等于本次重新启动了 MATLAB。浏览器自动化另需 Playwright 和 Chromium，具体方法见[验证方法](docs/README.md)。

## 文件位置

- `examples/buck-boost-lab/`：完整、可独立复制的网页、MATLAB 模型、参数和中文说明。
- `examples/buck-boost-lab/results/`：计算得到的 CSV、PNG、参数及指标。
- `examples/buck-boost-lab/validation/`：验证脚本、机器可读结果和页面截图。
- `docs/`：使用、发布范围与验证说明。
- `src/`：预留目录，目前没有独立的通用控制算法实现。

## 适用边界

所有波形和数据都是理想电路的计算结果，不是实测数据。模型不含损耗、寄生参数、器件饱和、热效应、启动过程或闭环补偿。连续导通平均模型不能直接用于断续导通或任意高频预测。请勿把教学结果直接当作硬件设计、安全评估或器件选型依据。

## 许可证与来源

本项目采用 [MIT License](LICENSE)。引用的 MathWorks 和 Texas Instruments 文档保持原作者权利，仓库只提供参考链接，不包含其文献原文。MIT 许可不覆盖这些外部资料。模型符号、默认参数和项目内推导见实验台说明。
