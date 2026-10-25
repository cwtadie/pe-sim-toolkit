# 电源学习实验台：Buck 与 Boost

离线网页与 MATLAB 脚本工程：用同一组参数对照理想非同步 Buck 的周期稳态开关模型和 CCM 平均模型。开始使用请看 [明早先看这里](明早先看这里.md)。

第二站 [Boost 升压实验](boost.html) 已加入：导通/关断联动、连续导通（CCM）/断续导通（DCM）、四步引导、6 道自测、频响和真实占空比阶跃。Buck 模型与 MATLAB 工程完整保留。

本目录是 `pe-sim-toolkit` 的完整示例，遵循仓库根目录的 [MIT 许可证](../../LICENSE)。公开版本的验证范围见 [发布说明](../../docs/发布说明.md)；下文关于 R2025b 和浏览器的实测描述对应 2026-10-17 历史记录。

## 打开与运行

- **网页**：双击 `index.html`。根目录的 JS、CSS 文件须与它放在同一目录。无需服务器、联网或安装 npm 包。
- **MATLAB**：打开并运行 `matlab/run_buck_lab.m`。使用 MATLAB 基础功能，无需额外安装工具箱。实际验证版本为 R2025b；其他版本未实测。
- **看现成结果**：`results/matlab-waveforms.png`、`results/matlab-frequency.png`；同目录保留 CSV、参数和指标 JSON。
- **看解释**：网页的“推导手册”和“自测一下”；纯文本推导另存为 `学习说明.md`。

## 参数与数据接口

### 新手引导（2026-10-17 补充）

按用户选择“从开关状态开始、吃透 Buck 基础、讲解＋动手任务”加入四步练习：导通、续流、只改变占空比、拼出平均方程。先点选预测，再观察或调参，平台提供错误原因和重试入口。第三步必须亲手将默认占空比改为 0.50，其余参数保持默认，预测和数值检查都通过才算完成。学习进度仅在本次打开期间保留，不自动持久化。

电路下方新增周期观察滑块，与现有电压、电流图上的第一个周期竖线联动；同时显示电感电压、当前电流趋势及电容充放电状态。播放为 6 秒慢放一个周期，结束自动停止；系统启用减少动态效果时使用手动滑块。模型仍为周期稳态，不把参数前后比较解释成阶跃过程。原有频响和 MATLAB 工程保留，此轮没有加入闭环或新增数值模型。

引导层通过 `BuckLab.refreshParameters()` 读取当前有效参数，并用 `buck:updated`、`buck:drawn`、`buck:tab` 事件同步现有图示；`learning.js` 与 `learning.css` 为新增的本地资源。

### 共享参数

所有 JSON 文件和 CSV 列均使用 SI 单位。界面为了阅读，把电感、电容和开关频率显示为 µH、µF、kHz；载入、导出时自动换算。

| 字段 | 物理量 | JSON 单位 | 默认值 | 支持范围 |
|---|---|---|---:|---|
| Vg | 输入电压 | V | 24 | 6–48 |
| D | 占空比 | 无量纲 | 0.4 | 0.05–0.95 |
| L | 电感 | H | 0.00022 | 22–2200 µH |
| C | 电容 | F | 0.00047 | 47–2200 µF |
| R | 电阻负载 | Ω | 5 | 1–100 |
| fs | 开关频率 | Hz | 20000 | 20–100 kHz |

网页每次打开使用程序内置的默认参数，不自动读取旁边的 JSON；通过“载入参数 JSON”同步你修改过的文件。MATLAB 每次运行读取根目录 `parameters.json`。网页导出的 JSON 可以改名为该文件，供 MATLAB 使用。

波形 CSV 列：`t_s,v_sw_V,i_sw_A,v_avg_V,i_avg_A,gate`。`gate` 是导通指令：t < DTs 为 1，否则为 0；周期终点的下一周期起点在重复显示时才重新置 1。每个导通段、关断段默认各 128 个采样间隔；DCM 额外插入电流触零时刻。

频响 CSV 列：`f_Hz,gain_dB,phase_deg`。增益 dB 以 1 V / 单位占空比为参考；不是电压输入到电压输出的无量纲比值。

MATLAB 调用示例（当前文件夹设为 `matlab/`）：

