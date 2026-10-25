/* Beginner learning layer. Uses the existing solver and charts without
 * changing their equations. Progress is session-only; no network/storage. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const lab = window.BuckLab;
  let step = 0, phase = 10, frame = 0, startedAt = 0, experimentReady = false;
  const completed = new Set();
  const selected = [null, null, null, null];
  const steps = [
    {
      title: '开关闭合：输入把能量送到哪里？',
      text: '先沿图中的回路走一遍：输入正端 → 开关 S → 电感 L → 输出支路 → 输入负端。默认工况下电感两端为 24 − 9.6 ≈ 14.4 V，所以电感电流向上爬升。电容承担的是电感电流与负载电流的差。',
      question: '默认工况导通时，电感电流会怎样？',
      options: ['逐渐增大', '瞬间变成零', '因为有电容，所以完全不变'],
      correct: 0,
      explanation: 'L·diL/dt = Vg−v。默认 Vg 大于 v，斜率为正，电流逐渐增大。电感电流不能因开关动作瞬间跳变。',
      hint: '别只盯着开关。先算电感左右两端的电压差，再判断电流斜率。'
    },
    {
      title: '开关断开：电流为什么还能继续？',
      text: '电感里已经有电流，断开输入并不会把它立即抹掉。二极管建立续流回路：电感 → 输出支路 → 公共回线 → 二极管 → 电感。此时电感释放储存的能量，继续供给负载。',
      question: '电感仍在续流时，正确的电压与电流变化是？',
      options: ['电感电压为 0，电流保持不变', '电感电压约为 −v，电流逐渐减小', '输入断开，输出立刻变成零'],
      correct: 1,
      explanation: '续流二极管把电感左端钳在 0 V，右端仍是输出 v。vL = 0−v = −v，因此 diL/dt < 0；电感电流和电容电压都连续变化。',
      hint: '二极管钳住的是电感左端。电感两端电压要用“左端减右端”。'
    },
    {
      title: '先预测，再亲手改变占空比',
      text: '以默认工况开始，只把占空比从 0.40 调到 0.50，让开关在每个周期里闭合更久。先选择预测，再点“准备实验”，然后亲手调节左侧占空比并检查结果。',
      question: '保持其他参数不变，平均输出会怎样？',
      options: ['从 9.6 V 上升到约 12 V', '从 9.6 V 下降到约 8 V', '仍为 9.6 V，只改变纹波'],
      correct: 0,
      explanation: 'CCM 稳态下，电感导通期间的正伏秒与续流期间的负伏秒平衡：D(Vg−V)+(1−D)(−V)=0。所以 V=DVg=0.50×24=12 V。这是两组周期稳态的比较，不是阶跃瞬态。',
      hint: '闭合时间增加，输入在一个周期里供能更久。结合电感伏秒平衡重新预测。'
    },
    {
      title: '把两个状态拼成平均方程',
      text: '不需要先背传递函数。导通段的电感电压是 Vg−v，续流段是 −v。按两个区间分别占周期的 d 和 1−d 加权，先得到平均电感电压。',
      question: 'd(Vg−v) + (1−d)(−v) 化简后是什么？',
      options: ['Vg−dv', 'dVg−v', 'd(Vg−v)'],
      correct: 1,
      explanation: '展开：dVg−dv−v+dv=dVg−v。于是 L·dīL/dt=dVg−v̄；输出节点再列 C·dv̄/dt=īL−v̄/R。稳态令平均导数为零，得到 V=DVg、IL=V/R。',
      hint: '把括号全部展开。两项 dv 正负相消，续流段的 −v 不能漏掉。'
    }
  ];
  const panel = document.createElement('section');
  panel.id = 'learning'; panel.className = 'panel learn-panel';
  panel.innerHTML = '<div class="section-heading"><div><p class="eyebrow">从零入门 / 先理解，再列式</p><h2>跟着做：四步吃透 Buck 基础</h2></div><span id="learn-progress" class="tag" role="status"></span></div><p class="muted small">适合刚开始理解导通与续流。先选预测，再观察电路与波形；选错会提示原因，可以重新尝试。</p><div id="learn-steps" class="learn-steps" aria-label="学习步骤"></div><h3 id="learn-title"></h3><p id="learn-text" class="learn-text"></p><fieldset id="learn-question"><legend id="learn-prompt"></legend><div id="learn-options"></div></fieldset><div class="learn-actions"><button id="learn-observe" class="button secondary">用默认参数看状态 ↓</button><button id="learn-prepare" class="button secondary" hidden>准备实验：恢复默认参数</button><button id="learn-check" class="button primary">检查我的理解</button></div><div id="learn-feedback" class="learn-feedback" role="status" hidden></div><div class="learn-actions"><button id="learn-next" class="text-button">下一步 →</button><button id="learn-reset" class="text-button">重做四步练习</button></div><p class="tiny muted">进度仅在本次打开期间保留；刷新会清空，不记录为考试成绩。</p>';
  $('circuit-panel').before(panel);
  const phaseBox = document.createElement('div');
  phaseBox.className = 'learn-phase';
  phaseBox.innerHTML = '<label for="learn-phase">沿一个周期慢慢看 <span id="learn-phase-time"></span></label><input id="learn-phase" type="range" min="0" max="100" step="1" value="10" aria-label="周期观察位置"><div class="learn-phase-actions"><button id="learn-on" class="button secondary">看导通</button><button id="learn-off" class="button secondary">看续流</button><button id="learn-play" class="button secondary">播放一个周期</button></div><p id="learn-phase-detail" class="learn-phase-detail"></p><p id="learn-motion-note" class="tiny muted"></p>';
  $('circuit-caption').after(phaseBox);
  const startLink = document.createElement('a');
  startLink.href = '#learning'; startLink.className = 'learn-start';
  startLink.textContent = '第一次学？从四步引导开始 →';
  document.querySelector('.hero-desc').after(startLink);
  startLink.addEventListener('click', () => lab.showTab('lab'));
  const labels = ['1 导通', '2 续流', '3 调参', '4 平均'];
  labels.forEach((label, j) => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label;
    button.addEventListener('click', () => { step = j; render(); });
    $('learn-steps').appendChild(button);
  });
  function render() {
    const lesson = steps[step];
    $('learn-progress').textContent = completed.size + ' / 4 已完成';
    Array.from($('learn-steps').children).forEach((button, j) => {
      button.setAttribute('aria-pressed', String(j === step));
      button.textContent = labels[j] + (completed.has(j) ? ' ✓' : '');
    });
    $('learn-title').textContent = lesson.title;
    $('learn-text').textContent = lesson.text;
    $('learn-prompt').textContent = lesson.question;
    $('learn-options').replaceChildren();
    lesson.options.forEach((text, j) => {
      const label = document.createElement('label'); label.className = 'choice';
      const radio = document.createElement('input');
      radio.type = 'radio'; radio.name = 'learning-answer'; radio.value = j;
      radio.checked = selected[step] === j;
      radio.addEventListener('change', () => {
        selected[step] = j; $('learn-feedback').hidden = true;
      });
      label.append(radio, document.createTextNode(text));
      $('learn-options').appendChild(label);
    });
    $('learn-feedback').hidden = true;
    $('learn-prepare').hidden = step !== 2;
    $('learn-observe').hidden = step > 1;
    $('learn-check').textContent = step === 2 ? '检查预测与调参结果' : '检查我的理解';
    $('learn-next').hidden = step === 3;
  }
  function feedback(text, success) {
    const box = $('learn-feedback'); box.hidden = false;
    box.classList.toggle('success', !!success); box.textContent = text;
  }
  $('learn-check').addEventListener('click', () => {
    if (selected[step] === null) {
      feedback('先点选一个预测，再检查。还没有选择不会扣分。', false); return;
    }
    const lesson = steps[step];
    if (selected[step] !== lesson.correct) {
      feedback('再想一想：' + lesson.hint + ' 正确解释：' + lesson.explanation, false); return;
    }
    if (step === 2) {
      if (!experimentReady) {
        feedback('预测方向正确。先点“准备实验”建立默认工况，再亲手改变占空比。', false); return;
      }
      lab.refreshParameters();
      if (!$('input-error').hidden) {
        feedback('先修正参数区的无效输入，再检查实验结果。', false); return;
      }
      const p = lab.result.parameters;
      const defaultOthers = Object.keys(BuckModel.defaults).every(k => k === 'D' || Math.abs(p[k] / BuckModel.defaults[k] - 1) < 1e-9);
      if (!defaultOthers || Math.abs(p.D - 0.5) > 1e-9) {
        feedback('预测方向正确。实验尚未完成：先点“准备实验”，只把占空比调到 0.50，保持其余默认参数，再检查。', false); return;
      }
      if (lab.result.metrics.mode !== 'CCM' || Math.abs(lab.result.metrics.Vmean - 12) > .12) {
        feedback('当前结果尚未满足 CCM、平均输出约 12 V 的条件，请检查参数。', false); return;
      }
    }
    completed.add(step);
    $('learn-progress').textContent = completed.size + ' / 4 已完成';
    Array.from($('learn-steps').children)[step].textContent = labels[step] + ' ✓';
    feedback('这一步完成。' + lesson.explanation + (completed.size === 4 ? ' 四步已完成！现在合上讲解，自己画两种回路，再尝试原有的 8 道自测。' : ''), true);
  });
  $('learn-prepare').addEventListener('click', () => {
    if (selected[step] === null) {
      feedback('先选一个预测，再准备实验。你可以选错，观察后再修改。', false); return;
    }
    experimentReady = true;
    stop(); lab.setParameters(BuckModel.defaults);
    feedback('已准备 24 V、D=0.40 的默认工况。接下来亲手把占空比改为 0.50；这一步不会替你调好。', false);
    $('num-D').focus(); $('num-D').scrollIntoView({block: 'center'});
  });
  $('learn-observe').addEventListener('click', () => {
    stop(); lab.setParameters(BuckModel.defaults); setPhaseForState(step);
    $('circuit-panel').scrollIntoView({block: 'start'});
  });
  $('learn-next').addEventListener('click', () => { step = Math.min(3, step + 1); render(); });
  $('learn-reset').addEventListener('click', () => {
    stop(); completed.clear(); selected.fill(null); experimentReady = false; step = 0; render();
  });
  function setPhaseForState(state) {
    const r = lab.result, d = r.parameters.D, z = r.metrics.zeroFraction;
    phase = 100 * (state === 0 ? d / 2 : state === 2 ? 1 - z / 2 : (d + 1 - z) / 2);
    $('learn-phase').value = phase; syncPhase();
  }
  function marker(chart) {
    const svg = $(chart).querySelector('svg'); if (!svg) return;
    let line = svg.querySelector('.learn-marker');
    if (!line) {
      line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'learn-marker'); line.setAttribute('pointer-events', 'none');
      svg.appendChild(line);
    }
    const rect = svg.querySelector('.frame');
    const x = +rect.getAttribute('x') + +rect.getAttribute('width') * phase / 300;
    line.setAttribute('x1', x); line.setAttribute('x2', x);
    line.setAttribute('y1', rect.getAttribute('y'));
    line.setAttribute('y2', +rect.getAttribute('y') + +rect.getAttribute('height'));
  }
  function syncPhase() {
    const r = lab.result; if (!r) return;
    const p = r.parameters, t = phase / 100 / p.fs;
    const zeroStart = (1 - r.metrics.zeroFraction) / p.fs;
    const state = t < p.D / p.fs ? 0 : r.metrics.mode === 'DCM' && t >= zeroStart ? 2 : 1;
    lab.setCircuitState(state);
    let j = 0; while (j < r.rows.length - 2 && r.rows[j + 1].t_s < t) j++;
    const a = r.rows[j], b = r.rows[j + 1];
    const weight = Math.max(0, Math.min(1, (t - a.t_s) / (b.t_s - a.t_s || 1)));
    const v = a.v_sw_V + weight * (b.v_sw_V - a.v_sw_V);
    const i = a.i_sw_A + weight * (b.i_sw_A - a.i_sw_A);
    const vL = state === 0 ? p.Vg - v : state === 1 ? -v : 0;
    const charge = i - v / p.R;
    $('learn-phase-time').textContent = (t * 1e6).toFixed(2) + ' µs / ' + (1e6 / p.fs).toFixed(2) + ' µs';
    $('learn-phase-detail').textContent = ['导通', '续流', '零电流'][state] + '：iL ≈ ' + i.toFixed(3) + ' A，v ≈ ' + v.toFixed(3) + ' V；' +
      (state === 2 ? '电感电流保持 0，电容独自供电。' : '电感电压约 ' + vL.toFixed(2) + ' V，电流' + (vL > 0 ? '增大' : '减小') + '；电容此刻' + (charge >= 0 ? '充电' : '放电') + '。') +
      ' 两张波形中的竖线对应这一时刻（第一个周期）。';
    marker('voltage-chart'); marker('current-chart');
  }
  function stop() {
    cancelAnimationFrame(frame); frame = 0;
    $('learn-play').textContent = '播放一个周期';
  }
  $('learn-phase').addEventListener('input', () => { stop(); phase = +$('learn-phase').value; syncPhase(); });
  $('learn-on').addEventListener('click', () => { stop(); setPhaseForState(0); });
  $('reset').addEventListener('click', () => { stop(); phase = 10; $('learn-phase').value = phase; syncPhase(); });
  $('learn-off').addEventListener('click', () => { stop(); setPhaseForState(1); });
  $('circuit-next').addEventListener('click', () => { stop(); setPhaseForState(lab.circuitState); });
  $('learn-play').addEventListener('click', () => {
    if (frame) { stop(); return; }
    startedAt = performance.now(); $('learn-play').textContent = '暂停观察';
    const tick = now => {
      phase = Math.min(100, (now - startedAt) / 60);
      $('learn-phase').value = phase; syncPhase();
      if (phase < 100) frame = requestAnimationFrame(tick); else stop();
    };
    frame = requestAnimationFrame(tick);
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function motionPreference() {
    if (reduced.matches) stop();
    $('learn-play').disabled = reduced.matches;
    $('learn-motion-note').textContent = reduced.matches ? '已启用减少动态效果；请拖动滑块或点“看导通 / 看续流”逐步观察。' : '播放会将一个实际开关周期慢放到 6 秒，结束后自动停止；不会自动循环。';
  }
  reduced.addEventListener('change', motionPreference);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  document.querySelectorAll('[role=tab]').forEach(button => button.addEventListener('click', stop));
  window.addEventListener('buck:updated', () => { stop(); syncPhase(); });
  window.addEventListener('buck:drawn', syncPhase);
  window.addEventListener('buck:tab', stop);
  render(); syncPhase(); motionPreference();
})();
