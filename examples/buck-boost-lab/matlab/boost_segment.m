function result=boost_segment(p,x,h,isOn,E)
%BOOST_SEGMENT Exact ODE flow and voltage/current time integrals, SI units.
if isOn
    endpoint=[x(1)+p.Vg*h/p.L;x(2)*exp(-h/(p.R*p.C))];
    result=struct('x',endpoint,'vInt',p.R*p.C*(x(2)-endpoint(2)), ...
        'iInt',x(1)*h+p.Vg*h*h/(2*p.L),'zero',0);return;
end
A=[0,-1/p.L;1/p.C,-1/(p.R*p.C)];eq=[p.Vg/p.R;p.Vg];
if nargin<5,E=expm(A*h);end
endpoint=E*(x-eq)+eq;
if x(1)>0 && endpoint(1)>=0
    vi=p.Vg*h-p.L*(endpoint(1)-x(1));
    result=struct('x',endpoint,'vInt',vi,'iInt',p.C*(endpoint(2)-x(2))+vi/p.R,'zero',0);return;
end
hit=0;
if x(1)>0
    lo=0;hi=h;
    for j=1:48
        mid=(lo+hi)/2;probe=expm(A*mid)*(x-eq)+eq;
        if probe(1)>0,lo=mid;else,hi=mid;end
    end
    hit=(lo+hi)/2;
end
hitX=expm(A*hit)*(x-eq)+eq;idle=h-hit;
ve=hitX(2)*exp(-idle/(p.R*p.C));
assert(ve>=p.Vg*(1-1e-9),'Boost:DiodeRestart','Idle diode restart is outside the supported teaching domain.');
vi=p.Vg*hit+p.L*x(1);
result=struct('x',[0;ve],'vInt',vi+p.R*p.C*(hitX(2)-ve), ...
    'iInt',p.C*(hitX(2)-x(2))+vi/p.R,'zero',idle);
end
