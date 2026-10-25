function report = verify_matlab(projectRoot)
%VERIFY_MATLAB Acceptance checks plus independent event-aware ode45 reference.
p=struct('Vg',24,'D',.4,'L',220e-6,'C',470e-6,'R',5,'fs',20000);
r=buck_model(p); fine=buck_model(p,256);
checks=struct('name',{},'passed',{});
assert(strcmp(r.metrics.mode,'CCM'));
assert(abs(r.metrics.Vmean/9.6-1)<.01 && abs(r.metrics.Imean/1.92-1)<.01);
record('Default CCM mean voltage/current under 1%');
assert(r.metrics.Gdc==24 && abs(r.metrics.f0/495-1)<.001);
record('DC gain and natural frequency');
assert(abs(r.metrics.Vmean/fine.metrics.Vmean-1)<1e-5);
assert(abs(r.metrics.Imean/fine.metrics.Imean-1)<1e-5);
record('Sampling convergence 128 to 256');
ref=independent_ode45(p,r.metrics);
assert(abs(ref.Vmean/r.metrics.Vmean-1)<1e-5);
assert(abs(ref.Imean/r.metrics.Imean-1)<1e-5 && ref.residual<1e-7);
record('Independent ode45 default trajectory and integral means');
light=p; light.R=100; light.L=22e-6;
rl=buck_model(light); refLight=independent_ode45(light,rl.metrics);
assert(strcmp(rl.metrics.mode,'DCM') && rl.metrics.zeroFraction>0);
assert(all(rl.rows.i_sw_A>=-1e-9) && rl.metrics.residual<1e-8);
assert(abs(rl.metrics.Vmean/refLight.Vmean-1)<.01);
assert(abs(rl.metrics.Imean/refLight.Imean-1)<.01 && refLight.residual<1e-7);
record('DCM independent zero-current event reference');
lower=[6,.05,22e-6,47e-6,1,20000]; upper=[48,.95,2200e-6,2200e-6,100,100000];
names={'Vg','D','L','C','R','fs'};
for mask=0:63
    q=p;
    for j=1:6
        if bitget(mask,j),q.(names{j})=upper(j);else,q.(names{j})=lower(j);end
    end
    corner=buck_model(q,256);
    assert(corner.metrics.residual<1e-7);
    assert(all(corner.rows.i_sw_A>=-1e-9) && all(corner.rows.v_sw_V>=0));
    assert(abs(corner.metrics.Imean-corner.metrics.Vmean/q.R)<max(1e-4,corner.metrics.Imean*.01));
end
record('64 corners: nonnegative current, periodicity, capacitor charge balance');
bad=p;bad.D=1; caught=false;
try,buck_model(bad);catch,caught=true;end
assert(caught);record('Out-of-range parameter rejected');
report=struct('matlabVersion',version,'checks',checks,'default',r.metrics, ...
    'fine',fine.metrics,'DCM',rl.metrics,'ode45Default',ref,'ode45DCM',refLight, ...
    'boundaryCases',64);
fid=fopen(fullfile(projectRoot,'validation','matlab-results.json'),'w','n','UTF-8');
assert(fid~=-1); guard=onCleanup(@()fclose(fid));
fprintf(fid,'%s',jsonencode(report,PrettyPrint=true));
disp('MATLAB acceptance checks: PASS');
    function record(name)
        checks(end+1)=struct('name',name,'passed',true);
    end
end

function ref=independent_ode45(p,m)
% Augmented ODE states integrate both voltage and current, rather than using
% the sampling quadrature or matrix exponential from buck_model.
T=1/p.fs; ton=p.D*T;
rhs=@(~,y,u)[(u-y(2))/p.L;(y(1)-y(2)/p.R)/p.C;y(2);y(1)];
opts=odeset('RelTol',1e-10,'AbsTol',1e-12,'MaxStep',T/100);
y0=[m.initialI;m.initialV;0;0];
[~,on]=ode45(@(t,y)rhs(t,y,p.Vg),[0 ton],y0,opts);
offOpts=odeset(opts,'Events',@zero_event);
[~,off,te,ye]=ode45(@(t,y)rhs(t,y,0),[ton T],on(end,:)',offOpts);
last=off(end,:)';
if ~isempty(te)
    z=T-te(end); hit=ye(end,:)'; decay=exp(-z/(p.R*p.C));
    last=[0;hit(2)*decay;hit(3)+hit(2)*p.R*p.C*(1-decay);hit(4)];
end
ref=struct('Vmean',last(3)/T,'Imean',last(4)/T, ...
    'residual',max(abs(last(1:2)-y0(1:2))));
end
function [value,isterminal,direction]=zero_event(~,y)
value=y(1);isterminal=1;direction=-1;
end
