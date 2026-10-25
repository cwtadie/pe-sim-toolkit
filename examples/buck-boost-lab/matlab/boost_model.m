function result=boost_model(p,n)
%BOOST_MODEL Ideal nonsynchronous Boost periodic switched ODE, CCM/DCM.
if nargin<2,n=128;end
names={'Vg','D','L','C','R','fs'};bounds=[6,48;.1,.7;47e-6,2200e-6;100e-6,2200e-6;5,200;20000,100000];
for j=1:6
    assert(isfield(p,names{j}),'Boost:Missing','Missing field.');v=p.(names{j});
    assert(isnumeric(v)&&isscalar(v)&&isfinite(v)&&v>=bounds(j,1)*(1-1e-12)&&v<=bounds(j,2)*(1+1e-12),'Boost:Range','Invalid %s.',names{j});
end
validateattributes(n,{'numeric'},{'scalar','integer','>=',16,'<=',4096});
T=1/p.fs;ton=p.D*T;toff=T-ton;A=[0,-1/p.L;1/p.C,-1/(p.R*p.C)];
E=expm(A*toff);Eon=diag([1,exp(-ton/(p.R*p.C))]);eq=[p.Vg/p.R;p.Vg];
q=E*([p.Vg*ton/p.L;0]-eq)+eq;
initial=(eye(2)-E*Eon)\q;mode='CCM';
if initial(1)<0
    mode='DCM';lo=p.Vg/(1-p.D);hi=max(lo*2,initial(2)*2);
    for j=1:30
        e=cycle([0;hi]);if e.x(2)<=hi,break;end;hi=hi*2;
    end
    e=cycle([0;hi]);assert(e.x(2)<=hi);
    for j=1:64
        mid=(lo+hi)/2;e=cycle([0;mid]);
        if e.x(2)>mid,lo=mid;else,hi=mid;end
    end
    initial=[0;(lo+hi)/2];
end
endpoint=cycle(initial);peak=boost_segment(p,initial,ton,true);
t=[linspace(0,ton,n+1),ton+linspace(toff/n,toff,n)]';
if endpoint.zero>0,t=sort([t;T-endpoint.zero]);end
data=zeros(numel(t),8);
for j=1:numel(t)
    on=t(j)<ton;
    if t(j)<=ton,s=boost_segment(p,initial,t(j),true);else,s=boost_segment(p,peak.x,t(j)-ton,false);end
    idle=~on && endpoint.zero>0 && t(j)>=T-endpoint.zero;
    if on||idle,id=0;else,id=max(0,s.x(1));end
    if on,vl=p.Vg;elseif idle,vl=0;else,vl=p.Vg-s.x(2);end
    region=2;if on,region=1;elseif idle,region=3;end
    data(j,:)=[s.x(2),s.x(1),vl,id-s.x(2)/p.R,id,on*s.x(1),double(on),region];
end
rows=array2table([t,data],'VariableNames',{'t_s','v_V','iL_A','vL_V','iC_A','iD_A','iS_A','gate','region'});
k=1-p.D;v=rows.v_V;i=rows.iL_A;
metrics=struct('mode',mode,'Vmean',endpoint.vInt/T,'IinMean',endpoint.iInt/T, ...
    'IoutMean',endpoint.vInt/T/p.R,'Vccm',p.Vg/k,'Iccm',p.Vg/(p.R*k*k), ...
    'deltaV',max(v)-min(v),'deltaI',max(i)-min(i),'Ipeak',max(i),'Imin',min(i), ...
    'Irms',sqrt(trapz(t,i.^2)/T),'Vstress',max(v),'zeroFraction',endpoint.zero/T, ...
    'initialI',initial(1),'initialV',initial(2),'residual',max(abs(endpoint.x-initial)), ...
    'Gdc',p.Vg/k^2,'f0',k/(2*pi*sqrt(p.L*p.C)), ...
    'fRHP',p.R*k*k/(2*pi*p.L),'Rcrit',2*p.L*p.fs/(p.D*k*k));
result=struct('parameters',p,'metrics',metrics,'rows',rows);
    function e=cycle(x)
        a=boost_segment(p,x,ton,true);b=boost_segment(p,a.x,toff,false,E);
        e=struct('x',b.x,'vInt',a.vInt+b.vInt,'iInt',a.iInt+b.iInt,'zero',b.zero);
    end
end
