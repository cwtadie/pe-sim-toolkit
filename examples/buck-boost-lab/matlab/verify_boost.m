function report=verify_boost(rootFolder)
%VERIFY_BOOST Independent ode45 checks, boundary sweep, inverse response.
p=struct('Vg',24,'D',.4,'L',220e-6,'C',470e-6,'R',20,'fs',20000);
r=boost_model(p);fine=boost_model(p,256);light=p;light.L=47e-6;light.R=200;d=boost_model(light);s=boost_step(p);
assert(strcmp(r.metrics.mode,'CCM')&&abs(r.metrics.Vmean/40-1)<.01&&r.metrics.residual<1e-8);
assert(abs(r.metrics.Irms/fine.metrics.Irms-1)<1e-4);
ref=independent(p,r.metrics);refD=independent(light,d.metrics);
p2=p;p2.D=p.D+.02;refFirst=independent(p2,r.metrics);
assert(abs(refFirst.Vmean-s.metrics.firstCycleV)<1e-7);
assert(abs(ref.Vmean-r.metrics.Vmean)<1e-7&&abs(ref.IinMean-r.metrics.IinMean)<1e-7);
assert(abs(refD.Vmean-d.metrics.Vmean)<1e-7&&abs(refD.IinMean-d.metrics.IinMean)<1e-7);
assert(ref.residual<1e-7&&refD.residual<1e-7);
assert(s.metrics.ccmThroughout&&s.metrics.firstCycleV<s.metrics.oldV&&s.metrics.lastCycleV>s.metrics.oldV&&abs(s.metrics.lastCycleV/s.metrics.finalV-1)<.01);
names={'Vg','D','L','C','R','fs'};bounds=[6,48;.1,.7;47e-6,2200e-6;100e-6,2200e-6;5,200;20000,100000];
for mask=0:63
    q=p;for j=1:6,q.(names{j})=bounds(j,1+bitget(mask,j));end
    v=boost_model(q,64);assert(v.metrics.residual<1e-7&&all(v.rows.iL_A>=-1e-9)&&all(v.rows.v_V>0));
end
report=struct('passed',true,'matlabVersion',version,'default',r.metrics,'fine',fine.metrics, ...
    'DCM',d.metrics,'step',s.metrics,'ode45Default',ref,'ode45DCM',refD,'ode45StepFirst',refFirst,'corners',64);
fid=fopen(fullfile(rootFolder,'validation','boost-matlab-results.json'),'w','n','UTF-8');assert(fid~=-1);guard=onCleanup(@()fclose(fid));
fprintf(fid,'%s',jsonencode(report,PrettyPrint=true));disp('Boost independent MATLAB validation: PASS');
end
function ref=independent(p,m)
T=1/p.fs;ton=p.D*T;y0=[m.initialI;m.initialV;0;0];
opts=odeset('RelTol',1e-11,'AbsTol',1e-12,'MaxStep',T/100);
on=@(~,y)[p.Vg/p.L;-y(2)/(p.R*p.C);y(2);y(1)];
off=@(~,y)[(p.Vg-y(2))/p.L;(y(1)-y(2)/p.R)/p.C;y(2);y(1)];
[~,ya]=ode45(on,[0 ton],y0,opts);
[~,yb,te,ye]=ode45(off,[ton T],ya(end,:)',odeset(opts,'Events',@event));last=yb(end,:)';
if ~isempty(te)
    z=T-te(end);hit=ye(end,:)';decay=exp(-z/(p.R*p.C));last=[0;hit(2)*decay;hit(3)+hit(2)*p.R*p.C*(1-decay);hit(4)];
end
ref=struct('Vmean',last(3)/T,'IinMean',last(4)/T,'residual',max(abs(last(1:2)-y0(1:2))));
end
function [value,terminal,direction]=event(~,y)
value=y(1);terminal=1;direction=-1;
end
