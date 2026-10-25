function result=boost_step(p,delta)
%BOOST_STEP True switching cycle-average and nonlinear CCM average response.
if nargin<2,delta=.02;end
assert(isfinite(delta)&&isscalar(delta)&&delta>0&&delta<=.05&&p.D+delta<=.7+1e-12,'Boost:StepRange','Invalid positive duty step.');
old=boost_model(p);p2=p;p2.D=p.D+delta;final=boost_model(p2);
assert(strcmp(old.metrics.mode,'CCM')&&strcmp(final.metrics.mode,'CCM'),'Boost:StepCCM','CCM is required before and after the RHP demo.');
T=1/p.fs;duration=min(.25,max(.02,10*p.R*p.C));cycles=ceil(duration/T);
x=[old.metrics.initialI;old.metrics.initialV];xavg=[old.metrics.Iccm;old.metrics.Vccm];
k=1-p2.D;Aavg=[0,-k/p.L;k/p.C,-1/(p.R*p.C)];eq=[p.Vg/(p.R*k*k);p.Vg/k];
Eavg=expm(Aavg*T);avgMid=expm(Aavg*T/2)*(xavg-eq)+eq;
Aoff=[0,-1/p.L;1/p.C,-1/(p.R*p.C)];Eoff=expm(Aoff*(1-p2.D)*T);
data=zeros(cycles+10,6);minI=inf;
for j=-10:cycles-1
    row=j+11;t=(j+.5)*T;
    if j<0
        data(row,:)=[t,old.metrics.Vmean,old.metrics.IinMean,xavg(2),xavg(1),p.D];continue;
    end
    a=boost_segment(p2,x,p2.D*T,true);b=boost_segment(p2,a.x,(1-p2.D)*T,false,Eoff);
    data(row,:)=[t,(a.vInt+b.vInt)/T,(a.iInt+b.iInt)/T,avgMid(2),avgMid(1),p2.D];
    minI=min([minI,x(1),a.x(1),b.x(1)]);x=b.x;avgMid=Eavg*(avgMid-eq)+eq;
end
rows=array2table(data,'VariableNames',{'t_s','v_sw_mean_V','i_sw_mean_A','v_avg_V','i_avg_A','D'});
metrics=struct('oldV',old.metrics.Vmean,'finalV',final.metrics.Vmean, ...
    'averageInitialSlope',-old.metrics.Iccm*delta/p.C,'firstCycleV',data(11,2), ...
    'minCycleV',min(data(11:end,2)),'averageMinV',min(data(11:end,4)), ...
    'lastCycleV',data(end,2),'ccmThroughout',minI>0,'minCurrent',minI,'duration',cycles*T);
result=struct('parameters',p,'delta',delta,'rows',rows,'metrics',metrics);
end
