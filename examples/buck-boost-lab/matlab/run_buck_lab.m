% RUN_BUCK_LAB Entry point: edit ../parameters.json, then run this script.
% Output: ../results/*.csv, parameters.json, metrics.json, two figure PNGs.
% The default 24 V case and the acceptance tests are separate checks.
scriptFolder=fileparts(mfilename('fullpath'));
projectRoot=fileparts(scriptFolder);
addpath(scriptFolder);
p=jsondecode(fileread(fullfile(projectRoot,'parameters.json')));
result=buck_model(p); freq=buck_frequency(p);
outFolder=fullfile(projectRoot,'results');
if ~isfolder(outFolder),mkdir(outFolder);end
writetable(result.rows,fullfile(outFolder,'matlab-waveforms.csv'));
writetable(freq,fullfile(outFolder,'matlab-frequency.csv'));
fid=fopen(fullfile(outFolder,'metrics.json'),'w','n','UTF-8');
assert(fid~=-1);fprintf(fid,'%s',jsonencode(result.metrics,PrettyPrint=true));fclose(fid);
copyfile(fullfile(projectRoot,'parameters.json'),fullfile(outFolder,'parameters.json'));

% Consistent colors and figures; all results from the ODE solution above.
teal=[.137 .420 .345];orange=[.725 .404 .204];
fig1=figure('Visible','off','Color',[1 1 .98],'Position',[100 100 1100 700]);
layout=tiledlayout(fig1,2,1,'Padding','compact','TileSpacing','compact');
traceT=[];traceV=[];traceI=[];
for k=0:2
    traceT=[traceT; (result.rows.t_s+k/p.fs)*1e6]; %#ok<AGROW>
    traceV=[traceV; result.rows.v_sw_V]; %#ok<AGROW>
    traceI=[traceI; result.rows.i_sw_A]; %#ok<AGROW>
end
ax1=nexttile(layout);plot(ax1,traceT,traceV,'Color',teal,'LineWidth',1.5);hold(ax1,'on');
yline(ax1,result.metrics.Vccm,'--','Color',orange,'LineWidth',1.2);
grid(ax1,'on');ylabel(ax1,'Output voltage (V)');xlabel(ax1,'Time (us)');
title(ax1,['Ideal Buck periodic steady state / ',result.metrics.mode]);
legend(ax1,'Switching ODE','CCM average reference','Location','southoutside','Orientation','horizontal');
ax2=nexttile(layout);plot(ax2,traceT,traceI,'Color',teal,'LineWidth',1.5);hold(ax2,'on');
yline(ax2,result.metrics.ILccm,'--','Color',orange,'LineWidth',1.2);
grid(ax2,'on');ylabel(ax2,'Inductor current (A)');xlabel(ax2,'Time (us)');
legend(ax2,'Switching ODE','CCM average reference','Location','southoutside','Orientation','horizontal');
style_axes([ax1,ax2],fig1);
exportgraphics(fig1,fullfile(outFolder,'matlab-waveforms.png'),'Resolution',150,'BackgroundColor',[1 1 .98]);close(fig1);

fig2=figure('Visible','off','Color',[1 1 .98],'Position',[100 100 1100 700]);
layout=tiledlayout(fig2,2,1,'Padding','compact','TileSpacing','compact');
ax3=nexttile(layout);semilogx(ax3,freq.f_Hz,freq.gain_dB,'Color',teal,'LineWidth',1.5);
grid(ax3,'on');ylabel(ax3,'Gain (dB re 1 V/duty)');xlabel(ax3,'Frequency (Hz)');
title(ax3,'CCM control-to-output average model (not valid in DCM)');
xline(ax3,p.fs/10,'--','fs/10: high-frequency caution','Color',orange);
ax4=nexttile(layout);semilogx(ax4,freq.f_Hz,freq.phase_deg,'Color',teal,'LineWidth',1.5);
grid(ax4,'on');ylabel(ax4,'Phase (deg)');xlabel(ax4,'Frequency (Hz)');
xline(ax4,p.fs/10,'--','fs/10','Color',orange);
style_axes([ax3,ax4],fig2);
exportgraphics(fig2,fullfile(outFolder,'matlab-frequency.png'),'Resolution',150,'BackgroundColor',[1 1 .98]);close(fig2);

% Acceptance tests always use canonical defaults even after a user edits
% parameters.json. The validation fixture is intentionally independent.
verify_matlab(projectRoot);
fprintf('Output folder: %s\n',outFolder);
fprintf('Mode=%s, mean V=%.9f V, mean I=%.9f A, f0=%.6f Hz\n', ...
    result.metrics.mode,result.metrics.Vmean,result.metrics.Imean,result.metrics.f0);

function style_axes(axesList,figureHandle)
% Set local properties explicitly so an installed dark theme does not make
% exported light-background charts unreadable. No global defaults changed.
ink=[.12 .24 .21];
set(axesList,'Color',[1 1 .98],'XColor',ink,'YColor',ink, ...
    'GridColor',[.6 .65 .6],'GridAlpha',.4,'FontSize',11);
for ax=axesList
    ax.Title.Color=ink;ax.XLabel.Color=ink;ax.YLabel.Color=ink;
end
legends=findobj(figureHandle,'Type','legend');
set(legends,'Color',[1 1 .98],'TextColor',ink,'EdgeColor',[.8 .84 .8]);
end
