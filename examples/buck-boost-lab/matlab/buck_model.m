function result = buck_model(p, resolution)
%BUCK_MODEL Periodic steady state of an ideal nonsynchronous Buck.
% p fields are SI: Vg [V], D [1], L [H], C [F], R [ohm], fs [Hz].
% States are [inductor current; capacitor voltage]. Exact ODE segment
% propagation with expm; zero-current diode event handled explicitly.
if nargin < 2, resolution = 128; end
names = {'Vg','D','L','C','R','fs'};
lower = [6,.05,22e-6,47e-6,1,20000];
upper = [48,.95,2200e-6,2200e-6,100,100000];
for j = 1:numel(names)
    assert(isfield(p,names{j}), 'Buck:MissingParameter','Missing %s.', names{j});
    value = p.(names{j});
    assert(isnumeric(value) && isscalar(value) && isfinite(value) && ...
        value >= lower(j)*(1-1e-12) && value <= upper(j)*(1+1e-12), ...
        'Buck:InvalidParameter','Invalid/out-of-range %s.',names{j});
end
validateattributes(resolution,{'numeric'},{'scalar','integer','>=',16,'<=',4096});
T = 1/p.fs;
A = [0,-1/p.L; 1/p.C,-1/(p.R*p.C)];
onTime = p.D*T; offTime = (1-p.D)*T;
E1 = expm(A*onTime); E2 = expm(A*offTime);
eq = [p.Vg/p.R;p.Vg];
initial = (eye(2)-E2*E1) \ (E2*(eye(2)-E1)*eq);
mode = 'CCM'; zeroTime = 0;
if initial(1) < 0
    mode = 'DCM'; lo=0; hi=p.Vg;
    for j=1:64
        voltage=(lo+hi)/2;
        [endpoint,~] = one_cycle([0;voltage]);
        if endpoint(2)-voltage > 0, lo=voltage; else, hi=voltage; end
    end
    initial=[0;(lo+hi)/2];
    [~,zeroTime] = one_cycle(initial);
end
peak = advance(initial,onTime,p.Vg);
t = [linspace(0,onTime,resolution+1), ...
    onTime+linspace(offTime/resolution,offTime,resolution)]';
if zeroTime>0, t=sort([t;T-zeroTime]); end
states = zeros(numel(t),2);
for j=1:numel(t)
    if t(j)<=onTime
        states(j,:)=advance(initial,t(j),p.Vg)';
    else
        [x,~]=diode_off(peak,t(j)-onTime); states(j,:)=x';
    end
end
v=states(:,2); i=states(:,1); gate=double(t<onTime);
vAvg=ones(size(t))*p.D*p.Vg; iAvg=vAvg/p.R;
rows=table(t,v,i,vAvg,iAvg,gate,'VariableNames', ...
    {'t_s','v_sw_V','i_sw_A','v_avg_V','i_avg_A','gate'});
[endpoint,~]=one_cycle(initial);
metrics=struct('mode',mode,'Vmean',trapz(t,v)/T,'Imean',trapz(t,i)/T, ...
    'deltaI',max(i)-min(i),'deltaV',max(v)-min(v),'minI',min(i),'maxI',max(i), ...
    'Vccm',p.D*p.Vg,'ILccm',p.D*p.Vg/p.R,'Gdc',p.Vg, ...
    'f0',1/(2*pi*sqrt(p.L*p.C)),'Q',p.R*sqrt(p.C/p.L), ...
    'zeroFraction',zeroTime/T,'residual',max(abs(endpoint-initial)), ...
    'initialI',initial(1),'initialV',initial(2));
result=struct('parameters',p,'metrics',metrics,'rows',rows);

    function x=advance(x0,h,u)
        equilibrium=[u/p.R;u];
        x=expm(A*h)*(x0-equilibrium)+equilibrium;
    end
    function [x,zero]=diode_off(x0,h)
        zero=0;
        if x0(1)<=0
            x=[0;x0(2)*exp(-h/(p.R*p.C))]; zero=h; return;
        end
        x=advance(x0,h,0);
        if x(1)>=0, return; end
        lowTime=0; highTime=h;
        for idx=1:48
            middle=(lowTime+highTime)/2; probe=advance(x0,middle,0);
            if probe(1)>0, lowTime=middle; else, highTime=middle; end
        end
        hit=(lowTime+highTime)/2; xHit=advance(x0,hit,0);
        zero=h-hit; x=[0;xHit(2)*exp(-zero/(p.R*p.C))];
    end
    function [x,zero]=one_cycle(x0)
        [x,zero]=diode_off(advance(x0,onTime,p.Vg),offTime);
    end
end
