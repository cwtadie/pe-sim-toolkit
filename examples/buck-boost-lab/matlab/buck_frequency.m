function rows = buck_frequency(p, count)
%BUCK_FREQUENCY CCM control-to-output transfer function, no extra toolbox.
% DCM: this function is only a mathematical CCM reference, not a prediction.
if nargin<2, count=180; end
f0=1/(2*pi*sqrt(p.L*p.C));
low=max(1,f0/30); high=max(f0*10,p.fs/10);
f=logspace(log10(low),log10(high),count)'; s=1i*2*pi*f;
G=p.Vg./(1+s*p.L/p.R+s.^2*p.L*p.C);
rows=table(f,20*log10(abs(G)),angle(G)*180/pi, ...
    'VariableNames',{'f_Hz','gain_dB','phase_deg'});
end