```matlab
p = jsondecode(fileread('../parameters.json'));
result = buck_model(p);       % 默认每段 128 个间隔
fine = buck_model(p,256);     % 加密采样
freq = buck_frequency(p);     % 仅适用于 CCM 平均模型
disp(result.metrics)
```

`result.rows` 是带单位列名的 MATLAB table；`result.metrics` 包含导通模式、均值、峰峰纹波、固有频率、Q、零电流比例和周期残差。网页核心 `BuckModel.simulate(p,128)` 返回同样含义的指标与行对象数组。

## 模型、边界和数值方法

状态 x = [iL, v]ᵀ。导通及二极管续流阶段均求解真实分段状态微分方程；网页用二阶矩阵指数解析式，MATLAB 用 `expm` 精确推进各段。CCM 用线性周期映射求不动点，DCM 用二分法求含零电流事件的周期不动点。

这不是用 V = DVg 画出的开关波形。均值和纹波由微分方程的周期解计算；CCM 平均线才使用 V = DVg。DCM 电流降到零后，按 iL = 0 与电容放电拼接。默认从周期稳态开始，不模拟上电、死区、器件应力或控制闭环。

传递函数 Gvd(s) = Vg/(1+sL/R+s²LC) 是 CCM 平均模型的小信号结果；DCM 时仅作明确标注的数学参照。f > fs/10 的阴影区域属于教学上的保守高频提示，并非精确的误差分界。不能把 f₀ 当成闭环带宽。

默认独立验证还使用 RK4 和事件感知 `ode45`，没有用同一矩阵指数计算冒充独立验证。采样加密主要检查梯形均值和波形采样；段内解析推进本身没有常规固定步长积分的截断误差。

不含开关压降、ESR、寄生参数、饱和、损耗、热模型或实体硬件测试。参数范围以基础教学为目标，真实器件选型需要另行建模。

## 重新验证

基本计算与两端对照需要 Node；浏览器检查另需本地 Playwright 与 Chrome。用户正常使用网页不需要这些工具。

```powershell
node validation/verify-model.cjs
matlab -batch "run('matlab/run_buck_lab.m')"
node validation/compare-results.cjs
node validation/verify-browser.cjs
```

最后一项需要 `playwright` 能被 Node 找到。仓库根目录的 [验证方法](../../docs/README.md) 给出了可选安装与运行步骤；日常打开网页无需依赖。脚本默认使用 Windows Chrome 的标准安装路径；也可设置进程环境变量 `BUCK_BROWSER` 指向其他 Chromium 浏览器。

验收测试始终检查固定默认工况与固定轻载工况；MATLAB 另外根据当前根目录参数生成结果。跨端脚本也会比较当前参数的导出数据。浏览器自测会自动尝试 8/8 和 7/8 两种评分情形，保留截图仅作测试证据，不代表你的学习成绩。

## 文件与整理

- 根目录：网页源文件、共享参数、使用和学习说明、验证报告。
- `matlab/`：可运行脚本、模型函数与独立验证函数。
- `results/`：实际运行生成的可用图表和数据。
- `validation/`：可重跑验证脚本、机器可读结果和四张页面截图。

本示例由 `pe-sim-toolkit` 仓库统一管理，没有嵌套 Git 仓库。保留计算数据、历史验证报告和截图；浏览器测试生成的临时下载目录不纳入版本控制。

## 资料来源

