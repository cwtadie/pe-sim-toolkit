function rows=boost_frequency(p,count)
%BOOST_FREQUENCY CCM averaged duty-to-output model with RHP zero.
if nargin<2,count=240;end
k=1-p.D;f0=k/(2*pi*sqrt(p.L*p.C));fz=p.R*k*k/(2*pi*p.L);
f=logspace(log10(max(1,f0/30)),log10(max([fz*4,f0*10,p.fs/10])),count)';
s=1i*2*pi*f;
G=p.Vg/k^2*(1-s*p.L/(p.R*k*k))./(1+s*p.L/(p.R*k*k)+s.^2*p.L*p.C/(k*k));
rows=table(f,20*log10(abs(G)),unwrap(angle(G))*180/pi, ...
    'VariableNames',{'f_Hz','gain_dB','phase_deg'});
end