默认参数与学习顺序最初来自作者的《Buck 平均模型》笔记；公开版本所需的推导与参数均已写入 [学习说明](学习说明.md) 和本目录参数 JSON，不依赖作者的私人资料目录。补充核对参考 [MathWorks Average-Value DC-DC Converter](https://www.mathworks.com/help/simscape-electrical/ref/averagevaluedcdcconverter.html) 与 [Buck Converter](https://www.mathworks.com/help/simscape-electrical/ref/buckconverter.html)。正文、电路图、代码与自测为本项目制作，无外部字体、图片或在线脚本依赖。外部参考资料保持原作者的权利，不适用本仓库的 MIT 许可证。

## Boost 使用与接口

- **网页**：双击 `boost.html`，或在 Buck 首页点“下一站：Boost”。同目录的 `boost-model.js`、`boost.js`、`boost.css` 及共享 CSS 必须一并保留。
- **MATLAB**：打开运行 `matlab/run_boost_lab.m`。本机 R2025b 已实跑；使用基础 MATLAB，不需要安装新工具箱。结果在 `results/boost/`。
- **默认工况**：Vg=24 V、D=0.40、L=220 µH、C=470 µF、R=20 Ω、fs=20 kHz。采用20 Ω负载以便观察24 V到约40 V的升压过程，Buck默认参数未更改。
- **JSON**：字段名及 SI 单位与 Buck 相同，但 Boost 使用独立的 `boost-parameters.json`。把网页导出的 Boost 参数复制到该文件，再运行 MATLAB；请勿覆盖 Buck 的 `parameters.json`。
- **范围**：Vg=6–48 V，D=0.10–0.70，L=47–2200 µH，C=100–2200 µF，R=5–200 Ω，fs=20–100 kHz。它们是理想教学计算范围，不是实际器件额定范围。

稳态接口：`BoostModel.simulate(p,128)` / MATLAB `boost_model(p,128)`。返回 `parameters`、`metrics`、`rows`。均值通过每段 ODE 的积分恒等式计算，采样用于波形、峰值和 RMS；CCM 线性周期映射与 DCM 触零事件分别处理。空闲段中若电压降至输入以下导致二极管重新导通，则明确报错，不输出虚假的空闲状态结果。

波形 CSV 列：`t_s,v_V,iL_A,vL_V,iC_A,iD_A,iS_A,gate,region`。`region` 为 1=导通、2=关断续流、3=零电流；`gate` 为导通指令。频响 CSV 列为 `f_Hz,gain_dB,phase_deg`，相位已展开，可以低于−180°。DCM 下导出的频响仍只是显式标注的 CCM 数学参照。

阶跃接口：`BoostModel.step(p,0.02)` / MATLAB `boost_step(p,0.02)`。默认在t=0的周期边界把D增加0.02；支持0<Δd≤0.05、最终D≤0.70，阶跃前后必须均为CCM。开关模型保留原周期轨道的电感、电容状态；CCM平均模型从其自身的直流平衡点开始。

阶跃 CSV 列：`t_s,v_sw_mean_V,i_sw_mean_A,v_avg_V,i_avg_A,D`。绿线数值是开关微分方程在每个周期上的真实积分均值，时间戳是周期中点；橙线是连续时间平均方程在同一时刻的解。阶跃前保留10个周期，之后的观察窗口为 max(20 ms,10RC)，上限250 ms；观察窗末点不保证完全稳态，长期稳态另外求解。最初100 µs图分别减去各自阶跃前均值，不把两种模型的稳态近似差当作逆响应。

修改参数会清除旧阶跃图并禁用旧CSV导出；输入不合法、DCM或最终D超范围时给出解释。若阶跃过程中触零，开关模型仍按二极管事件求解，平均模型只作参照。MATLAB在不适用阶跃演示的工况下清理其自身旧的3个阶跃结果文件，避免把上一次结果当作当前输出。

初始逆响应可能短于一个开关周期。若当前周期均值未分辨出下降，网页会明确提示，不会把正变化写成负的“下降量”；默认工况已实际分辨出初始下降。阶跃前后都是CCM也不保证过渡期间始终CCM，过程触零时网页和MATLAB均提示平均曲线只是参照。

```powershell
node validation/verify-boost.cjs
matlab -batch "run('matlab/run_boost_lab.m')"
node validation/compare-boost.cjs
node validation/verify-boost-browser.cjs
```

浏览器验证依赖与原 Buck 验证相同。各数值测试的默认/轻载工况是固定验收样例；跨端 CSV 比较另读取当前 `boost-parameters.json`。当前工况不适合阶跃时，跨端脚本会检查没有残留旧阶跃CSV。Boost 的实际数值、浏览器检查和截图见 `验证报告.md` 的 Boost 扩展部分。

平均模型和控制限制补充参考 [MathWorks Boost Converter](https://www.mathworks.com/help/simscape-electrical/ref/boostconverter.html) 与 [TI: Switch-mode Power Converter Compensation Made Easy](https://e2e.ti.com/cfs-file/__key/communityserver-discussions-components-files/196/0412.slup340.pdf)。这一轮仅加入Boost；反相Buck-Boost、同步Buck与DAB均列为后续模块，尚未实现。
