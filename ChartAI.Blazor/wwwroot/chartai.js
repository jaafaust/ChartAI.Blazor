// src/worker-inline.ts
var WORKER_CODE = 'var H="fn luma(c:vec4f)->f32{return dot(c.rgb,vec3f(.299,.587,.114));}fn laaa(uv:vec2f,t:texture_2d<f32>,s:sampler)->vec4f{let r=1./vec2f(textureDimensions(t));let m=textureSample(t,s,uv);let n=textureSample(t,s,uv+vec2f(0.,-r.y));let e=textureSample(t,s,uv+vec2f(r.x,0.));let w=textureSample(t,s,uv+vec2f(-r.x,0.));let sv=textureSample(t,s,uv+vec2f(0.,r.y));let lm=luma(m);let ln=luma(n);let le=luma(e);let lw=luma(w);let ls=luma(sv);let lo=min(lm,min(min(ln,ls),min(le,lw)));let hi=max(lm,max(max(ln,ls),max(le,lw)));let rng=hi-lo;if(rng<max(.0833,hi*.166)){return m;}return mix(m,(m+n+e+w+sv)*.2,min(rng*3.,1.));}struct BV{@builtin(position)p:vec4f,@location(0)uv:vec2f}@group(0)@binding(0)var inputTex:texture_2d<f32>;@group(0)@binding(1)var samp:sampler;@vertex fn vs(@builtin(vertex_index)i:u32)->BV{var p=array<vec2f,4>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(1,1));var u=array<vec2f,4>(vec2f(0,1),vec2f(1,1),vec2f(0,0),vec2f(1,0));return BV(vec4f(p[i],0,1),u[i]);}@fragment fn fs(v:BV)->@location(0)vec4f{return laaa(v.uv,inputTex,samp);}";var f={INIT:0,THEME:1,REGISTER_RENDERER:2,REGISTER_CHART:3,UNREGISTER_CHART:4,UPDATE_SERIES:5,RESIZE:6,VIEW_TRANSFORM:7,BATCH_VIEW_TRANSFORM:8,SET_VISIBILITY:9,SET_STYLE:10,SET_UNIFORMS:11,GPU_READY:12,ERROR:13,STATS:14,PATCH_SERIES:15,SET_BOUNDS:16},b={NO_GPU:"e1:no-gpu",NO_ADAPTER:"e2:no-adapter",DEVICE_LOST:"e3:device-lost",NOT_READY:"e4:not-ready",COMPILE:"e5:compile",CTX_GET:"e6:ctx-get",CTX_CFG:"e7:ctx-cfg",TEX:"e8:tex",BIND_S:"e9:bind-s",BIND_C:"e10:bind-c",UPDATE:"e11:update",NO_RENDERER:"e12:no-renderer",RESIZE:"e13:resize"};var u,N,h=new Map,T=new Map,O=!1,v=!1,Z,k,j,V=0,J=0,z=!1,I=null,W=new ArrayBuffer(80),ie=new Float32Array(W),ae=new Uint32Array(W),X={r:0,g:0,b:0,a:0};function K(e){let s=GPUBufferUsage.COPY_DST;for(let t of e)switch(t.toUpperCase()){case"STORAGE":s|=GPUBufferUsage.STORAGE;break;case"VERTEX":s|=GPUBufferUsage.VERTEX;break;case"UNIFORM":s|=GPUBufferUsage.UNIFORM;break;case"COPY_SRC":s|=GPUBufferUsage.COPY_SRC;break;case"COPY_DST":s|=GPUBufferUsage.COPY_DST;break;case"INDEX":s|=GPUBufferUsage.INDEX;break;case"INDIRECT":s|=GPUBufferUsage.INDIRECT;break}return s}function oe(e,s,t){let r=t==="compute"?GPUShaderStage.COMPUTE:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT;if(e==="uniforms"||e==="custom-uniforms"||e==="series-index")return{visibility:r,buffer:{type:"uniform"}};if(e==="render-target"){if(s)return{visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}};return{visibility:r,texture:{sampleType:"float"}}}if(s)return{visibility:r,buffer:{type:"storage"}};return{visibility:r,buffer:{type:"read-only-storage"}}}function ue(e,s,t,r){switch(e){case"uniforms":return{buffer:s.uniformBuffer};case"custom-uniforms":return{buffer:s.customUniformBuffer};case"series-info":return{buffer:s.seriesStorageBuffer};case"render-target":return s.outputTextureView;case"x-data":return{buffer:t.dataX};case"y-data":return{buffer:t.dataY};case"series-index":return{buffer:t.seriesIndexBuffer}}if(e.endsWith("-data")){let n=e.slice(0,-5);return{buffer:t.extraBuffers.get(n)}}if(r.config.bufferDefs.find((n)=>n.name===e)?.perSeries)return{buffer:t.seriesBuffers.get(e)};return{buffer:s.chartBuffers.get(e)}}function F(e,s,t,r){return e.bindings.map((i)=>({binding:i.binding,resource:ue(i.source,s,t,r)}))}function fe(e,s,t){t.getCompilationInfo?.()?.then((r)=>{let i=r.messages.filter((n)=>n.type==="error");if(i.length>0)postMessage({type:f.ERROR,code:b.COMPILE,message:`${e}/${s}: ${i.map((n)=>`${n.lineNum}:${n.linePos} ${n.message}`).join("; ")}`})}).catch(()=>{})}function le(e){let s=[],t=[],r=new Map,i=!e.passes.some((n)=>n.type==="compute"&&n.bindings.some((a)=>a.source==="render-target"&&a.write));u.pushErrorScope?.("validation");for(let n=0;n<e.passes.length;n++){let a=e.passes[n],o=a.bindings.map((m)=>({binding:m.binding,...oe(m.source,m.write,a.type)})),c=u.createBindGroupLayout({entries:o});t.push(c);let S=u.createPipelineLayout({bindGroupLayouts:[c]}),g=r.get(a.shader);if(!g)g=u.createShaderModule({code:e.shaders[a.shader]}),r.set(a.shader,g),fe(e.name,a.shader,g);if(a.type==="compute")s.push(u.createComputePipeline({layout:S,compute:{module:g,entryPoint:"main"}}));else s.push(u.createRenderPipeline({layout:S,vertex:{module:g,entryPoint:"vs"},fragment:{module:g,entryPoint:"fs",targets:[{format:"rgba8unorm",blend:a.blend}]},primitive:{topology:a.topology??"triangle-list"},multisample:{count:i?4:1}}))}return u.popErrorScope?.()?.then((n)=>{if(n)postMessage({type:f.ERROR,code:b.COMPILE,message:`${e.name}: ${n.message}`})}).catch(()=>{}),{config:e,pipelines:s,passLayouts:t,msaa:i,usesTarget:e.passes.some((n)=>n.bindings.some((a)=>a.source==="render-target")),hl:e.passes.findIndex((n)=>n.highlight)}}function de(e){if(e.seriesInfoDirty=!1,!e.seriesStorageBuffer||e.series.length===0)return;let s=new Float32Array(e.series.length*8),t=new Uint32Array(s.buffer);for(let r=0;r<e.series.length;r++){let i=e.series[r],n=r*8;s[n+0]=i.colorR,s[n+1]=i.colorG,s[n+2]=i.colorB,s[n+3]=1,t[n+4]=i.visibleStart,t[n+5]=i.visibleCount}u.queue.writeBuffer(e.seriesStorageBuffer,0,s)}function me(e){let s=ie,t=ae,r=e.maxX-e.minX,i=e.maxY-e.minY,n=e.bgColor??(O?[0.11,0.11,0.12]:[0.98,0.98,0.98]);s[0]=e.width,s[1]=e.height,s[2]=e.minX+e.panX*r,s[3]=e.minX+e.panX*r+r/e.zoomX,s[4]=e.minY+e.panY*i,s[5]=e.minY+e.panY*i+i/e.zoomY,t[6]=0,t[7]=e.series.length,t[8]=O?1:0,s[9]=n[0],s[10]=n[1],s[11]=n[2],s[12]=e.minX,s[13]=e.maxX,s[14]=e.minY,s[15]=e.maxY,t[16]=(e.hlSeries??-1)>>>0,u.queue.writeBuffer(e.uniformBuffer,0,W)}function Q(e,s){if(!e.customUniformBuffer||s.uniformDefs.length===0)return;let t=s.uniformDefs.length,r=Math.ceil(t*4/16)*16,i=new ArrayBuffer(r),n=new Float32Array(i),a=new Uint32Array(i);for(let o=0;o<t;o++){let c=s.uniformDefs[o],S=e.customUniformValues[c.name],g=typeof S==="number"?S:c.default;if(c.type==="u32")a[o]=g>>>0;else n[o]=g}u.queue.writeBuffer(e.customUniformBuffer,0,i)}function ee(e,s,t,r,i){let n=Math.max(16,Math.ceil(t/4)*4),a=e.get(s);if(a&&a.size>=n)return!1;a?.destroy();let o=Math.min(u.limits.maxBufferSize||268435456,u.limits.maxStorageBufferBindingSize||134217728),c=i?Math.max(n,Math.min(o,Math.ceil(n*1.25/256)*256)):n;return e.set(s,u.createBuffer({size:c,usage:r})),!0}function te(e,s,t,r=!1){let i=!1;for(let n of s.config.bufferDefs)if(!n.perSeries&&ee(e.chartBuffers,n.name,t[n.name]??16,K(n.usages),r))i=!0;if(s.config.uniformDefs.length>0&&!e.customUniformBuffer){let n=Math.max(16,Math.ceil(s.config.uniformDefs.length*4/16)*16);e.customUniformBuffer=u.createBuffer({size:n,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Q(e,s.config),i=!0}return i}function re(e,s,t,r=!1){let i=!1;for(let n of s.config.bufferDefs)if(n.perSeries&&ee(e.seriesBuffers,n.name,t[n.name]??16,K(n.usages),r))i=!0;return i}function ce(e){let s=u.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});return u.queue.writeBuffer(s,0,new Uint32Array([e,0,0,0])),s}function pe(e,s){if(e.bindGroupsStale=!1,e.chartPassBindGroups=[],!e.seriesStorageBuffer)return;for(let t=0;t<e.series.length;t++){let r=e.series[t];r.passBindGroups=[],r.hlBindGroup=null;for(let i=0;i<s.config.passes.length;i++){let n=s.config.passes[i];if(!n.perSeries||n.highlight){r.passBindGroups.push(null);continue}try{r.passBindGroups.push(u.createBindGroup({layout:s.passLayouts[i],entries:F(n,e,r,s)}))}catch(a){postMessage({type:f.ERROR,code:b.BIND_S,message:String(a)}),r.passBindGroups.push(null)}}}for(let t=0;t<s.config.passes.length;t++){let r=s.config.passes[t];if(r.perSeries){e.chartPassBindGroups.push(null);continue}try{e.chartPassBindGroups.push(u.createBindGroup({layout:s.passLayouts[t],entries:F(r,e,null,s)}))}catch(i){postMessage({type:f.ERROR,code:b.BIND_C,message:String(i)}),e.chartPassBindGroups.push(null)}}}function ge(e,s,t){let r=e.series[t];if(!r.hlBindGroup)try{r.hlBindGroup=u.createBindGroup({layout:s.passLayouts[s.hl],entries:F(s.config.passes[s.hl],e,r,s)})}catch(i){postMessage({type:f.ERROR,code:b.BIND_S,message:String(i)})}return r.hlBindGroup}function se(e){L(e);let s=Math.max(1,e.width),t=Math.max(1,e.height),r=T.get(e.rendererName)??null,i=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT;if(r&&!r.msaa)i|=GPUTextureUsage.STORAGE_BINDING;if(e.outputTexture=u.createTexture({size:[s,t],format:"rgba8unorm",usage:i}),e.outputTextureView=e.outputTexture.createView(),e.blitBindGroup=u.createBindGroup({layout:k,entries:[{binding:0,resource:e.outputTextureView},{binding:1,resource:j}]}),r&&r.msaa)e.msaaTexture=u.createTexture({size:[s,t],format:"rgba8unorm",sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),e.msaaView=e.msaaTexture.createView();if(e.texRenderer=r,r?.usesTarget)e.bindGroupsStale=!0}function L(e){if(e.outputTexture?.destroy(),e.msaaTexture?.destroy(),e.outputTexture=null,e.outputTextureView=null,e.msaaTexture=null,e.msaaView=null,e.blitBindGroup=null,e.texRenderer=null,T.get(e.rendererName)?.usesTarget)e.bindGroupsStale=!0}function A(e,s,t){if(!e.msaaView)return{view:e.outputTextureView,loadOp:s,storeOp:"store",clearValue:X};return{view:e.msaaView,resolveTarget:t?e.outputTextureView:void 0,loadOp:s,storeOp:t?"discard":"store",clearValue:X}}function be(e,s,t){let r=(e.perSeriesPassMeta[s]??e.perSeriesPassMeta[0])?.[t]?.dispatch??{x:1},i=u.limits.maxComputeWorkgroupsPerDimension||65535,n=Math.min(i,Math.floor(r.x)),a=Math.min(i,Math.floor(r.y??1)),o=Math.min(i,Math.floor(r.z??1));return n>0&&a>0&&o>0?[n,a,o]:null}function Y(e,s,t){let r=(e.perSeriesPassMeta[s]??e.perSeriesPassMeta[0])?.[t]?.draw??0;return r>0?Math.floor(r):0}function he(e){let s;try{s=e.ctx.getCurrentTexture().createView()}catch{return}let t=u.createCommandEncoder();t.beginRenderPass({colorAttachments:[{view:s,loadOp:"clear",storeOp:"store",clearValue:X}]}).end(),u.queue.submit([t.finish()])}function Se(e){if(!e.ctx||e.width===0||e.height===0)return;if(e.series.length===0||!e.seriesStorageBuffer){he(e);return}let s=T.get(e.rendererName);if(!s)return;if(!e.outputTexture||e.texRenderer!==s)se(e);if(e.bindGroupsStale)pe(e,s);if(e.seriesInfoDirty)de(e);let t=e.highlight??-1;if(s.hl<0||t<0||t>=e.series.length||e.series[t].hidden||e.series[t].visibleCount===0)t=-1;let r=t>=0?ge(e,s,t):null;if(!r)t=-1;e.hlSeries=t,me(e);let i;try{i=e.ctx.getCurrentTexture().createView()}catch{return}let n=s.config.passes,a=-1,o=-1;for(let l=0;l<n.length;l++){if(n[l].type!=="render"||n[l].highlight)continue;if(a<0)a=l;o=l}let c=t>=0?s.hl:o,S=!s.msaa||a<0,g=!s.msaa,m=g||e.computeStale,p=u.createCommandEncoder();if(S)p.beginRenderPass({colorAttachments:[A(e,"clear",c<0)]}).end();let d=null;for(let l=0;l<n.length;l++){let B=n[l];if(B.highlight)continue;if(B.type==="compute"){let R=s.pipelines[l],x=!1,C=B.perSeries?e.series.length:m?1:0;for(let P=0;P<C;P++){let E;if(B.perSeries){let D=e.series[P];if(D.hidden||D.visibleCount===0||!(g||D.stale))continue;E=D.passBindGroups[l]}else E=e.chartPassBindGroups[l];let w=be(e,P,l);if(!E||!w)continue;if(!d)d=p.beginComputePass();if(!x)d.setPipeline(R),x=!0;d.setBindGroup(0,E),d.dispatchWorkgroups(w[0],w[1],w[2])}continue}if(d)d.end(),d=null;let M=!S&&l===a?"clear":B.loadOp??"load",y=p.beginRenderPass({colorAttachments:[A(e,M,l===c)]});if(y.setPipeline(s.pipelines[l]),B.perSeries)for(let R=0;R<e.series.length;R++){let x=e.series[R];if(x.hidden||x.visibleCount===0)continue;let C=x.passBindGroups[l],P=Y(e,R,l);if(!C||P===0)continue;y.setBindGroup(0,C),y.draw(P,1,0,R)}else{let R=e.chartPassBindGroups[l],x=Y(e,0,l);if(R&&x>0)y.setBindGroup(0,R),y.draw(x,1,0,0)}y.end()}if(d)d.end();for(let l of e.series)if(!l.hidden)l.stale=!1;if(e.computeStale=!1,t>=0&&r){let l=Y(e,t,s.hl),B=p.beginRenderPass({colorAttachments:[A(e,"load",!0)]});if(B.setPipeline(s.pipelines[s.hl]),l>0)B.setBindGroup(0,r),B.draw(l,1,0,t);B.end()}let G=p.beginRenderPass({colorAttachments:[{view:i,loadOp:"clear",storeOp:"store",clearValue:X}]});if(G.setPipeline(Z),e.blitBindGroup)G.setBindGroup(0,e.blitBindGroup);G.draw(4),G.end(),u.queue.submit([p.finish()])}function q(){if(!z&&!v)z=!0,requestAnimationFrame(Re)}function U(e,s=!0){if(s){e.computeStale=!0;for(let t of e.series)t.stale=!0}if(e.dirty=!0,e.visible)q()}function Be(e=!0){let s=!1;for(let t of h.values()){if(e){t.computeStale=!0;for(let r of t.series)r.stale=!0}if(t.dirty=!0,t.visible)s=!0}if(s)q()}function Re(){if(z=!1,v)return;let e=performance.now();for(let s of h.values())if(s.visible&&s.dirty&&s.width>0)Se(s),s.dirty=!1;J=performance.now()-e,V++}function Ge(){let e=0;for(let s of h.values())if(s.visible&&s.width>0)e++;return e}async function xe(){if(u)return!0;if(!navigator.gpu)return postMessage({type:f.ERROR,code:b.NO_GPU}),!1;let e=await navigator.gpu.requestAdapter();if(!e)return postMessage({type:f.ERROR,code:b.NO_ADAPTER}),!1;u=await e.requestDevice({requiredLimits:{maxBufferSize:e.limits.maxBufferSize,maxStorageBufferBindingSize:e.limits.maxStorageBufferBindingSize}}),N=navigator.gpu.getPreferredCanvasFormat(),u.lost.then(()=>{if(v)return;if(v=!0,I)clearInterval(I),I=null;postMessage({type:f.ERROR,code:b.DEVICE_LOST})}),k=u.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{}}]});let s=u.createShaderModule({code:H});return Z=u.createRenderPipeline({layout:u.createPipelineLayout({bindGroupLayouts:[k]}),vertex:{module:s,entryPoint:"vs"},fragment:{module:s,entryPoint:"fs",targets:[{format:N}]},primitive:{topology:"triangle-strip"}}),j=u.createSampler({magFilter:"linear",minFilter:"linear"}),I=setInterval(()=>{postMessage({type:f.STATS,fps:V,renderMs:J,totalCharts:h.size,activeCharts:Ge()}),V=0},1000),postMessage({type:f.GPU_READY}),!0}function ne(e){if(e.ownsX!==!1)e.dataX.destroy();e.dataY.destroy();for(let[,s]of e.extraBuffers)s.destroy();for(let[,s]of e.seriesBuffers)s.destroy();e.seriesIndexBuffer.destroy()}function _(e,s,t,r,i,n){let a=Math.min(n,s-t,r.length-i);if(t>=0&&a>0)u.queue.writeBuffer(e,t*4,r,i,a)}function Pe(e,s,t,r,i,n,a){let o=h.get(e);if(!o||!u)return;let c=T.get(o.rendererName);if(!c){postMessage({type:f.ERROR,code:b.NO_RENDERER});return}try{o.minX=t.minX,o.maxX=t.maxX,o.minY=t.minY,o.maxY=t.maxY,o.perSeriesPassMeta=i;for(let p of o.series)ne(p);if(o.sharedX)o.sharedX.destroy(),o.sharedX=null;if(o.series=[],o.seriesStorageBuffer)o.seriesStorageBuffer.destroy(),o.seriesStorageBuffer=null;if(o.chartPassBindGroups=[],o.bindGroupsStale=!0,o.seriesInfoDirty=!0,o.capacity=0,s.length===0)return;o.seriesStorageBuffer=u.createBuffer({size:Math.max(32,s.length*32),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),te(o,c,r);let S=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST,g=(p)=>Math.max(n||0,p),m=(p)=>u.createBuffer({size:Math.max(16,g(p)*4),usage:S});if(a)o.sharedX=m(a.length),u.queue.writeBuffer(o.sharedX,0,a);o.capacity=Math.max(n||0,a?a.length:0);for(let p=0;p<s.length;p++){let d=s[p],G;if(a)G=o.sharedX;else G=m(d.dataX.length),u.queue.writeBuffer(G,0,d.dataX);let l=m(d.dataY.length);u.queue.writeBuffer(l,0,d.dataY);let B=a?a.length:d.dataX.length,M=Math.min(g(B),g(d.dataY.length)),y=new Map;for(let[C,P]of Object.entries(d.extra??{})){let E=m(P.length);u.queue.writeBuffer(E,0,P),y.set(C,E),M=Math.min(M,g(P.length))}let R=Math.min(d.dataY.length,B,M),x={label:d.label,colorR:d.colorR,colorG:d.colorG,colorB:d.colorB,dataX:G,ownsX:!a,dataY:l,extraBuffers:y,seriesBuffers:new Map,seriesIndexBuffer:ce(p),columns:M,pointCount:R,visibleStart:0,visibleCount:R,hidden:d.hidden??!1,stale:!0,passBindGroups:[],hlBindGroup:null};o.series.push(x),re(x,c,r)}}catch(S){postMessage({type:f.ERROR,code:b.UPDATE,message:String(S)})}}self.onmessage=async(e)=>{let{type:s,...t}=e.data;if(v)return;switch(s){case f.INIT:O=t.isDark||!1,await xe();break;case f.THEME:O=t.isDark,Be(!1);break;case f.REGISTER_RENDERER:{if(!u){postMessage({type:f.ERROR,code:b.NOT_READY});break}let r={name:t.name,shaders:t.shaders,passes:t.passes,bufferDefs:t.bufferDefs??[],uniformDefs:t.uniformDefs??[]};try{T.set(t.name,le(r))}catch(i){postMessage({type:f.ERROR,code:b.COMPILE,message:String(i)})}break}case f.REGISTER_CHART:{if(!u)break;let r=t.canvas.getContext("webgpu");if(!r){postMessage({type:f.ERROR,code:b.CTX_GET});break}try{r.configure({device:u,format:N,alphaMode:"premultiplied"})}catch(c){postMessage({type:f.ERROR,code:b.CTX_CFG});break}let i=u.limits.maxTextureDimension2D,n=Math.min(Math.max(1,Math.floor(Number(t.canvas.width)||800)),i),a=Math.min(Math.max(1,Math.floor(Number(t.canvas.height)||400)),i),o={id:t.id,canvas:t.canvas,ctx:r,rendererName:t.rendererName,visible:!0,series:[],uniformBuffer:u.createBuffer({size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),seriesStorageBuffer:null,seriesInfoDirty:!1,outputTexture:null,outputTextureView:null,msaaTexture:null,msaaView:null,blitBindGroup:null,texRenderer:null,chartBuffers:new Map,customUniformBuffer:null,customUniformValues:t.customUniformValues??{},chartPassBindGroups:[],bindGroupsStale:!0,perSeriesPassMeta:t.perSeriesPassMeta??[],width:n,height:a,panX:0,panY:0,zoomX:1,zoomY:1,minX:0,maxX:1,maxY:1,minY:0,bgColor:t.bgColor??null,sharedX:null,capacity:0,highlight:-1,hlSeries:-1,dirty:!0,computeStale:!0};try{se(o)}catch(c){postMessage({type:f.ERROR,code:b.TEX});break}h.set(t.id,o);break}case f.UNREGISTER_CHART:{let r=h.get(t.id);if(r){try{r.ctx.unconfigure()}catch{}if(r.uniformBuffer.destroy(),r.seriesStorageBuffer)r.seriesStorageBuffer.destroy();if(r.outputTexture)r.outputTexture.destroy();if(r.msaaTexture)r.msaaTexture.destroy();if(r.customUniformBuffer)r.customUniformBuffer.destroy();for(let[,i]of r.chartBuffers)i.destroy();for(let i of r.series)ne(i);if(r.sharedX)r.sharedX.destroy();h.delete(t.id)}break}case f.UPDATE_SERIES:{Pe(t.id,t.series??[],t.bounds,t.bufferSizes??{},t.perSeriesPassMeta??[],t.capacity,t.sharedX);let r=h.get(t.id);if(r)U(r);break}case f.PATCH_SERIES:{let r=h.get(t.id);if(!r||!u)break;try{let i=t.offset|0,n=t.k|0,a=r.series.length,o=t.packed,c=t.extra||[];if(t.bounds)r.minX=t.bounds.minX,r.maxX=t.bounds.maxX,r.minY=t.bounds.minY,r.maxY=t.bounds.maxY;if(t.x&&n>0)if(r.sharedX)_(r.sharedX,r.capacity,i,t.x,0,n);else for(let m of r.series)_(m.dataX,m.columns,i,t.x,0,n);if(o&&n>0)for(let m=0;m<a;m++){let p=r.series[m];_(p.dataY,p.columns,i,o,m*n,n);for(let d=0;d<c.length;d++){let G=p.extraBuffers.get(c[d]);if(G)_(G,p.columns,i,o,((d+1)*a+m)*n,n)}}let S=Math.max(0,t.count|0),g=Math.max(0,t.start|0);for(let m of r.series)m.pointCount=Math.min(S,m.columns),m.visibleStart=Math.min(g,m.pointCount),m.visibleCount=m.pointCount-m.visibleStart;r.seriesInfoDirty=!0}catch(i){postMessage({type:f.ERROR,code:b.UPDATE,message:String(i)})}U(r);break}case f.SET_BOUNDS:{let r=h.get(t.id);if(r)r.minX=t.bounds.minX,r.maxX=t.bounds.maxX,r.minY=t.bounds.minY,r.maxY=t.bounds.maxY,U(r);break}case f.RESIZE:{let r=h.get(t.id);if(!r||!(t.width>0)||!(t.height>0))break;let i=u.limits.maxTextureDimension2D,n=Math.min(Math.floor(t.width),i),a=Math.min(Math.floor(t.height),i);if(n===r.width&&a===r.height)break;if(r.width=n,r.height=a,r.canvas.width=n,r.canvas.height=a,t.perSeriesPassMeta?.length>0)r.perSeriesPassMeta=t.perSeriesPassMeta;L(r);let o=T.get(r.rendererName);try{if(o&&t.bufferSizes){let c=te(r,o,t.bufferSizes,!0);for(let S of r.series)if(re(S,o,t.bufferSizes,!0))c=!0;if(c)r.bindGroupsStale=!0}}catch(c){postMessage({type:f.ERROR,code:b.RESIZE,message:String(c)})}U(r);break}case f.VIEW_TRANSFORM:{let r=h.get(t.id);if(r)r.panX=t.panX,r.panY=t.panY,r.zoomX=Math.max(0.1,Math.min(1e6,t.zoomX)),r.zoomY=Math.max(0.1,Math.min(1e6,t.zoomY)),U(r);break}case f.BATCH_VIEW_TRANSFORM:{let r=Math.max(0.1,Math.min(1e6,t.zoomX)),i=Math.max(0.1,Math.min(1e6,t.zoomY));for(let n of t.transforms){let a=h.get(n.id);if(a)a.panX=t.panX,a.panY=t.panY,a.zoomX=r,a.zoomY=i,U(a)}break}case f.SET_VISIBILITY:{let r=h.get(t.id);if(r){if(r.visible=t.visible,!t.visible)L(r);else if(r.dirty)q()}break}case f.SET_STYLE:{let r=h.get(t.id);if(r){if(t.bgColor!==void 0)r.bgColor=t.bgColor;if(t.highlightSeries!==void 0)r.highlight=t.highlightSeries;if(t.hiddenSeries!==void 0)for(let i=0;i<r.series.length;i++)r.series[i].hidden=t.hiddenSeries.has(i);U(r,!1)}break}case f.SET_UNIFORMS:{let r=h.get(t.id);if(!r)break;Object.assign(r.customUniformValues,t.values);let i=T.get(r.rendererName);if(i)Q(r,i.config);U(r);break}}};\n';

// src/msg.ts
var M = {
  INIT: 0,
  THEME: 1,
  REGISTER_RENDERER: 2,
  REGISTER_CHART: 3,
  UNREGISTER_CHART: 4,
  UPDATE_SERIES: 5,
  RESIZE: 6,
  VIEW_TRANSFORM: 7,
  BATCH_VIEW_TRANSFORM: 8,
  SET_VISIBILITY: 9,
  SET_STYLE: 10,
  SET_UNIFORMS: 11,
  GPU_READY: 12,
  ERROR: 13,
  STATS: 14,
  PATCH_SERIES: 15,
  SET_BOUNDS: 16
};
var E = {
  NO_GPU: "e1:no-gpu",
  NO_ADAPTER: "e2:no-adapter",
  DEVICE_LOST: "e3:device-lost",
  NOT_READY: "e4:not-ready",
  COMPILE: "e5:compile",
  CTX_GET: "e6:ctx-get",
  CTX_CFG: "e7:ctx-cfg",
  TEX: "e8:tex",
  BIND_S: "e9:bind-s",
  BIND_C: "e10:bind-c",
  UPDATE: "e11:update",
  NO_RENDERER: "e12:no-renderer",
  RESIZE: "e13:resize"
};

// src/plugins/shared.ts
var MARGIN = { left: 55, right: 10, top: 8, bottom: 45 };
var DEFAULT_AXIS_WIDTH = 55;
var DEFAULT_AXIS_GAP = 6;
var Y_PLOT_CHANNELS = new Set(["open", "high", "low", "lo", "hi"]);
function yAxisDefs(chart) {
  const defs = chart.config.yAxes;
  if (!Array.isArray(defs) || defs.length === 0)
    return null;
  return defs.map((d, i) => ({
    id: d.id ?? String(i),
    side: d.side === "right" ? "right" : d.side === "left" ? "left" : i === 0 ? "left" : "right",
    width: d.width ?? DEFAULT_AXIS_WIDTH,
    format: typeof d.format === "function" ? d.format : undefined,
    color: d.color,
    min: d.min,
    max: d.max
  }));
}
function hasRightAxes(chart) {
  const defs = yAxisDefs(chart);
  return !!defs && defs.some((d) => d.side === "right");
}
function chartMargin(chart) {
  const defs = yAxisDefs(chart);
  if (!defs)
    return MARGIN;
  const gap = chart.config.yAxisGap ?? DEFAULT_AXIS_GAP;
  let left = 0, right = 0, nl = 0, nr = 0;
  for (const d of defs) {
    if (d.side === "right")
      right += (nr++ > 0 ? gap : 0) + d.width;
    else
      left += (nl++ > 0 ? gap : 0) + d.width;
  }
  return {
    left: nl > 0 ? left : MARGIN.right,
    right: nr > 0 ? right : MARGIN.right,
    top: MARGIN.top,
    bottom: MARGIN.bottom
  };
}
function yAxisStrips(chart, m, w) {
  const defs = yAxisDefs(chart);
  if (!defs)
    return null;
  const gap = chart.config.yAxisGap ?? DEFAULT_AXIS_GAP;
  let leftEdge = m.left, rightEdge = w - m.right;
  return defs.map((d, i) => {
    const axis = chart.yAxes?.[i];
    if (d.side === "right") {
      const strip = { ...d, axis, x0: rightEdge, x1: rightEdge + d.width };
      rightEdge += d.width + gap;
      return strip;
    }
    const strip = { ...d, axis, x0: leftEdge - d.width, x1: leftEdge };
    leftEdge -= d.width + gap;
    return strip;
  });
}
function seriesAxisFormat(chart, seriesIndex) {
  const ax = chart.yAxes?.[chart.series[seriesIndex]?.axisIndex ?? 0];
  return ax?.format ?? chart.config.formatY ?? String;
}
var TICK_MIN_RELATIVE_STEP = 2 ** -51;
function niceTicks(min, max, count) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(count > 0))
    return [];
  const range = max - min;
  if (!(range > 0))
    return [min];
  const rough = range / count;
  const exp = Math.floor(Math.log10(rough));
  const res = rough / 10 ** exp;
  const nice = res <= 1.5 ? 1 : res <= 3 ? 2 : res <= 7 ? 5 : 10;
  const step = nice * 10 ** exp;
  const magnitude = Math.max(Math.abs(min), Math.abs(max));
  if (!Number.isFinite(step) || !(step > magnitude * TICK_MIN_RELATIVE_STEP))
    return [];
  const div = exp < 0 ? 10 ** -exp : 1;
  const at = div > 1 && Number.isFinite(div) ? (k) => k * nice / div : (k) => k * step;
  const first = Math.ceil(min / step);
  const n = Math.min(Math.floor(max / step) - first + 1, 10 * count + 10);
  const ticks = [];
  for (let i = 0;i < n; i++) {
    const v = at(first + i);
    if (v > max)
      break;
    if (v < min || ticks.length > 0 && v <= ticks[ticks.length - 1])
      continue;
    ticks.push(v);
  }
  return ticks;
}
var HOME_EPSILON = 0.000000001;
function rebaseAxis(pan, zoom, homePan, homeZoom, newPan, newZoom) {
  const atHome = Math.abs(pan - homePan) <= HOME_EPSILON && Math.abs(zoom - homeZoom) <= HOME_EPSILON;
  if (atHome || !(zoom > 0 && homeZoom > 0 && newZoom > 0))
    return [newPan, newZoom];
  const z = zoom * newZoom / homeZoom;
  return [pan + -homePan * homeZoom / zoom - -newPan * newZoom / z, z];
}
function rebaseViewOnHomeChange(view, oldHome, newHome) {
  const [panX, zoomX] = rebaseAxis(view.panX, view.zoomX, oldHome.panX, oldHome.zoomX, newHome.panX, newHome.zoomX);
  const [panY, zoomY] = rebaseAxis(view.panY, view.zoomY, oldHome.panY, oldHome.zoomY, newHome.panY, newHome.zoomY);
  return { panX, panY, zoomX, zoomY };
}
var MIN_RELATIVE_SPAN = 2 ** -36;
function floatZoomLimit(min, max, anchor = 0) {
  const full = max - min;
  const magnitude = Math.max(Math.abs(min), Math.abs(max), Number.isFinite(anchor) ? Math.abs(anchor) : 0);
  if (!(full > 0) || !Number.isFinite(full) || !(magnitude > 0) || !Number.isFinite(magnitude))
    return Infinity;
  return full / (magnitude * MIN_RELATIVE_SPAN);
}
var CLICK_AFTER_DRAG_MS = 100;
function clickFollowsDrag(chart, now = Date.now()) {
  const t = chart.lastDragEndTime;
  return t != null && now - t < CLICK_AFTER_DRAG_MS;
}
function chartDpr(chart) {
  return chart.dpr || globalThis.devicePixelRatio || 1;
}
function sameKey(a, b) {
  if (!a || a.length !== b.length)
    return false;
  for (let i = 0;i < a.length; i++)
    if (!Object.is(a[i], b[i]))
      return false;
  return true;
}
function hiddenKey(chart) {
  const hidden = chart.config.hiddenSeries;
  return hidden && hidden.size > 0 ? [...hidden].join(",") : "";
}

// src/chart-library.ts
class Chart {
  id;
  _mgr;
  constructor(id, mgr) {
    this.id = id;
    this._mgr = mgr;
  }
  get _c() {
    return this._mgr["charts"].get(this.id);
  }
  setData(series, opts) {
    this._mgr.updateSeries(this.id, series, opts);
  }
  patchData(patch) {
    this._mgr.patchSeries(this.id, patch);
  }
  setBounds(bounds, resetView = false) {
    this._mgr.setBounds(this.id, bounds, resetView);
  }
  configure(patch) {
    this._mgr.configureChart(this.id, patch);
  }
  addPlugin(plugin) {
    const c = this._c;
    if (!c || c.plugins.some((p) => p.name === plugin.name))
      return;
    const wrap = c.el.querySelector("div");
    plugin.install?.(c, wrap);
    c.plugins.push(plugin);
    this._mgr.drawChart(c);
  }
  removePlugin(name) {
    const c = this._c;
    if (!c)
      return;
    const idx = c.plugins.findIndex((p) => p.name === name);
    if (idx >= 0) {
      c.plugins[idx].uninstall?.(c);
      c.plugins.splice(idx, 1);
      this._mgr.drawChart(c);
    }
  }
  hasPlugin(name) {
    return this._c?.plugins.some((p) => p.name === name) ?? false;
  }
  resetView() {
    this._mgr.resetView(this.id);
  }
  destroy() {
    this._mgr.destroy(this.id);
  }
}
var GPU_GAP = -300000000000000000000000000000000000000;
var GPU_X_GAP_SORTED = 300000000000000000000000000000000000000;
function isNumericArray(v) {
  return Array.isArray(v) || ArrayBuffer.isView(v) && !(v instanceof DataView);
}
function toGpu(arr, scale = 1, offset = 0, gap = GPU_GAP) {
  const n = arr.length;
  const out = new Float32Array(n);
  for (let i = 0;i < n; i++) {
    const v = arr[i];
    out[i] = v == null || v !== v ? gap : v * scale + offset;
  }
  return out;
}
function xGap(chart) {
  return chart.renderer.sortX !== false ? GPU_X_GAP_SORTED : GPU_GAP;
}
function packInto(dst, dstOffset, src, srcOffset, k, scale = 1, offset = 0) {
  for (let i = 0;i < k; i++) {
    const v = src[srcOffset + i];
    dst[dstOffset + i] = v == null || v !== v ? GPU_GAP : v * scale + offset;
  }
}
function mapInto(dst, dstOffset, src, srcOffset, k, scale, offset) {
  for (let i = 0;i < k; i++) {
    const v = src[srcOffset + i];
    dst[dstOffset + i] = v == null || v !== v ? NaN : v * scale + offset;
  }
}
function view(arr, start, end) {
  if (start === 0 && arr.length === end)
    return arr;
  const a = arr;
  return typeof a.subarray === "function" ? a.subarray(start, end) : Array.prototype.slice.call(arr, start, end);
}
var ORIGIN_PERIODS = [86400000, 3600000, 86400, 60000, 3600, 1000, 60, 1];
function chooseOriginX(minX, maxX) {
  if (!Number.isFinite(minX))
    return 0;
  const range = Number.isFinite(maxX) && maxX > minX ? maxX - minX : 0;
  const limit = 16 * range;
  if (minX >= 0 && minX <= limit)
    return 0;
  for (const p of ORIGIN_PERIODS)
    if (p <= limit)
      return Math.floor(minX / p) * p;
  return Math.floor(minX);
}
var REORIGIN_SPANS = 64;
function finiteRange(arr, sorted) {
  const n = arr.length;
  let lo = Infinity, hi = -Infinity;
  if (sorted) {
    for (let i = 0;i < n; i++) {
      const v = arr[i];
      if (v != null && v - v === 0) {
        lo = v;
        break;
      }
    }
    for (let i = n - 1;i >= 0; i--) {
      const v = arr[i];
      if (v != null && v - v === 0) {
        hi = v;
        break;
      }
    }
    return [lo, hi];
  }
  for (let i = 0;i < n; i++) {
    const v = arr[i];
    if (v == null || v - v !== 0)
      continue;
    if (v < lo)
      lo = v;
    if (v > hi)
      hi = v;
  }
  return [lo, hi];
}
function sortIndices(a, m, keys) {
  const RUN = 32;
  for (let lo = 0;lo < m; lo += RUN) {
    const hi = Math.min(lo + RUN, m);
    for (let i = lo + 1;i < hi; i++) {
      const t = a[i], kt = keys[t];
      let j = i - 1;
      while (j >= lo && keys[a[j]] > kt) {
        a[j + 1] = a[j];
        j--;
      }
      a[j + 1] = t;
    }
  }
  if (m <= RUN)
    return;
  let src = a, dst = new Uint32Array(m);
  for (let w = RUN;w < m; w *= 2) {
    for (let lo = 0;lo < m; lo += 2 * w) {
      const mid = Math.min(lo + w, m), hi = Math.min(lo + 2 * w, m);
      if (mid >= hi || keys[src[mid - 1]] <= keys[src[mid]]) {
        dst.set(src.subarray(lo, hi), lo);
        continue;
      }
      let i = lo, j = mid, k = lo;
      while (i < mid && j < hi)
        dst[k++] = keys[src[j]] < keys[src[i]] ? src[j++] : src[i++];
      while (i < mid)
        dst[k++] = src[i++];
      while (j < hi)
        dst[k++] = src[j++];
    }
    const t = src;
    src = dst;
    dst = t;
  }
  if (src !== a)
    a.set(src.subarray(0, m));
}
function sortOrder(x) {
  const n = x.length;
  let asc = true, desc = true, gap = false, prev = NaN;
  for (let i = 0;i < n && (asc || desc); i++) {
    const v = x[i];
    if (v == null || v !== v) {
      gap = true;
      desc = false;
      continue;
    }
    if (gap)
      asc = false;
    if (prev === prev) {
      if (v < prev)
        asc = false;
      else if (v > prev)
        desc = false;
    }
    prev = v;
  }
  if (asc)
    return null;
  const order = new Uint32Array(n);
  if (desc) {
    for (let i = 0;i < n; i++)
      order[i] = n - 1 - i;
    return order;
  }
  const keys = new Float64Array(n);
  let m = 0;
  for (let i = 0;i < n; i++) {
    const v = x[i];
    if (v == null || v !== v)
      continue;
    keys[i] = v;
    order[m++] = i;
  }
  let g = m;
  for (let i = 0;i < n; i++) {
    const v = x[i];
    if (v == null || v !== v)
      order[g++] = i;
  }
  sortIndices(order, m, keys);
  return order;
}
function permute(arr, order) {
  const n = order.length;
  const out = new Float64Array(n);
  for (let i = 0;i < n; i++) {
    const v = arr[order[i]];
    out[i] = v == null ? NaN : v;
  }
  return out;
}
function packColor(r, g, b) {
  return (Math.round(r * 255) & 255 | (Math.round(g * 255) & 255) << 8 | (Math.round(b * 255) & 255) << 16 | 255 << 24) >>> 0;
}
function isColorArray(v) {
  if (!Array.isArray(v) && !(ArrayBuffer.isView(v) && !(v instanceof DataView)))
    return false;
  const a = v;
  if (a.length !== 3 && a.length !== 4)
    return false;
  for (let i = 0;i < a.length; i++)
    if (typeof a[i] !== "number")
      return false;
  return true;
}
function normalizeUniform(def, value) {
  if (typeof value === "number")
    return value;
  if (typeof value === "boolean")
    return value ? 1 : 0;
  if (typeof value === "string") {
    const v = def.values?.[value] ?? def.values?.[value.toLowerCase()];
    return typeof v === "number" ? v : undefined;
  }
  if (def.type === "u32" && isColorArray(value))
    return packColor(value[0], value[1], value[2]);
  return;
}
function sameValue(a, b) {
  if (Object.is(a, b))
    return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b)
    return false;
  if (Array.isArray(a) !== Array.isArray(b))
    return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length)
    return false;
  for (const k of ka)
    if (!sameValue(a[k], b[k]))
      return false;
  return true;
}
var BOUND_KEYS = ["minX", "maxX", "minY", "maxY"];
function definedSides(b) {
  const r = {};
  if (b)
    for (const k of BOUND_KEYS) {
      const v = b[k];
      if (typeof v === "number" && Number.isFinite(v))
        r[k] = v;
    }
  return r;
}
function isRgb(v) {
  return isColorArray(v);
}
function cssRgb(c) {
  return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
}
var _colorEl = null;
function parseColor(c) {
  if (typeof c !== "string")
    return c;
  if (!_colorEl) {
    _colorEl = document.createElement("i");
    _colorEl.style.cssText = "display:none";
    document.body.appendChild(_colorEl);
  }
  _colorEl.style.color = c;
  const m = getComputedStyle(_colorEl).color.match(/\d+/g);
  return { r: +m[0] / 255, g: +m[1] / 255, b: +m[2] / 255 };
}
function currentDpr() {
  const d = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
  return d > 0 ? d : 1;
}
function resizeCanvas(canvas, cssW, cssH, dpr) {
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  if (canvas instanceof HTMLCanvasElement) {
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }
}
function makeLayer(z, events) {
  const c = document.createElement("canvas");
  c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:${events};z-index:${z};`;
  return c;
}
function plotEdges(chart, axis) {
  const hv = chart.homeView;
  const pan = axis === "x" ? hv.panX : hv.panY;
  const zoom = axis === "x" ? hv.zoomX : hv.zoomY;
  const a = -pan * zoom, b = (1 - pan) * zoom;
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? [a, b] : [0, 1];
}
function visibleRange(chart, axis) {
  const [uL, uR] = plotEdges(chart, axis);
  const { bounds: b, view: v } = chart;
  const min = axis === "x" ? b.minX : b.minY;
  const full = (axis === "x" ? b.maxX : b.maxY) - min;
  const pan = axis === "x" ? v.panX : v.panY;
  const zoom = axis === "x" ? v.zoomX : v.zoomY;
  return [min + (pan + uL / zoom) * full, min + (pan + uR / zoom) * full];
}
function viewFor(chart, axis, lo, hi) {
  const [uL, uR] = plotEdges(chart, axis);
  const b = chart.bounds;
  const min = axis === "x" ? b.minX : b.minY;
  const full = (axis === "x" ? b.maxX : b.maxY) - min;
  const aL = (lo - min) / full, aR = (hi - min) / full;
  if (!Number.isFinite(aL) || !Number.isFinite(aR) || !(aR > aL))
    return null;
  const zoom = (uR - uL) / (aR - aL);
  return { pan: aL - uL / zoom, zoom };
}

class _ChartManager {
  static instance = null;
  worker = null;
  charts = new Map;
  states = new WeakMap;
  renderers = new Map;
  uiPlugins = [];
  chartIdCounter = 0;
  _isDark = false;
  _syncViews = false;
  initPromise = null;
  _ready = false;
  failed = false;
  deviceLosses = [];
  statsCallbacks = [];
  viewListeners = new Set;
  drawing = new Set;
  redraw = new Set;
  currentStats = {
    fps: 0,
    renderMs: 0,
    total: 0,
    active: 0
  };
  visibilityObserver;
  resizeObserver;
  constructor() {
    this._isDark = document.documentElement.classList.contains("dark");
    this.visibilityObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = e.target.dataset.chartId;
        if (!id)
          continue;
        const chart = this.charts.get(id);
        if (!chart)
          continue;
        chart.visible = e.isIntersecting;
        this.post({ type: M.SET_VISIBILITY, id, visible: e.isIntersecting });
        if (e.isIntersecting)
          this.drawChart(chart);
      }
    }, { threshold: 0.01 });
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const e of entries) {
        const id = e.target.dataset.chartId;
        if (!id)
          continue;
        const chart = this.charts.get(id);
        if (!chart)
          continue;
        const { width, height } = e.contentRect;
        if (width <= 0 || height <= 0)
          continue;
        this.resizeChart(chart, width, height);
      }
    });
    this.watchDpr();
  }
  static getInstance() {
    if (!_ChartManager.instance)
      _ChartManager.instance = new _ChartManager;
    return _ChartManager.instance;
  }
  get isDark() {
    return this._isDark;
  }
  get syncViews() {
    return this._syncViews;
  }
  get ready() {
    return this._ready;
  }
  use(plugin) {
    if ("passes" in plugin) {
      const r = plugin;
      this.renderers.set(r.name, r);
      if (this._ready)
        this.sendRendererRegistration(r);
    } else {
      const p = plugin;
      if (!this.uiPlugins.some((x) => x.name === p.name))
        this.uiPlugins.push(p);
    }
  }
  init() {
    if (!this.initPromise) {
      this.initPromise = this.startWorker().then((ok) => {
        if (!ok)
          this.failed = true;
        return ok;
      });
    }
    return this.initPromise;
  }
  startWorker() {
    return new Promise((resolve) => {
      const attach = (worker) => {
        this.worker = worker;
        this.setupWorkerHandlers(worker, resolve);
      };
      const fallback = () => {
        try {
          attach(new Worker(new URL("./gpu-worker.js", import.meta.url), { type: "module" }));
        } catch (e) {
          console.error("chartai:", e);
          resolve(false);
        }
      };
      Promise.resolve().then(() => ({})).then(({}) => {
        const blob = new Blob([WORKER_CODE], {
          type: "application/javascript"
        });
        let worker;
        try {
          worker = new Worker(URL.createObjectURL(blob), { type: "module" });
        } catch {
          fallback();
          return;
        }
        attach(worker);
      }).catch(fallback);
    });
  }
  setupWorkerHandlers(worker, resolve) {
    worker.onmessage = (e) => {
      if (worker !== this.worker)
        return;
      const { type, ...data } = e.data;
      switch (type) {
        case M.GPU_READY:
          this.onGpuReady();
          resolve(true);
          break;
        case M.ERROR:
          if (data.code === E.DEVICE_LOST && this._ready) {
            this.handleDeviceLost();
            break;
          }
          console.error("chartai:", data.code, data.message ?? "");
          if (!this._ready)
            resolve(false);
          break;
        case M.STATS:
          this.currentStats = {
            fps: data.fps,
            renderMs: data.renderMs,
            total: data.totalCharts,
            active: data.activeCharts
          };
          for (const cb of this.statsCallbacks)
            cb(this.currentStats);
          break;
      }
    };
    worker.onerror = (e) => {
      if (worker !== this.worker)
        return;
      console.error("chartai:", e);
      if (!this._ready)
        resolve(false);
    };
    worker.postMessage({ type: M.INIT, isDark: this._isDark });
  }
  onGpuReady() {
    this._ready = true;
    for (const r of this.renderers.values())
      this.sendRendererRegistration(r);
    for (const chart of this.charts.values()) {
      try {
        this.registerChart(chart);
      } catch (e) {
        console.error("chartai:", e);
        continue;
      }
      if (!chart.visible)
        this.post({ type: M.SET_VISIBILITY, id: chart.id, visible: false });
      this.uploadSeries(chart);
      this.sendViewTransform(chart);
      this.drawChart(chart);
    }
  }
  handleDeviceLost() {
    const now = Date.now();
    this.deviceLosses = this.deviceLosses.filter((t) => now - t < 60000);
    this.deviceLosses.push(now);
    const old = this.worker;
    this._ready = false;
    this.worker = null;
    old?.terminate();
    if (this.deviceLosses.length > 3) {
      this.failed = true;
      console.error("chartai: the GPU device was lost repeatedly; reload the page to draw again");
      return;
    }
    console.warn("chartai: the GPU device was lost; restarting the GPU worker");
    this.startWorker().then((ok) => {
      if (!ok)
        console.error("chartai: the GPU could not be restarted after a device loss");
    });
  }
  post(msg, transfer) {
    if (!this._ready || !this.worker)
      return;
    if (transfer)
      this.worker.postMessage(msg, transfer);
    else
      this.worker.postMessage(msg);
  }
  state(chart) {
    let st = this.states.get(chart);
    if (!st) {
      st = {
        offscreen: null,
        colStart: 0,
        colBase: 0,
        srcX: [],
        plotBuf: [],
        plotBase: [],
        hiddenOverrides: new Map
      };
      this.states.set(chart, st);
    }
    return st;
  }
  sendRendererRegistration(renderer) {
    const bufferDefs = (renderer.buffers ?? []).map((buf) => ({
      name: buf.name,
      usages: buf.usages,
      perSeries: renderer.passes.some((p) => p.perSeries !== false && p.bindings.some((b) => b.source === buf.name))
    }));
    this.post({
      type: M.REGISTER_RENDERER,
      name: renderer.name,
      shaders: renderer.shaders,
      passes: renderer.passes.map((p) => ({
        type: p.type,
        shader: p.shader,
        bindings: p.bindings,
        perSeries: p.perSeries !== false,
        topology: p.topology,
        loadOp: p.loadOp,
        blend: p.blend,
        highlight: p.highlight === true
      })),
      bufferDefs,
      uniformDefs: renderer.uniforms ?? []
    });
  }
  registerChart(chart) {
    const st = this.state(chart);
    let offscreen = st.offscreen;
    st.offscreen = null;
    if (!offscreen) {
      const fresh = makeLayer(1, "auto");
      if (chart.gpuCanvas?.parentNode)
        chart.gpuCanvas.replaceWith(fresh);
      else
        chart.frontCanvas.parentNode?.insertBefore(fresh, chart.frontCanvas);
      chart.gpuCanvas = fresh;
      offscreen = fresh.transferControlToOffscreen();
    }
    resizeCanvas(offscreen, chart.width, chart.height, chart.dpr);
    this.post({
      type: M.REGISTER_CHART,
      id: chart.id,
      canvas: offscreen,
      rendererName: chart.config.type,
      bgColor: isRgb(chart.config.bgColor) ? chart.config.bgColor : null,
      ...this.computeRendererMeta(chart.renderer, chart),
      customUniformValues: this.gpuUniforms(chart),
      width: Math.round(chart.width * chart.dpr),
      height: Math.round(chart.height * chart.dpr)
    }, [offscreen]);
  }
  computeRendererMeta(renderer, chart) {
    const bufferSizes = {};
    const perSeriesPassMeta = [];
    const series = chart.series.length > 0 ? chart.series : [
      {
        rawX: [],
        rawY: [],
        extra: {},
        label: "",
        color: { r: 0, g: 0, b: 0 }
      }
    ];
    const dpr = chart.dpr || 1;
    const physW = Math.round(chart.width * dpr);
    const physH = Math.round(chart.height * dpr);
    for (const s of series) {
      const ctx = {
        width: physW,
        height: physH,
        samples: Math.max(s.rawX.length, chart.capacity ?? 0),
        seriesCount: series.length,
        bounds: chart.bounds,
        view: chart.view
      };
      for (const buf of renderer.buffers ?? []) {
        const size = buf.bytes(ctx);
        bufferSizes[buf.name] = Math.max(bufferSizes[buf.name] ?? 0, size);
      }
      perSeriesPassMeta.push(renderer.passes.map((p) => ({
        dispatch: p.dispatch?.(ctx),
        draw: p.draw?.(ctx)
      })));
    }
    return { bufferSizes, perSeriesPassMeta };
  }
  create(config) {
    if (!this.initPromise)
      throw new Error("No worker. Call init().");
    if (this.failed)
      throw new Error("chartai: WebGPU is not available (init() failed).");
    const renderer = this.renderers.get(config.type);
    if (!renderer)
      throw new Error(`No renderer "${config.type}". Call manager.use() first.`);
    const id = `chart-${++this.chartIdCounter}`;
    const el = document.createElement("div");
    el.dataset.chartId = id;
    el.style.cssText = "width:100%;height:100%;position:relative;";
    const wrap = document.createElement("div");
    wrap.dataset.chartId = id;
    wrap.style.cssText = "width:100%;height:100%;position:relative;";
    const backCanvas = makeLayer(0, "none");
    const gpuCanvas = makeLayer(1, "auto");
    const frontCanvas = makeLayer(2, "none");
    wrap.append(backCanvas, gpuCanvas, frontCanvas);
    el.appendChild(wrap);
    config.container.appendChild(el);
    let offscreen;
    try {
      offscreen = gpuCanvas.transferControlToOffscreen();
    } catch (e) {
      el.remove();
      throw new Error(`Failed OffscreenCanvas: ${e}`);
    }
    const rect = wrap.getBoundingClientRect();
    const cssW = rect.width || 400;
    const cssH = rect.height || 200;
    const dpr = currentDpr();
    resizeCanvas(backCanvas, cssW, cssH, dpr);
    resizeCanvas(frontCanvas, cssW, cssH, dpr);
    if (isRgb(config.bgColor))
      wrap.style.background = cssRgb(config.bgColor);
    const chart = {
      id,
      config,
      el,
      backCanvas,
      frontCanvas,
      gpuCanvas,
      width: cssW,
      height: cssH,
      dpr,
      series: [],
      bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
      runtimeBounds: null,
      originX: 0,
      view: { panX: 0, panY: 0, zoomX: 1, zoomY: 1 },
      homeView: { panX: 0, panY: 0, zoomX: 1, zoomY: 1 },
      visible: true,
      dragging: false,
      plugins: [...this.uiPlugins],
      renderer,
      customUniforms: {}
    };
    this.charts.set(id, chart);
    this.state(chart).offscreen = offscreen;
    renderer.install?.(chart, wrap);
    chart.customUniforms = this.resolveUniforms(renderer, config);
    if (this._ready)
      this.registerChart(chart);
    this.visibilityObserver.observe(el);
    this.resizeObserver.observe(wrap);
    for (const plugin of chart.plugins)
      plugin.install?.(chart, wrap);
    this.updateSeries(id, Array.isArray(config.series) ? config.series : [], {
      capacity: config.capacity
    });
    return new Chart(id, this);
  }
  resolveUniforms(renderer, config) {
    const values = {};
    for (const u of renderer.uniforms ?? [])
      values[u.name] = normalizeUniform(u, config[u.name]) ?? u.default;
    return values;
  }
  gpuUniforms(chart, names) {
    const out = {};
    const o = chart.originX ?? 0;
    for (const u of chart.renderer.uniforms ?? []) {
      if (names && !names.includes(u.name))
        continue;
      const v = chart.customUniforms[u.name] ?? u.default;
      out[u.name] = u.xPosition ? v - o : v;
    }
    return out;
  }
  gpuBounds(chart) {
    const b = chart.bounds, o = chart.originX ?? 0;
    return { minX: b.minX - o, maxX: b.maxX - o, minY: b.minY, maxY: b.maxY };
  }
  destroy(id) {
    const chart = this.charts.get(id);
    if (!chart)
      return;
    chart.renderer.uninstall?.(chart);
    for (const p of chart.plugins)
      p.uninstall?.(chart);
    this.visibilityObserver.unobserve(chart.el);
    const wrap = chart.el.querySelector("div");
    if (wrap)
      this.resizeObserver.unobserve(wrap);
    chart.el.remove();
    this.post({ type: M.UNREGISTER_CHART, id });
    this.charts.delete(id);
  }
  updateSeries(id, series, opts = {}) {
    const chart = this.charts.get(id);
    if (!chart)
      return;
    const list = Array.isArray(series) ? series : [];
    const sortX = chart.renderer.sortX !== false;
    const sorted = new Map;
    chart.series = list.map((s) => {
      let e = sorted.get(s.x);
      if (!e) {
        const order = sortX ? sortOrder(s.x) : null;
        e = { order, x: order ? permute(s.x, order) : s.x };
        sorted.set(s.x, e);
      }
      const order = e.order;
      const pick = (arr) => order ? permute(arr, order) : arr;
      const extra = {};
      for (const key in s) {
        if (key !== "label" && key !== "color" && key !== "x" && key !== "y" && isNumericArray(s[key])) {
          extra[key] = pick(s[key]);
        }
      }
      return {
        label: s.label,
        color: parseColor(s.color),
        hidden: !!s.hidden,
        yAxis: s.yAxis,
        rawX: e.x,
        rawY: pick(s.y),
        extra
      };
    });
    const st = this.state(chart);
    st.colStart = 0;
    st.colBase = 0;
    st.srcX = chart.series.map((s) => s.rawX);
    st.plotBuf = [];
    st.plotBase = [];
    const labels = new Set(chart.series.map((s) => s.label));
    for (const label of [...st.hiddenOverrides.keys()])
      if (!labels.has(label))
        st.hiddenOverrides.delete(label);
    chart.config.hiddenSeries = this.hiddenSet(chart);
    chart.runtimeBounds = opts.bounds ? definedSides(opts.bounds) : null;
    this.refreshSeriesData(chart, opts.capacity);
  }
  hiddenSet(chart) {
    const overrides = this.state(chart).hiddenOverrides;
    const set = new Set;
    chart.series.forEach((s, i) => {
      if (overrides.get(s.label) ?? s.hidden)
        set.add(i);
    });
    return set;
  }
  refreshSeriesData(chart, capacity) {
    let longest = 0;
    for (const s of chart.series)
      if (s.rawX.length > longest)
        longest = s.rawX.length;
    chart.capacity = Math.max(capacity ?? chart.capacity ?? 0, longest);
    this.deriveBounds(chart);
    this.uploadSeries(chart);
    this.sendViewTransform(chart);
    this.drawChart(chart);
  }
  deriveBounds(chart) {
    const axes = yAxisDefs(chart);
    chart.yAxes = axes;
    const series = chart.series;
    const st = this.state(chart);
    const customBounds = chart.renderer.computeBounds?.(series, chart);
    const db = definedSides(chart.config.defaultBounds);
    const rb = definedSides(chart.runtimeBounds);
    let minX, maxX, minY, maxY;
    if (customBounds) {
      minX = customBounds.minX;
      maxX = customBounds.maxX;
    } else {
      const sorted = chart.renderer.sortX !== false;
      let lo = Infinity, hi = -Infinity;
      for (const s of series) {
        const [a, b] = finiteRange(s.rawX, sorted);
        if (a < lo)
          lo = a;
        if (b > hi)
          hi = b;
      }
      if (!(lo <= hi)) {
        lo = 0;
        hi = 1;
      }
      const px = (hi - lo) * 0.05 || 1;
      minX = lo - px;
      maxX = hi + px;
    }
    minX = rb.minX ?? db.minX ?? minX;
    maxX = rb.maxX ?? db.maxX ?? maxX;
    st.plotBuf = [];
    st.plotBase = [];
    if (!axes) {
      for (const s of series) {
        s.axisIndex = 0;
        s.plotY = s.rawY;
      }
      if (customBounds) {
        minY = customBounds.minY;
        maxY = customBounds.maxY;
      } else {
        let lo = Infinity, hi = -Infinity;
        for (const s of series) {
          const [a, b] = finiteRange(s.rawY, false);
          if (a < lo)
            lo = a;
          if (b > hi)
            hi = b;
        }
        if (!(lo <= hi)) {
          lo = 0;
          hi = 1;
        }
        const py = (hi - lo) * 0.1 || 1;
        minY = lo - py;
        maxY = hi + py;
      }
      minY = rb.minY ?? db.minY ?? minY;
      maxY = rb.maxY ?? db.maxY ?? maxY;
    } else {
      const byId = new Map(axes.map((a, i) => [a.id, i]));
      for (const s of series)
        s.axisIndex = s.yAxis != null && byId.has(String(s.yAxis)) ? byId.get(String(s.yAxis)) : 0;
      for (let ai = 0;ai < axes.length; ai++) {
        const ax = axes[ai];
        let lo = Infinity, hi = -Infinity;
        for (const s of series) {
          if (s.axisIndex !== ai)
            continue;
          const arrays = [s.rawY];
          for (const key of Y_PLOT_CHANNELS)
            if (s.extra[key])
              arrays.push(s.extra[key]);
          for (const arr of arrays) {
            const [a, b] = finiteRange(arr, false);
            if (a < lo)
              lo = a;
            if (b > hi)
              hi = b;
          }
        }
        if (!(lo <= hi)) {
          lo = 0;
          hi = 1;
        }
        const pad = (hi - lo) * 0.1 || 1;
        ax.min = ax.min ?? lo - pad;
        ax.max = ax.max ?? hi + pad;
      }
      axes[0].min = rb.minY ?? db.minY ?? axes[0].min;
      axes[0].max = rb.maxY ?? db.maxY ?? axes[0].max;
      const prim = axes[0];
      const primRange = prim.max - prim.min || 1;
      for (const ax of axes) {
        const r = ax.max - ax.min || 1;
        ax.scale = primRange / r;
        ax.offset = prim.min - ax.min * ax.scale;
      }
      minY = prim.min;
      maxY = prim.max;
      series.forEach((s, i) => {
        const ax = axes[s.axisIndex];
        if (ax.scale === 1 && ax.offset === 0) {
          s.plotY = s.rawY;
          return;
        }
        const n = s.rawY.length;
        const buf = new Float64Array(Math.max(n, chart.capacity ?? 0, 1));
        mapInto(buf, 0, s.rawY, 0, n, ax.scale, ax.offset);
        st.plotBuf[i] = buf;
        st.plotBase[i] = st.colStart;
        s.plotY = buf.subarray(0, n);
      });
    }
    chart.bounds = { minX, maxX, minY, maxY };
  }
  pickOrigin(chart) {
    const sorted = chart.renderer.sortX !== false;
    let lo = Infinity, hi = -Infinity;
    for (const s of chart.series) {
      const [a, b] = finiteRange(s.rawX, sorted);
      if (a < lo)
        lo = a;
      if (b > hi)
        hi = b;
    }
    if (!(lo <= hi)) {
      lo = chart.bounds.minX;
      hi = chart.bounds.maxX;
    }
    return chooseOriginX(lo, hi);
  }
  uploadSeries(chart) {
    const st = this.state(chart);
    st.colBase = st.colStart;
    chart.originX = this.pickOrigin(chart);
    if (!this._ready)
      return;
    const o = chart.originX;
    const axes = chart.yAxes;
    const { bufferSizes, perSeriesPassMeta } = this.computeRendererMeta(chart.renderer, chart);
    const hidden = chart.config.hiddenSeries ?? new Set;
    const first = chart.series[0];
    const sharedX = first && chart.series.every((s) => s.rawX === first.rawX) ? first.rawX : null;
    const sharedXData = sharedX ? toGpu(sharedX, 1, -o, xGap(chart)) : null;
    const seriesData = chart.series.map((s, i) => {
      const ax = axes?.[s.axisIndex];
      const mapped = !!ax && (ax.scale !== 1 || ax.offset !== 0);
      const extra = {};
      for (const key in s.extra) {
        const scale = mapped && (Y_PLOT_CHANNELS.has(key) || key === "h") ? ax.scale : 1;
        const offset = mapped && Y_PLOT_CHANNELS.has(key) ? ax.offset : 0;
        extra[key] = toGpu(s.extra[key], scale, offset);
      }
      return {
        label: s.label,
        colorR: s.color.r,
        colorG: s.color.g,
        colorB: s.color.b,
        dataX: sharedXData ? null : toGpu(s.rawX, 1, -o, xGap(chart)),
        dataY: toGpu(s.plotY ?? s.rawY),
        extra,
        hidden: hidden.has(i)
      };
    });
    const transferables = seriesData.flatMap((s) => [
      ...s.dataX ? [s.dataX.buffer] : [],
      s.dataY.buffer,
      ...Object.values(s.extra).map((a) => a.buffer)
    ]);
    if (sharedXData)
      transferables.push(sharedXData.buffer);
    this.post({
      type: M.UPDATE_SERIES,
      id: chart.id,
      series: seriesData,
      bounds: this.gpuBounds(chart),
      bufferSizes,
      perSeriesPassMeta,
      capacity: chart.capacity,
      sharedX: sharedXData
    }, transferables);
    const xUniforms = (chart.renderer.uniforms ?? []).filter((u) => u.xPosition).map((u) => u.name);
    if (xUniforms.length > 0)
      this.post({ type: M.SET_UNIFORMS, id: chart.id, values: this.gpuUniforms(chart, xUniforms) });
  }
  patchSeries(id, patch) {
    const chart = this.charts.get(id);
    if (!chart || chart.series.length === 0)
      return;
    const st = this.state(chart);
    const { offset, count, series, bounds } = patch;
    const start = patch.start ?? 0;
    const x = patch.x ?? null;
    const n = chart.series.length;
    const cap = chart.capacity ?? 0;
    const extraKeys = Object.keys(chart.series[0].extra);
    const isIndex = (v) => Number.isInteger(v) && v >= 0;
    if (!Array.isArray(series) || series.length !== n || !isIndex(offset) || !isIndex(count) || !isIndex(start) || offset > count || start > count || count - start > cap)
      throw new Error(`patchData: ${Array.isArray(series) ? series.length : 0} series with columns ${offset}..${count} (from ${start}) do not fit a chart of ${n} series x ${cap} columns`);
    if (x && x.length < count)
      throw new Error(`patchData: x has ${x.length} values for ${count} columns`);
    for (let i = 0;i < n; i++) {
      const p = series[i];
      if (!p || !p.y || p.y.length < count)
        throw new Error(`patchData: series ${i} has ${p?.y?.length ?? 0} y values for ${count} columns`);
      for (const key of extraKeys) {
        const arr = p[key];
        if (!arr || arr.length < count)
          throw new Error(`patchData: series ${i} channel "${key}" has ${arr?.length ?? 0} values for ${count} columns`);
      }
      if (!x && !(st.srcX[i] && st.srcX[i].length >= count))
        throw new Error(`patchData: no x for columns up to ${count}; pass x`);
    }
    const prevEnd = st.colStart + chart.series[0].rawX.length;
    const srcX = x ? chart.series.map(() => x) : st.srcX;
    const sharedSrc = srcX.every((a) => a === srcX[0]) ? srcX[0] : null;
    let base = st.colBase;
    let from = Math.max(offset, start);
    let rebased = false;
    if (start < base || count - base > cap) {
      base = start;
      from = start;
      rebased = true;
    }
    const views = new Map;
    const viewOf = (arr) => {
      let v = views.get(arr);
      if (!v)
        views.set(arr, v = view(arr, start, count));
      return v;
    };
    const axes = chart.yAxes;
    for (let i = 0;i < n; i++) {
      const s = chart.series[i], p = series[i];
      s.rawX = viewOf(srcX[i]);
      s.rawY = view(p.y, start, count);
      for (const key of extraKeys)
        s.extra[key] = view(p[key], start, count);
      const ax = axes?.[s.axisIndex];
      if (ax && (ax.scale !== 1 || ax.offset !== 0)) {
        let buf = st.plotBuf[i];
        let lo = from;
        if (!buf || buf.length < count - base || st.plotBase[i] !== base) {
          if (!buf || buf.length < count - base)
            buf = new Float64Array(Math.max(cap, count - base, 1));
          lo = start;
          st.plotBuf[i] = buf;
          st.plotBase[i] = base;
        }
        mapInto(buf, lo - base, p.y, lo, count - lo, ax.scale, ax.offset);
        s.plotY = buf.subarray(start - base, count - base);
      } else {
        s.plotY = s.rawY;
      }
    }
    st.srcX = srcX.slice();
    st.colStart = start;
    st.colBase = base;
    if (bounds) {
      const b = definedSides(bounds);
      chart.runtimeBounds = { ...chart.runtimeBounds ?? {}, ...b };
      chart.bounds = { ...chart.bounds, ...b };
    }
    const [lo, hi] = finiteRange(chart.series[0].rawX, chart.renderer.sortX !== false);
    const o = chart.originX ?? 0;
    const span = Math.max(hi - lo, chart.bounds.maxX - chart.bounds.minX);
    const dist = Math.max(Math.abs(lo - o), Math.abs(hi - o));
    const drifted = lo <= hi && (span > 0 ? dist > REORIGIN_SPANS * span : dist >= 1);
    if (drifted || !sharedSrc && (rebased || count > prevEnd)) {
      this.uploadSeries(chart);
      this.sendViewTransform(chart);
      this.drawChart(chart);
      return;
    }
    if (!this._ready) {
      this.drawChart(chart);
      return;
    }
    const k = count - from;
    let packed = null, xData = null;
    const transferables = [];
    if (k > 0) {
      packed = new Float32Array((1 + extraKeys.length) * n * k);
      for (let i = 0;i < n; i++) {
        const p = series[i];
        const ax = axes?.[chart.series[i].axisIndex];
        const mapped = !!ax && (ax.scale !== 1 || ax.offset !== 0);
        packInto(packed, i * k, p.y, from, k, mapped ? ax.scale : 1, mapped ? ax.offset : 0);
        for (let e = 0;e < extraKeys.length; e++) {
          const key = extraKeys[e];
          const scale = mapped && (Y_PLOT_CHANNELS.has(key) || key === "h") ? ax.scale : 1;
          const off = mapped && Y_PLOT_CHANNELS.has(key) ? ax.offset : 0;
          packInto(packed, ((e + 1) * n + i) * k, p[key], from, k, scale, off);
        }
      }
      transferables.push(packed.buffer);
      if (sharedSrc) {
        xData = toGpu(view(sharedSrc, from, count), 1, -o, xGap(chart));
        transferables.push(xData.buffer);
      }
    }
    this.post({
      type: M.PATCH_SERIES,
      id,
      offset: from - base,
      k,
      count: count - base,
      start: start - base,
      x: xData,
      packed,
      extra: extraKeys,
      bounds: bounds ? this.gpuBounds(chart) : null
    }, transferables);
    this.sendViewTransform(chart);
    this.drawChart(chart);
  }
  setBounds(id, bounds, resetView = false) {
    const chart = this.charts.get(id);
    if (!chart)
      return;
    const b = definedSides(bounds);
    chart.runtimeBounds = { ...chart.runtimeBounds ?? {}, ...b };
    chart.bounds = { ...chart.bounds, ...b };
    this.post({ type: M.SET_BOUNDS, id, bounds: this.gpuBounds(chart) });
    if (resetView) {
      chart.view = { ...chart.homeView };
      this.commitView(chart);
    } else {
      this.sendViewTransform(chart);
      this.drawChart(chart);
    }
  }
  configureChart(id, patch) {
    const c = this.charts.get(id);
    if (!c || !patch)
      return;
    const cfg = c.config;
    const defs = new Map((c.renderer.uniforms ?? []).map((u) => [u.name, u]));
    const changedUniforms = [];
    let refresh = false;
    for (const key of Object.keys(patch)) {
      if (key === "type" || key === "container" || key === "series")
        continue;
      const val = patch[key];
      const reset = val == null;
      const prev = cfg[key];
      if (reset)
        delete cfg[key];
      else
        cfg[key] = val;
      const def = defs.get(key);
      if (def) {
        c.customUniforms[key] = reset ? def.default : normalizeUniform(def, val) ?? def.default;
        changedUniforms.push(key);
      }
      switch (key) {
        case "hiddenSeries": {
          const iterable = !reset && typeof val[Symbol.iterator] === "function";
          this.applyHidden(c, iterable ? new Set(val) : null);
          break;
        }
        case "bgColor": {
          const rgb = isRgb(val) ? val : null;
          if (!rgb)
            delete cfg.bgColor;
          const wrap = c.el.querySelector("div");
          if (wrap)
            wrap.style.background = rgb ? cssRgb(rgb) : "";
          this.post({ type: M.SET_STYLE, id, bgColor: rgb ? [rgb[0], rgb[1], rgb[2]] : null });
          break;
        }
        case "yAxes":
        case "yAxisGap":
          if (!sameValue(prev, cfg[key]))
            refresh = true;
          break;
        case "defaultBounds":
          if (!sameValue(prev, cfg[key])) {
            c.runtimeBounds = null;
            refresh = true;
          }
          break;
      }
    }
    if (changedUniforms.length > 0)
      this.post({ type: M.SET_UNIFORMS, id, values: this.gpuUniforms(c, changedUniforms) });
    if (refresh)
      this.refreshSeriesData(c);
    else if (changedUniforms.length > 0 && c.renderer.computeBounds && c.series.length > 0) {
      this.deriveBounds(c);
      if (c.yAxes)
        this.uploadSeries(c);
      else
        this.post({ type: M.SET_BOUNDS, id, bounds: this.gpuBounds(c) });
    }
    this.requestRender(id);
    this.drawChart(c);
  }
  setSyncViews(sync) {
    this._syncViews = sync === true ? "both" : sync || false;
  }
  setTheme(dark) {
    this._isDark = dark;
    this.worker?.postMessage({ type: M.THEME, isDark: dark });
    for (const chart of this.charts.values())
      this.drawChart(chart);
  }
  onStats(callback) {
    this.statsCallbacks.push(callback);
    return () => {
      const idx = this.statsCallbacks.indexOf(callback);
      if (idx >= 0)
        this.statsCallbacks.splice(idx, 1);
    };
  }
  getStats() {
    return { ...this.currentStats };
  }
  onViewChange(listener) {
    this.viewListeners.add(listener);
    return () => {
      this.viewListeners.delete(listener);
    };
  }
  emitViewChange(id) {
    for (const listener of [...this.viewListeners]) {
      try {
        listener(id);
      } catch (e) {
        console.error("chartai: onViewChange listener failed", e);
      }
    }
  }
  commitView(target) {
    const chart = typeof target === "string" ? this.charts.get(target) : target;
    if (!chart || this.charts.get(chart.id) !== chart)
      return;
    this.sendViewTransform(chart);
    this.drawChart(chart);
    this.syncAllViews(chart);
    this.emitViewChange(chart.id);
  }
  resetView(id) {
    const chart = this.charts.get(id);
    if (!chart)
      return;
    for (const p of chart.plugins)
      p.resetView?.(chart);
    const { panX: spx, panY: spy, zoomX: szx, zoomY: szy } = chart.view;
    const t0 = performance.now();
    const animate = () => {
      if (this.charts.get(id) !== chart)
        return;
      const { panX: tpx, panY: tpy, zoomX: tzx, zoomY: tzy } = chart.homeView;
      const t = Math.min(1, (performance.now() - t0) / 300);
      const e = 1 - Math.pow(1 - t, 3);
      chart.view = {
        panX: spx + (tpx - spx) * e,
        panY: spy + (tpy - spy) * e,
        zoomX: szx + (tzx - szx) * e,
        zoomY: szy + (tzy - szy) * e
      };
      this.commitView(chart);
      if (t < 1)
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
  setHiddenSeries(id, hidden) {
    const chart = this.charts.get(id);
    if (!chart)
      return;
    this.applyHidden(chart, new Set(hidden));
    this.drawChart(chart);
  }
  applyHidden(chart, hidden) {
    const overrides = this.state(chart).hiddenOverrides;
    if (hidden) {
      const next = new Map;
      chart.series.forEach((s, i) => {
        const h = hidden.has(i);
        if (h !== !!s.hidden)
          next.set(s.label, h);
      });
      for (const s of chart.series)
        if (!next.has(s.label))
          overrides.delete(s.label);
      for (const [label, h] of next)
        overrides.set(label, h);
    } else {
      overrides.clear();
    }
    chart.config.hiddenSeries = hidden ?? this.hiddenSet(chart);
    this.post({
      type: M.SET_STYLE,
      id: chart.id,
      hiddenSeries: chart.config.hiddenSeries
    });
  }
  requestRender(id) {
    const chart = this.charts.get(id);
    if (chart)
      this.sendViewTransform(chart);
  }
  sendViewTransform(chart) {
    this.post({
      type: M.VIEW_TRANSFORM,
      id: chart.id,
      panX: chart.view.panX,
      panY: chart.view.panY,
      zoomX: chart.view.zoomX,
      zoomY: chart.view.zoomY
    });
  }
  syncAllViews(source) {
    const mode = this._syncViews;
    const x = mode === "x" || mode === "both";
    const y = mode === "y" || mode === "both";
    if (!x && !y)
      return [];
    const [x0, x1] = visibleRange(source, "x");
    const [y0, y1] = visibleRange(source, "y");
    const moved = [];
    for (const chart of this.charts.values()) {
      if (chart === source)
        continue;
      const view = { ...chart.view };
      const vx = x ? viewFor(chart, "x", x0, x1) : null;
      const vy = y ? viewFor(chart, "y", y0, y1) : null;
      if (vx) {
        view.panX = vx.pan;
        view.zoomX = vx.zoom;
      }
      if (vy) {
        view.panY = vy.pan;
        view.zoomY = vy.zoom;
      }
      const v = chart.view;
      if (view.panX === v.panX && view.panY === v.panY && view.zoomX === v.zoomX && view.zoomY === v.zoomY)
        continue;
      chart.view = view;
      this.sendViewTransform(chart);
      this.drawChart(chart);
      moved.push(chart);
      this.emitViewChange(chart.id);
    }
    return moved;
  }
  resizeChart(chart, width, height) {
    const dpr = currentDpr();
    const changed = width !== chart.width || height !== chart.height || dpr !== chart.dpr;
    chart.width = width;
    chart.height = height;
    chart.dpr = dpr;
    resizeCanvas(chart.backCanvas, width, height, dpr);
    resizeCanvas(chart.frontCanvas, width, height, dpr);
    if (changed && chart.renderer.boundsDependOnSize) {
      this.deriveBounds(chart);
      if (chart.yAxes)
        this.uploadSeries(chart);
      else
        this.post({ type: M.SET_BOUNDS, id: chart.id, bounds: this.gpuBounds(chart) });
    }
    const { bufferSizes, perSeriesPassMeta } = this.computeRendererMeta(chart.renderer, chart);
    this.post({
      type: M.RESIZE,
      id: chart.id,
      width: Math.round(width * dpr),
      height: Math.round(height * dpr),
      bufferSizes,
      perSeriesPassMeta
    });
    this.drawChart(chart);
  }
  watchDpr() {
    if (typeof matchMedia !== "function")
      return;
    let mq;
    try {
      mq = matchMedia(`(resolution: ${currentDpr()}dppx)`);
    } catch {
      return;
    }
    if (!mq)
      return;
    const onChange = () => {
      if (typeof mq.removeEventListener === "function")
        mq.removeEventListener("change", onChange);
      else
        mq.removeListener?.(onChange);
      this.watchDpr();
      for (const chart of this.charts.values())
        this.resizeChart(chart, chart.width, chart.height);
    };
    if (typeof mq.addEventListener === "function")
      mq.addEventListener("change", onChange);
    else
      mq.addListener?.(onChange);
  }
  drawChart(chart) {
    if (!chart.visible)
      return;
    if (this.drawing.has(chart)) {
      this.redraw.add(chart);
      return;
    }
    this.drawing.add(chart);
    try {
      for (let pass = 0;pass < 3; pass++) {
        this.redraw.delete(chart);
        this.drawLayers(chart);
        if (!this.redraw.has(chart))
          break;
      }
    } finally {
      this.drawing.delete(chart);
      this.redraw.delete(chart);
    }
  }
  drawLayers(chart) {
    const dpr = chart.dpr || currentDpr();
    const backCtx = chart.backCanvas.getContext("2d");
    if (backCtx) {
      backCtx.clearRect(0, 0, chart.backCanvas.width, chart.backCanvas.height);
      backCtx.save();
      backCtx.scale(dpr, dpr);
      for (const p of chart.plugins)
        p.beforeDraw?.(backCtx, chart);
      backCtx.restore();
    }
    const ctx = chart.frontCanvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, chart.frontCanvas.width, chart.frontCanvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      for (const p of chart.plugins)
        p.afterDraw?.(ctx, chart);
      ctx.restore();
    }
  }
}
var ChartManager = _ChartManager.getInstance();
// src/plugins/redraw.ts
var pending = new Set;
var frame = 0;
function scheduleDraw(chart) {
  pending.add(chart);
  if (frame)
    return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const charts = [...pending];
    pending.clear();
    for (const c of charts)
      ChartManager.drawChart(c);
  });
}
function commitView(chart) {
  ChartManager.commitView(chart);
}

// src/plugins/labels.ts
var DEFAULT_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
var DEFAULT_LABEL_SIZE = 12;
function computeHomeView(chart) {
  const { width, height } = chart;
  const m = chartMargin(chart);
  const l = chart.config.bgFade === false ? m.left : Math.max(8, m.left - 23), t = 8, r = Math.max(8, m.right - 2), b = 48;
  const innerW = width - l - r;
  const innerH = height - t - b;
  return {
    panX: innerW > 0 ? -l / innerW : 0,
    panY: innerH > 0 ? -b / innerH : 0,
    zoomX: innerW > 0 ? innerW / width : 1,
    zoomY: innerH > 0 ? innerH / height : 1
  };
}
var getViewState = (chart) => {
  const { width: w, height: h } = chart, m = chartMargin(chart);
  const { bounds: b, view: v } = chart, fullX = b.maxX - b.minX, fullY = b.maxY - b.minY;
  const rx = fullX / v.zoomX, ry = fullY / v.zoomY;
  const mx = b.minX + v.panX * fullX, my = b.minY + v.panY * fullY;
  const bgc = chart.config.bgColor ?? (ChartManager.isDark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
  return {
    w,
    h,
    m,
    rx,
    ry,
    mx,
    my,
    bg: `${Math.round(bgc[0] * 255)},${Math.round(bgc[1] * 255)},${Math.round(bgc[2] * 255)}`,
    font: chart.config.fontFamily ?? DEFAULT_FONT,
    text: chart.config.textColor ?? (ChartManager.isDark ? "#c0c0c0" : "#333333"),
    grid: chart.config.gridColor ?? (ChartManager.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")
  };
};
var labelsPlugin = {
  name: "labels",
  install(chart) {
    const hv = computeHomeView(chart);
    chart.homeView = hv;
    chart.view = { ...hv };
    ChartManager.requestRender(chart.id);
  },
  beforeDraw(ctx, chart) {
    const hv = computeHomeView(chart);
    const old = chart.homeView;
    chart.homeView = hv;
    if (hv.zoomX !== old.zoomX || hv.zoomY !== old.zoomY || hv.panX !== old.panX || hv.panY !== old.panY) {
      chart.view = rebaseViewOnHomeChange(chart.view, old, hv);
      queueMicrotask(() => commitView(chart));
    }
    const { w, h, m, rx, ry, mx, my, grid } = getViewState(chart);
    const plotRight = w - (hasRightAxes(chart) ? m.right : 0);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    niceTicks(my, my + ry, 7).forEach((v) => {
      const y = h * (1 - (v - my) / ry);
      if (y > 5 && y < h - m.bottom - 5) {
        ctx.moveTo(m.left, y);
        ctx.lineTo(plotRight, y);
      }
    });
    niceTicks(mx, mx + rx, 8).forEach((v) => {
      const x = w * ((v - mx) / rx);
      if (x > m.left && x < plotRight) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h - m.bottom);
      }
    });
    ctx.stroke();
  },
  afterDraw(ctx, chart) {
    const { w, h, m, rx, ry, mx, my, bg, font, text } = getViewState(chart);
    const formatX = chart.config.formatX ?? String;
    const formatY = chart.config.formatY ?? String;
    const labelSize = chart.config.labelSize ?? DEFAULT_LABEL_SIZE;
    const drawFade = (dir, x, y, fw, fh) => {
      const g = dir === "bottom" ? ctx.createLinearGradient(0, y, 0, y + fh) : ctx.createLinearGradient(x, 0, x + fw, 0);
      const alphas = dir === "left" ? [1, 0.7, 0.2, 0.05, 0] : [0, 0.05, 0.2, 0.7, 1];
      [0, 0.35, 0.55, 0.7, 1].forEach((s, i) => g.addColorStop(s, `rgba(${bg},${alphas[i]})`));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, fw, fh);
    };
    if (chart.config.bgFade === false) {
      ctx.fillStyle = `rgb(${bg})`;
      ctx.fillRect(0, 0, m.left, h);
      if (hasRightAxes(chart))
        ctx.fillRect(w - m.right, 0, m.right, h);
      ctx.fillRect(0, h - m.bottom, w, m.bottom);
    } else {
      drawFade("left", 0, 0, m.left + 20, h);
      if (hasRightAxes(chart))
        drawFade("right", w - m.right - 20, 0, m.right + 20, h);
      drawFade("bottom", 0, h - m.bottom - 20, w, m.bottom + 20);
    }
    ctx.font = `${labelSize}px ${font}`;
    ctx.textBaseline = "middle";
    const strips = yAxisStrips(chart, m, w);
    if (!strips) {
      ctx.fillStyle = text;
      ctx.textAlign = "right";
      niceTicks(my, my + ry, 7).forEach((v) => {
        const y = h * (1 - (v - my) / ry);
        if (y > 5 && y < h - m.bottom - 5)
          ctx.fillText(formatY(v), m.left - 5, y);
      });
    } else {
      for (const strip of strips) {
        const scale = strip.axis?.scale ?? 1;
        const offset = strip.axis?.offset ?? 0;
        const fmt = strip.format ?? formatY;
        const aMin = (my - offset) / scale;
        const aMax = (my + ry - offset) / scale;
        ctx.fillStyle = strip.color ?? text;
        ctx.textAlign = strip.side === "right" ? "left" : "right";
        const tx = strip.side === "right" ? strip.x0 + 5 : strip.x1 - 5;
        niceTicks(aMin, aMax, 7).forEach((v) => {
          const y = h * (1 - (v * scale + offset - my) / ry);
          if (y > 5 && y < h - m.bottom - 5)
            ctx.fillText(fmt(v), tx, y);
        });
      }
    }
    ctx.fillStyle = text;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    niceTicks(mx, mx + rx, 8).forEach((v) => {
      const x = w * ((v - mx) / rx);
      if (x < m.left - 10 || x > w + 30)
        return;
      ctx.save();
      ctx.translate(x, h - m.bottom + 5);
      ctx.rotate(-Math.PI / 14);
      ctx.fillText(formatX(v), 0, 0);
      ctx.restore();
    });
  }
};
// src/plugins/coords.ts
function dataToScreen(dataX, dataY, chart, width, height) {
  const rX = chart.bounds.maxX - chart.bounds.minX;
  const rY = chart.bounds.maxY - chart.bounds.minY;
  const vW = rX / chart.view.zoomX;
  const vH = rY / chart.view.zoomY;
  const vMinX = chart.bounds.minX + chart.view.panX * rX;
  const vMinY = chart.bounds.minY + chart.view.panY * rY;
  return {
    x: (dataX - vMinX) / vW * width,
    y: height * (1 - (dataY - vMinY) / vH)
  };
}
function screenToData(screenX, screenY, chart, width, height) {
  const rX = chart.bounds.maxX - chart.bounds.minX;
  const rY = chart.bounds.maxY - chart.bounds.minY;
  const vW = rX / chart.view.zoomX;
  const vH = rY / chart.view.zoomY;
  const vMinX = chart.bounds.minX + chart.view.panX * rX;
  const vMinY = chart.bounds.minY + chart.view.panY * rY;
  return {
    x: vMinX + screenX / width * vW,
    y: vMinY + (1 - screenY / height) * vH
  };
}

// src/plugins/hover.ts
var MAX_HOVER_PX = 50;
function findNearestPoint(chart, screenX, screenY, width, height) {
  if (chart.series.length === 0)
    return null;
  const { x: dataX, y: dataY } = screenToData(screenX, screenY, chart, width, height);
  const rX = chart.bounds.maxX - chart.bounds.minX;
  const vW = rX / chart.view.zoomX;
  const vMinX = chart.bounds.minX + chart.view.panX * rX;
  const shared = findNearestLine(chart, dataX, dataY, height);
  if (shared !== undefined)
    return shared;
  let bsi = -1, bi = -1, bdx = Infinity, bdy = Infinity;
  for (let s = 0;s < chart.series.length; s++) {
    if (chart.config?.hiddenSeries?.has(s))
      continue;
    const sr = chart.series[s];
    const n = sr.rawX.length;
    if (n === 0)
      continue;
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (sr.rawX[mid] < dataX)
        lo = mid + 1;
      else
        hi = mid;
    }
    let idx = lo;
    if (lo > 0 && Math.abs(sr.rawX[lo - 1] - dataX) < Math.abs(sr.rawX[lo] - dataX))
      idx = lo - 1;
    const dx = Math.abs(sr.rawX[idx] - dataX);
    const dy = Math.abs((sr.plotY ?? sr.rawY)[idx] - dataY);
    if (dx < bdx || dx === bdx && dy < bdy) {
      bdx = dx;
      bdy = dy;
      bsi = s;
      bi = idx;
    }
  }
  if (bsi === -1)
    return null;
  const sr = chart.series[bsi];
  if (Math.abs((sr.rawX[bi] - vMinX) / vW * width - screenX) > MAX_HOVER_PX)
    return null;
  return {
    x: sr.rawX[bi],
    y: (sr.plotY ?? sr.rawY)[bi],
    value: sr.rawY[bi],
    index: bi,
    screenX,
    screenY,
    seriesIndex: bsi,
    seriesLabel: sr.label
  };
}
function findNearestLine(chart, dataX, dataY, height) {
  const first = chart.series[0];
  const xs = first.rawX;
  const n = xs.length;
  for (const s of chart.series)
    if (s.rawX !== xs)
      return;
  if (n === 0)
    return null;
  const rY = chart.bounds.maxY - chart.bounds.minY;
  const pxPerY = height / (rY / chart.view.zoomY);
  const rX = chart.bounds.maxX - chart.bounds.minX;
  const pxPerX = chart.width / (rX / chart.view.zoomX);
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const mid = lo + hi >> 1;
    if (xs[mid] < dataX)
      lo = mid + 1;
    else
      hi = mid;
  }
  const c1 = lo, c0 = Math.max(0, lo - 1);
  const t = c1 > c0 ? Math.min(1, Math.max(0, (dataX - xs[c0]) / (xs[c1] - xs[c0]))) : 0;
  const near = t < 0.5 ? c0 : c1;
  if (Math.abs(xs[c0] - dataX) * pxPerX > MAX_HOVER_PX && Math.abs(xs[c1] - dataX) * pxPerX > MAX_HOVER_PX && (dataX < xs[c0] || dataX > xs[c1]))
    return null;
  const isGap = (v) => v == null || v !== v;
  let bsi = -1, bd = MAX_HOVER_PX;
  for (let s = 0;s < chart.series.length; s++) {
    if (chart.config?.hiddenSeries?.has(s))
      continue;
    const ys = chart.series[s].plotY ?? chart.series[s].rawY;
    const y0 = ys[c0], y1 = ys[c1];
    let y;
    if (!isGap(y0) && !isGap(y1))
      y = y0 + (y1 - y0) * t;
    else if (!isGap(y0))
      y = y0;
    else if (!isGap(y1))
      y = y1;
    else
      continue;
    const d = Math.abs(y - dataY) * pxPerY;
    if (d < bd) {
      bd = d;
      bsi = s;
    }
  }
  if (bsi === -1)
    return null;
  const sr = chart.series[bsi];
  const ys = sr.plotY ?? sr.rawY;
  const idx = !isGap(ys[near]) ? near : near === c0 ? c1 : c0;
  return {
    x: xs[idx],
    y: ys[idx],
    value: sr.rawY[idx],
    index: idx,
    seriesIndex: bsi,
    seriesLabel: sr.label
  };
}
var onColor = (rgb, k) => {
  const [r, g, b] = rgb.split(",").map(Number);
  const t = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.4 ? 0 : 255;
  return `rgb(${Math.round(r + (t - r) * k)},${Math.round(g + (t - g) * k)},${Math.round(b + (t - b) * k)})`;
};
var PILL_SETTLE_PX = 0.5;
var PILL_MAX_STEP_MS = 50;
var states = new WeakMap;
var hoverPlugin = {
  name: "hover",
  install(chart, el) {
    const mgr = ChartManager;
    const ac = new AbortController;
    const s = {
      hoverResult: null,
      highlight: -1,
      pillX: 0,
      pillY: 0,
      pillTargetX: 0,
      pillTargetY: 0,
      pillTime: 0,
      abort: ac
    };
    states.set(chart, s);
    const update = (res) => {
      if (chart.config.onHover)
        chart.config.onHover(res);
      const hl = res && chart.config.highlightHover !== false ? res.seriesIndex : -1;
      if (hl !== s.highlight) {
        s.highlight = hl;
        mgr["worker"]?.postMessage({ type: M.SET_STYLE, id: el.dataset.chartId, highlightSeries: hl });
      }
      const shown = s.hoverResult !== null;
      s.hoverResult = chart.config.showTooltip ? res : null;
      if (!s.hoverResult)
        s.pillTime = 0;
      if (shown || s.hoverResult)
        scheduleDraw(chart);
    };
    const handleHover = (clientX, clientY) => {
      if (chart.dragging)
        return;
      const r = el.getBoundingClientRect();
      const res = findNearestPoint(chart, clientX - r.left, clientY - r.top, r.width, r.height);
      if (res) {
        res.screenX = clientX - r.left;
        res.screenY = clientY - r.top;
      }
      update(res);
    };
    el.addEventListener("mousemove", (e) => handleHover(e.clientX, e.clientY), {
      signal: ac.signal
    });
    el.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1) {
        handleHover(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { signal: ac.signal, passive: true });
    ["mouseleave", "pointerdown", "touchend", "touchcancel"].forEach((ev) => el.addEventListener(ev, () => update(null), { signal: ac.signal }));
  },
  afterDraw(ctx, chart) {
    const s = states.get(chart);
    if (!s?.hoverResult || !chart.config.showTooltip)
      return;
    const { hoverResult: hvr } = s;
    const w = chart.width;
    const h = chart.height;
    const margin = chartMargin(chart);
    const dark = ChartManager.isDark;
    const formatX = chart.config.formatX ?? String;
    const fontFamily = chart.config.fontFamily ?? DEFAULT_FONT;
    const { x: px, y: py } = dataToScreen(hvr.x, hvr.y, chart, w, h);
    const mainSeries = chart.series[hvr.seriesIndex] || chart.series[0];
    const rgb = `${Math.round(mainSeries.color.r * 255)},${Math.round(mainSeries.color.g * 255)},${Math.round(mainSeries.color.b * 255)}`;
    const col = `rgb(${rgb})`;
    const textCol = dark ? `oklch(from ${col} calc(l + 0.1) c h)` : col;
    const hasY = Number.isFinite(py);
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = `rgba(${rgb},0.4)`;
    ctx.stroke(new Path2D(hasY ? `M${px} 0V${h - margin.bottom}M${margin.left} ${py}H${w}` : `M${px} 0V${h - margin.bottom}`));
    ctx.restore();
    if (hasY) {
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.9)";
      ctx.stroke();
    }
    const xTol = (chart.bounds.maxX - chart.bounds.minX) / chart.view.zoomX * 0.0000001;
    const seriesData = chart.series.map((ser, si) => {
      if (chart.config?.hiddenSeries?.has(si))
        return null;
      let l = 0, r = ser.rawX.length - 1;
      while (l <= r) {
        const m = l + r >> 1;
        if (Math.abs(ser.rawX[m] - hvr.x) <= xTol) {
          const v = ser.rawY[m];
          if (v == null || v !== v)
            return null;
          const rgb = `${Math.round(ser.color.r * 255)},${Math.round(ser.color.g * 255)},${Math.round(ser.color.b * 255)}`;
          return {
            si,
            label: ser.label,
            val: seriesAxisFormat(chart, si)(v),
            rawVal: v,
            rgb,
            col: `rgb(${rgb})`
          };
        }
        ser.rawX[m] < hvr.x ? l = m + 1 : r = m - 1;
      }
      return null;
    }).filter((x) => x !== null);
    seriesData.sort((a, b) => Math.abs(b.rawVal) - Math.abs(a.rawVal));
    const hovered = seriesData.findIndex((d) => d.si === hvr.seriesIndex);
    if (hovered > 0)
      seriesData.unshift(...seriesData.splice(hovered, 1));
    const totalSeries = seriesData.length;
    const displayData = seriesData.slice(0, 5);
    const remainingCount = totalSeries - displayData.length;
    s.pillTargetX = px;
    s.pillTargetY = py;
    const now = performance.now();
    const decay = chart.config.pillDecayMs ?? 60;
    const f = s.pillTime && decay > 0 ? 1 - Math.pow(0.5, Math.min(now - s.pillTime, PILL_MAX_STEP_MS) / decay) : 1;
    s.pillTime = now;
    s.pillX = Number.isFinite(s.pillX) ? s.pillX + (px - s.pillX) * f : px;
    if (hasY)
      s.pillY = Number.isFinite(s.pillY) ? s.pillY + (py - s.pillY) * f : py;
    if (Math.abs(px - s.pillX) < PILL_SETTLE_PX && (!hasY || Math.abs(py - s.pillY) < PILL_SETTLE_PX)) {
      s.pillX = px;
      if (hasY)
        s.pillY = py;
    } else {
      scheduleDraw(chart);
    }
    const drawPill = (x, y, txt, isX, anchorLeft) => {
      ctx.font = `600 10px ${fontFamily}`;
      const tw = ctx.measureText(txt).width, pw = tw + 12, ph = 18;
      const ox = isX ? x - pw / 2 : x - pw, oy = isX ? y : y - ph / 2;
      ctx.save();
      const angle = isX ? Math.atan((s.pillTargetX - s.pillX) / 80) * 0.2 : Math.atan((s.pillTargetY - s.pillY) / 80) * 0.2;
      ctx.translate(x, y);
      ctx.rotate(angle);
      const bx = isX ? -pw / 2 : anchorLeft ? 0 : -pw, by = isX ? 0 : -ph / 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, pw, ph, 4);
      ctx.fillStyle = dark ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.75)";
      ctx.fill();
      ctx.fillStyle = `rgba(${rgb},0.2)`;
      ctx.fill();
      ctx.strokeStyle = textCol;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = textCol;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, bx + pw / 2, by + ph / 2);
      ctx.restore();
    };
    drawPill(Math.max(margin.left, Math.min(w - margin.right, s.pillX)), h - margin.bottom + 4, formatX(hvr.x), true);
    if (hasY) {
      const hoveredAxis = chart.yAxes?.[chart.series[hvr.seriesIndex]?.axisIndex ?? 0];
      const pillLabel = seriesAxisFormat(chart, hvr.seriesIndex)(hvr.value ?? hvr.y);
      const pillY = Math.max(9, Math.min(h - margin.bottom - 9, s.pillY));
      if (hoveredAxis?.side === "right")
        drawPill(w - margin.right, pillY, pillLabel, false, true);
      else
        drawPill(margin.left, pillY, pillLabel, false);
    }
    const rowFont = `600 10px ${fontFamily}`, nameFont = `600 11px ${fontFamily}`, valueFont = `600 18px ${fontFamily}`;
    const rowH = 18, pad = 10;
    const leadIsHovered = displayData.length > 0 && displayData[0].si === hvr.seriesIndex;
    const lead = leadIsHovered ? displayData[0] : null;
    const rows = leadIsHovered ? displayData.slice(1) : displayData;
    const timeTxt = formatX(hvr.x);
    const widths = [];
    ctx.font = rowFont;
    const timeW = ctx.measureText(timeTxt).width;
    for (const d of rows)
      widths.push(24 + ctx.measureText(d.label).width + 12 + ctx.measureText(d.val).width);
    if (remainingCount > 0)
      widths.push(ctx.measureText(`+${remainingCount} more`).width);
    if (lead) {
      ctx.font = nameFont;
      widths.push(ctx.measureText(lead.label).width + 10 + timeW);
      ctx.font = valueFont;
      widths.push(ctx.measureText(lead.val).width);
    } else {
      widths.push(timeW);
    }
    const headerH = lead ? 46 : 26;
    const boxW = Math.max(0, ...widths) + 2 * pad;
    const boxH = headerH + (lead ? 4 : 0) + rows.length * rowH + (remainingCount > 0 ? rowH : 0) + 4;
    let bx = hvr.screenX + 14, by = hvr.screenY - boxH - 6;
    if (bx + boxW > w)
      bx = hvr.screenX - boxW - 14;
    by = Math.max(4, Math.min(h - boxH - 4, hvr.screenY - boxH - 6));
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 6);
    ctx.clip();
    ctx.fillStyle = dark ? "rgba(28,28,30,0.95)" : "rgba(255,255,255,0.96)";
    ctx.fillRect(bx, by, boxW, boxH);
    if (lead) {
      ctx.fillStyle = lead.col;
      ctx.fillRect(bx, by, boxW, headerH);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 6);
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textBaseline = "middle";
    if (lead) {
      ctx.textAlign = "left";
      ctx.font = nameFont;
      ctx.fillStyle = onColor(lead.rgb, 0.78);
      ctx.fillText(lead.label, bx + pad, by + 14);
      ctx.textAlign = "right";
      ctx.font = rowFont;
      ctx.fillStyle = onColor(lead.rgb, 0.6);
      ctx.fillText(timeTxt, bx + boxW - pad, by + 14);
      ctx.textAlign = "left";
      ctx.font = valueFont;
      ctx.fillStyle = onColor(lead.rgb, 0.78);
      ctx.fillText(lead.val, bx + pad, by + 33);
    } else {
      ctx.textAlign = "left";
      ctx.font = rowFont;
      ctx.fillStyle = dark ? "#888" : "#999";
      ctx.fillText(timeTxt, bx + pad, by + 15);
    }
    let rowTop = by + headerH + (lead ? 4 : 0);
    ctx.font = rowFont;
    rows.forEach((sd) => {
      const ty = rowTop + rowH / 2;
      ctx.fillStyle = sd.col;
      ctx.beginPath();
      ctx.roundRect(bx + pad, ty - 4, 8, 8, 2);
      ctx.fill();
      ctx.textAlign = "left";
      ctx.fillStyle = dark ? "#eee" : "#1a1a1a";
      ctx.fillText(sd.label, bx + pad + 14, ty);
      ctx.textAlign = "right";
      ctx.fillText(sd.val, bx + boxW - pad, ty);
      rowTop += rowH;
    });
    if (remainingCount > 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = dark ? "#666" : "#aaa";
      ctx.fillText(`+${remainingCount} more`, bx + pad, rowTop + rowH / 2);
    }
  },
  uninstall(chart) {
    const s = states.get(chart);
    s?.abort.abort();
    states.delete(chart);
  }
};
// src/plugins/labels-panel.ts
var getViewState2 = (chart) => {
  const { width: w, height: h } = chart, m = chartMargin(chart);
  const { bounds: b, view: v } = chart, fullX = b.maxX - b.minX, fullY = b.maxY - b.minY;
  const rx = fullX / v.zoomX, ry = fullY / v.zoomY;
  const mx = b.minX + v.panX * fullX, my = b.minY + v.panY * fullY;
  const bgc = chart.config.bgColor ?? (ChartManager.isDark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
  return {
    w,
    h,
    m,
    rx,
    ry,
    mx,
    my,
    bg: `rgb(${Math.round(bgc[0] * 255)},${Math.round(bgc[1] * 255)},${Math.round(bgc[2] * 255)})`,
    bgAlpha: `rgba(${Math.round(bgc[0] * 255)},${Math.round(bgc[1] * 255)},${Math.round(bgc[2] * 255)},0.95)`,
    border: ChartManager.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
    font: chart.config.fontFamily ?? DEFAULT_FONT,
    text: chart.config.textColor ?? (ChartManager.isDark ? "#c0c0c0" : "#333333"),
    grid: chart.config.gridColor ?? (ChartManager.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")
  };
};
var labelsPanelPlugin = {
  name: "labels-panel",
  beforeDraw(ctx, chart) {
    const { w, h, m, rx, ry, mx, my, grid } = getViewState2(chart);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    niceTicks(my, my + ry, 7).forEach((v) => {
      const y = h * (1 - (v - my) / ry);
      if (y > 5 && y < h - m.bottom - 5) {
        ctx.moveTo(m.left, y);
        ctx.lineTo(w, y);
      }
    });
    niceTicks(mx, mx + rx, 8).forEach((v) => {
      const x = w * ((v - mx) / rx);
      if (x > m.left && x < w) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h - m.bottom);
      }
    });
    ctx.stroke();
  },
  afterDraw(ctx, chart) {
    const { w, h, m, rx, ry, mx, my, bgAlpha, border, font, text } = getViewState2(chart);
    const formatX = chart.config.formatX ?? String;
    const formatY = chart.config.formatY ?? String;
    const labelSize = chart.config.labelSize ?? DEFAULT_LABEL_SIZE;
    ctx.fillStyle = bgAlpha;
    ctx.fillRect(0, 0, m.left, h - m.bottom);
    ctx.fillRect(0, h - m.bottom, w, m.bottom);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(m.left, 0);
    ctx.moveTo(m.left, 0);
    ctx.lineTo(m.left, h - m.bottom);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, h);
    ctx.moveTo(0, h);
    ctx.lineTo(w, h);
    ctx.moveTo(m.left, h - m.bottom);
    ctx.lineTo(w, h - m.bottom);
    ctx.moveTo(w, h - m.bottom);
    ctx.lineTo(w, h);
    ctx.stroke();
    ctx.font = `${labelSize}px ${font}`;
    ctx.fillStyle = text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    niceTicks(my, my + ry, 7).forEach((v) => {
      const y = h * (1 - (v - my) / ry);
      if (y > 5 && y < h - m.bottom - 5)
        ctx.fillText(formatY(v), m.left / 2, y);
    });
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    niceTicks(mx, mx + rx, 8).forEach((v) => {
      const x = w * ((v - mx) / rx);
      if (x < m.left - 10 || x > w + 30)
        return;
      ctx.save();
      ctx.translate(x, h - m.bottom * 0.7);
      ctx.rotate(-Math.PI / 14);
      ctx.fillText(formatX(v), 0, 0);
      ctx.restore();
    });
  }
};
// src/plugins/legend.ts
var ICON_SIZE = 28;
var PANEL_MAX_WIDTH = 220;
var PANEL_MIN_WIDTH = 100;
var DEFAULT_MAX_LABEL_CHARS = 24;
var states2 = new WeakMap;
function getLegendConfig(chart) {
  return chart.config.legend ?? {};
}
function getLegendStyles(chart) {
  const dark = ChartManager.isDark;
  const bgc = chart.config.bgColor ?? (dark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
  const rgb = `${Math.round(bgc[0] * 255)},${Math.round(bgc[1] * 255)},${Math.round(bgc[2] * 255)}`;
  const border = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)";
  const panelBg = dark ? `rgba(${rgb},0.95)` : "rgba(255,255,255,0.98)";
  const closeBg = dark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.98)";
  return {
    panelBg,
    panelBorder: border,
    closeBg,
    closeBgSolid: dark ? "rgba(0.2,0.2,0.22,0.98)" : "rgba(255,255,255,0.98)",
    text: getLegendConfig(chart).textColor ?? chart.config.textColor ?? (dark ? "#c0c0c0" : "#333333"),
    textMuted: dark ? "#888" : "#999",
    font: getLegendConfig(chart).fontFamily ?? chart.config.fontFamily ?? DEFAULT_FONT,
    labelSize: getLegendConfig(chart).labelSize ?? chart.config.labelSize ?? DEFAULT_LABEL_SIZE
  };
}
var CLOSE_BTN_SIZE = Math.round(ICON_SIZE * 0.8);
var PANEL_MAX_HEIGHT = 180;
var LEGEND_HTML = `
<div class="chart-legend-overlay" style="position:absolute;inset:0;pointer-events:none;z-index:20">
  <div class="chart-legend-container" style="position:absolute;top:4px;right:4px;width:${ICON_SIZE}px;height:${ICON_SIZE}px;overflow:hidden;border-radius:50%;pointer-events:auto;transition:width .2s ease,height .2s ease,border-radius .2s ease">
    <button type="button" class="chart-legend-icon" title="Legend" style="position:absolute;inset:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;border:none;border-radius:inherit;cursor:pointer;flex-shrink:0;transition:transform .18s ease,opacity .2s ease"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg></button>
    <div class="chart-legend-panel" style="position:absolute;inset:0;display:none;flex-direction:column;overflow:hidden;border-radius:inherit">
      <div class="chart-legend-scroll" style="flex:1;min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:10px 12px">
        <div class="chart-legend-list" style="display:flex;flex-direction:column;gap:4px"></div>
      </div>
    </div>
  </div>
  <button type="button" class="chart-legend-close" title="Close" style="position:absolute;top:-${CLOSE_BTN_SIZE / 2}px;right:-${CLOSE_BTN_SIZE / 2}px;width:${CLOSE_BTN_SIZE}px;height:${CLOSE_BTN_SIZE}px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:none;cursor:pointer;padding:0;pointer-events:none;opacity:0;visibility:hidden;transition:transform .12s ease,opacity .18s ease .1s;z-index:21;transform:translate(-50%,50%);"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button>
</div>`;
var legendPlugin = {
  name: "legend",
  install(chart, el) {
    const ac = new AbortController;
    const wrap = document.createElement("div");
    wrap.innerHTML = LEGEND_HTML.trim();
    const overlay = wrap.firstElementChild;
    const container = overlay.querySelector(".chart-legend-container");
    const iconBtn = container.querySelector(".chart-legend-icon");
    const panel = container.querySelector(".chart-legend-panel");
    const scrollArea = container.querySelector(".chart-legend-scroll");
    const list = scrollArea.querySelector(".chart-legend-list");
    const closeBtn = overlay.querySelector(".chart-legend-close");
    el.appendChild(overlay);
    iconBtn.addEventListener("mouseenter", () => {
      iconBtn.style.transform = "scale(1.08)";
    });
    iconBtn.addEventListener("mouseleave", () => {
      iconBtn.style.transform = "scale(1)";
    });
    const closeBase = "translate(-50%, 50%)";
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.transform = `${closeBase} scale(1.1)`;
    });
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.transform = closeBase;
    });
    scrollArea.addEventListener("wheel", (e) => e.stopPropagation(), {
      passive: false,
      signal: ac.signal
    });
    overlay.addEventListener("click", (e) => e.stopPropagation(), { signal: ac.signal });
    list.addEventListener("pointerdown", (e) => {
      const row = e.target.closest(".chart-legend-row");
      if (!row)
        return;
      e.stopPropagation();
      e.preventDefault();
      const idx = Number(row.dataset.series);
      if (isNaN(idx))
        return;
      const current = new Set(chart.config.hiddenSeries ?? []);
      if (current.has(idx))
        current.delete(idx);
      else
        current.add(idx);
      const isNowHidden = current.has(idx);
      const ser = chart.series[idx];
      if (ser) {
        const col = `rgb(${ser.color.r * 100}% ${ser.color.g * 100}% ${ser.color.b * 100}%)`;
        const swatch = row.querySelector(".chart-legend-swatch");
        const labelEl = row.querySelector(".chart-legend-label");
        swatch.style.background = isNowHidden ? "transparent" : col;
        swatch.style.border = isNowHidden ? `1.5px solid ${col}` : "";
        labelEl.style.opacity = isNowHidden ? "0.4" : "";
        swatch.classList.remove("chart-legend-swatch--bounce");
        labelEl.classList.remove("chart-legend-label--bounce");
        swatch.offsetWidth;
        swatch.classList.add("chart-legend-swatch--bounce");
        labelEl.classList.add("chart-legend-label--bounce");
      }
      ChartManager.setHiddenSeries(chart.id, [...current]);
    }, { capture: true, signal: ac.signal });
    const cfg = getLegendConfig(chart);
    const alwaysOpen = cfg.alwaysOpen ?? false;
    const defaultOpen = cfg.defaultOpen ?? false;
    const s = {
      overlay,
      container,
      iconBtn,
      panel,
      closeBtn,
      scrollArea,
      list,
      open: alwaysOpen || defaultOpen,
      abort: ac,
      lastSeries: null,
      lastHidden: "",
      rowsDirty: true,
      computedWidth: PANEL_MAX_WIDTH,
      stylesKey: ""
    };
    states2.set(chart, s);
    if (!alwaysOpen) {
      const toggle = () => {
        s.open = !s.open;
        applyOpenState(chart);
      };
      iconBtn.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle();
      }, { capture: true, signal: ac.signal });
      closeBtn.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        s.open = false;
        applyOpenState(chart);
      }, { capture: true, signal: ac.signal });
    }
    applyStyles(chart);
    syncSeries(chart);
    applyOpenState(chart);
  },
  afterDraw(_, chart) {
    applyStyles(chart);
    syncSeries(chart);
  },
  uninstall(chart) {
    const s = states2.get(chart);
    if (s) {
      s.abort.abort();
      s.overlay.remove();
      states2.delete(chart);
    }
  }
};
function applyStyles(chart) {
  const s = states2.get(chart);
  if (!s)
    return;
  const styles = getLegendStyles(chart);
  const key = Object.values(styles).join("|");
  if (key === s.stylesKey)
    return;
  s.stylesKey = key;
  const border = `1px solid ${styles.panelBorder}`;
  s.container.style.background = styles.panelBg;
  s.container.style.border = border;
  s.container.style.fontFamily = styles.font;
  s.container.style.fontSize = `${styles.labelSize}px`;
  s.container.style.color = styles.text;
  s.iconBtn.style.background = styles.closeBg;
  s.iconBtn.style.border = "none";
  s.iconBtn.style.boxShadow = "none";
  s.iconBtn.style.color = styles.text;
  s.panel.style.background = styles.panelBg;
  s.panel.style.fontFamily = styles.font;
  s.panel.style.fontSize = `${styles.labelSize}px`;
  s.panel.style.color = styles.text;
  s.closeBtn.style.background = styles.closeBgSolid;
  s.closeBtn.style.border = border;
  s.closeBtn.style.boxShadow = "none";
  s.closeBtn.style.color = styles.text;
}
function sameLabels(a, b) {
  if (a === b)
    return true;
  if (!a || !b || a.length !== b.length)
    return false;
  for (let i = 0;i < a.length; i++)
    if (a[i].label !== b[i].label)
      return false;
  return true;
}
function hiddenSignature(chart) {
  const hidden = chart.config.hiddenSeries;
  if (!hidden || hidden.size === 0)
    return "";
  return [...hidden].sort((x, y) => x - y).join(",");
}
var measureCtx = null;
function measureTextWidth(text, font, fontSize) {
  if (!measureCtx)
    measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx)
    return 0;
  measureCtx.font = `${fontSize}px ${font}`;
  return measureCtx.measureText(text).width;
}
function computePanelWidth(chart, labels) {
  const styles = getLegendStyles(chart);
  const font = styles.font;
  const fontSize = styles.labelSize;
  const maxChars = getLegendConfig(chart).maxLabelChars ?? DEFAULT_MAX_LABEL_CHARS;
  let maxW = 0;
  for (const label of labels) {
    const truncated = label.length > maxChars ? label.slice(0, maxChars - 1) + "…" : label;
    const w = measureTextWidth(truncated, font, fontSize);
    if (w > maxW)
      maxW = w;
  }
  const swatchGap = 18;
  const padding = 44;
  const target = Math.ceil(maxW) + swatchGap + padding;
  return Math.min(Math.max(target, PANEL_MIN_WIDTH), PANEL_MAX_WIDTH);
}
function syncSeries(chart) {
  const s = states2.get(chart);
  if (!s)
    return;
  if (!sameLabels(chart.series, s.lastSeries)) {
    s.lastSeries = chart.series;
    s.rowsDirty = true;
  }
  const open = (getLegendConfig(chart).alwaysOpen ?? false) || s.open;
  if (s.rowsDirty) {
    if (open)
      rebuildRows(chart, s);
    return;
  }
  const hidden = hiddenSignature(chart);
  if (hidden !== s.lastHidden) {
    s.lastHidden = hidden;
    applyHiddenState(chart, s);
  }
}
function rebuildRows(chart, s) {
  const series = chart.series;
  const maxChars = getLegendConfig(chart).maxLabelChars ?? DEFAULT_MAX_LABEL_CHARS;
  const labels = series.map((ser, i) => ser.label || `Series ${i + 1}`);
  s.computedWidth = computePanelWidth(chart, labels);
  const hidden = chart.config.hiddenSeries ?? new Set;
  const rowBase = "display:flex;align-items:center;gap:8px;min-width:0;padding-right:8px;cursor:pointer;user-select:none";
  const rowAnim = ";opacity:0;transform:translateY(6px);animation:chart-legend-row-in .25s cubic-bezier(.34,1.2,.64,1) forwards";
  const swatchBase = "width:10px;height:10px;border-radius:2px;flex-shrink:0;box-sizing:border-box";
  const labelBase = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:opacity .15s ease";
  s.list.innerHTML = series.map((ser, i) => {
    const col = `rgb(${ser.color.r * 100}% ${ser.color.g * 100}% ${ser.color.b * 100}%)`;
    let label = ser.label || `Series ${i + 1}`;
    if (label.length > maxChars)
      label = label.slice(0, maxChars - 1) + "…";
    const animDelay = Math.min(0.02 + i * 0.02, 0.02 + 7 * 0.02);
    const isHidden = hidden.has(i);
    const swatchStyle = isHidden ? `${swatchBase};background:transparent;border:1.5px solid ${col}` : `${swatchBase};background:${col}`;
    const labelOpacity = isHidden ? "opacity:0.4;" : "";
    return `<div class="chart-legend-row" data-series="${i}" style="${rowBase}${rowAnim};animation-delay:${animDelay}s"><span class="chart-legend-swatch" style="${swatchStyle}"></span><span class="chart-legend-label" style="${labelOpacity}${labelBase}">${escapeHtml(label)}</span></div>`;
  }).join("");
  s.rowsDirty = false;
  s.lastHidden = hiddenSignature(chart);
  if (s.open) {
    const packedH = s.list.scrollHeight + 20;
    s.container.style.width = `${s.computedWidth}px`;
    s.container.style.height = `${Math.min(PANEL_MAX_HEIGHT, packedH)}px`;
  }
}
function applyHiddenState(chart, s) {
  const hidden = chart.config.hiddenSeries ?? new Set;
  s.list.querySelectorAll(".chart-legend-row").forEach((row) => {
    const i = Number(row.dataset.series);
    if (isNaN(i))
      return;
    const ser = chart.series[i];
    if (!ser)
      return;
    const col = `rgb(${ser.color.r * 100}% ${ser.color.g * 100}% ${ser.color.b * 100}%)`;
    const isHidden = hidden.has(i);
    const swatch = row.querySelector(".chart-legend-swatch");
    const labelEl = row.querySelector(".chart-legend-label");
    swatch.style.background = isHidden ? "transparent" : col;
    swatch.style.border = isHidden ? `1.5px solid ${col}` : "";
    labelEl.style.opacity = isHidden ? "0.4" : "";
  });
}
function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
function applyOpenState(chart) {
  const s = states2.get(chart);
  if (!s)
    return;
  const alwaysOpen = getLegendConfig(chart).alwaysOpen ?? false;
  const open = alwaysOpen || s.open;
  if (open && s.rowsDirty)
    rebuildRows(chart, s);
  s.container.style.width = open ? `${s.computedWidth}px` : `${ICON_SIZE}px`;
  s.container.style.height = `${ICON_SIZE}px`;
  s.container.style.borderRadius = open ? "8px" : "50%";
  s.container.style.overflow = "hidden";
  s.iconBtn.style.opacity = alwaysOpen ? "0" : open ? "0" : "1";
  s.iconBtn.style.pointerEvents = alwaysOpen ? "none" : open ? "none" : "auto";
  s.iconBtn.style.visibility = alwaysOpen ? "hidden" : "visible";
  s.panel.style.display = open ? "flex" : "none";
  s.closeBtn.style.opacity = alwaysOpen ? "0" : open ? "0" : "0";
  s.closeBtn.style.pointerEvents = alwaysOpen ? "none" : open ? "auto" : "none";
  s.closeBtn.style.visibility = alwaysOpen ? "hidden" : open ? "visible" : "hidden";
  s.scrollArea.style.overflowY = "hidden";
  if (open) {
    const packedH = s.list.scrollHeight + 20;
    s.container.style.height = `${Math.min(PANEL_MAX_HEIGHT, packedH)}px`;
    const onHeightDone = (e) => {
      if (e.propertyName !== "height")
        return;
      s.container.removeEventListener("transitionend", onHeightDone);
      s.scrollArea.style.overflowY = "auto";
    };
    s.container.addEventListener("transitionend", onHeightDone);
    if (!alwaysOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          s.closeBtn.style.opacity = "1";
        });
      });
    }
  }
}
function injectLegendKeyframes() {
  if (document.getElementById("chart-legend-keyframes"))
    return;
  const style = document.createElement("style");
  style.id = "chart-legend-keyframes";
  style.textContent = `
    @keyframes chart-legend-row-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes chart-legend-swatch-bounce {
      0%   { transform: scale(1); }
      30%  { transform: scale(1.5); }
      60%  { transform: scale(0.82); }
      80%  { transform: scale(1.12); }
      100% { transform: scale(1); }
    }
    .chart-legend-swatch--bounce { animation: chart-legend-swatch-bounce 0.28s ease-out; }
    @keyframes chart-legend-label-bounce {
      0%   { transform: scale(1); }
      30%  { transform: scale(1.05); }
      60%  { transform: scale(0.97); }
      80%  { transform: scale(1.02); }
      100% { transform: scale(1); }
    }
    .chart-legend-label--bounce { animation: chart-legend-label-bounce 0.28s ease-out; }
    .chart-legend-scroll::-webkit-scrollbar { width: 6px; }
    .chart-legend-scroll::-webkit-scrollbar-track { background: transparent; }
    .chart-legend-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 3px; }
    .chart-legend-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }
  `;
  document.head.appendChild(style);
}
injectLegendKeyframes();
// src/plugins/zoom.ts
var MIN_ZOOM = 0.1;
var MAX_ZOOM = 1e7;
function limitZoom(next, current, lo, hi, anchor) {
  const cap = Math.min(MAX_ZOOM, floatZoomLimit(lo, hi, anchor));
  if (next > cap)
    next = Math.max(cap, Math.min(current, next));
  return Math.max(MIN_ZOOM, next);
}
function touchActionFor(mode, original) {
  if (mode === "none")
    return original;
  if (mode === "x-only")
    return "pan-y";
  if (mode === "y-only")
    return "pan-x";
  return "none";
}
function zoomPlugin(opts = {}) {
  const state = new WeakMap;
  return {
    name: "zoom",
    install(chart, el) {
      const originalTouchAction = el.style.touchAction;
      const originalUserSelect = el.style.userSelect;
      const originalWebkitUserSelect = el.style.webkitUserSelect;
      const touchAction = touchActionFor(chart.config.zoomMode ?? "both", originalTouchAction);
      el.style.touchAction = touchAction;
      el.style.userSelect = "none";
      el.style.webkitUserSelect = "none";
      const mgr = ChartManager;
      const ac = new AbortController;
      const s = {
        lastX: 0,
        lastY: 0,
        velX: 0,
        velY: 0,
        abort: ac,
        originalTouchAction,
        originalUserSelect,
        originalWebkitUserSelect,
        el,
        touchAction
      };
      const mode = () => chart.config.zoomMode ?? "both";
      state.set(chart, s);
      let pointers = [];
      let gestureState = "none";
      let startX = 0, startY = 0, lastX = 0, lastY = 0, lastTime = 0;
      const PAN_THRESHOLD = 10;
      const TAP_THRESHOLD = 10;
      const PRESS_TIME = 500;
      let pressTimer = null;
      let pinchStartDist = 0, pinchStartZoomX = 1, pinchStartZoomY = 1;
      let pinchCenterX = 0.5, pinchCenterY = 0.5;
      let velX = 0, velY = 0;
      let lastTapTime = 0;
      let axisMode = null;
      const axisAt = (e) => {
        const rect = el.getBoundingClientRect();
        const localX = e.clientX - rect.left, localY = e.clientY - rect.top;
        const margin = chartMargin(chart);
        const overY = localX < margin.left || hasRightAxes(chart) && localX > rect.width - margin.right;
        const overX = localY > rect.height - margin.bottom;
        if (overY && !overX)
          return "y";
        if (overX && !overY)
          return "x";
        return null;
      };
      const hoverCursor = (e) => {
        const a = axisAt(e);
        return a === "x" ? "ew-resize" : a === "y" ? "ns-resize" : "";
      };
      const sendView = () => commitView(chart);
      el.addEventListener("pointerdown", (e) => {
        pointers.push(e);
        el.setPointerCapture(e.pointerId);
        chart.dragging = true;
        if (pointers.length === 1) {
          gestureState = "detecting";
          startX = e.clientX;
          startY = e.clientY;
          lastX = e.clientX;
          lastY = e.clientY;
          velX = velY = 0;
          lastTime = performance.now();
          axisMode = axisAt(e);
          if (axisMode) {
            el.style.cursor = axisMode === "x" ? "ew-resize" : "ns-resize";
          } else if (e.pointerType === "touch") {
            pressTimer = window.setTimeout(() => {
              if (gestureState === "detecting") {
                gestureState = "press";
              }
            }, PRESS_TIME);
          } else {
            el.style.cursor = "grabbing";
          }
        } else if (pointers.length === 2) {
          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
          gestureState = "pinch";
          if (e.pointerType === "touch") {
            e.preventDefault();
          }
          const rect = el.getBoundingClientRect();
          const dx = pointers[1].clientX - pointers[0].clientX;
          const dy = pointers[1].clientY - pointers[0].clientY;
          pinchStartDist = Math.hypot(dx, dy);
          pinchStartZoomX = chart.view.zoomX;
          pinchStartZoomY = chart.view.zoomY;
          pinchCenterX = ((pointers[0].clientX + pointers[1].clientX) / 2 - rect.left) / rect.width;
          pinchCenterY = 1 - ((pointers[0].clientY + pointers[1].clientY) / 2 - rect.top) / rect.height;
        }
      }, { passive: false, signal: ac.signal });
      el.addEventListener("pointermove", (e) => {
        const idx = pointers.findIndex((p) => p.pointerId === e.pointerId);
        if (idx >= 0) {
          pointers[idx] = e;
        }
        if (pointers.length >= 1 && e.buttons === 0 && (gestureState === "pan" || gestureState === "detecting" || gestureState === "press" || axisMode !== null)) {
          endPointer(e);
          return;
        }
        if (pointers.length === 0) {
          if (e.pointerType !== "touch") {
            const cursor = hoverCursor(e);
            if (el.style.cursor !== cursor)
              el.style.cursor = cursor;
          }
          return;
        }
        if (pointers.length === 1) {
          const totalDist = Math.hypot(e.clientX - startX, e.clientY - startY);
          if (gestureState === "detecting" && totalDist > PAN_THRESHOLD) {
            gestureState = "pan";
            if (pressTimer) {
              clearTimeout(pressTimer);
              pressTimer = null;
            }
          }
          if (gestureState === "press") {
            return;
          }
          if (axisMode) {
            const rect = el.getBoundingClientRect();
            if (axisMode === "x") {
              chart.view.panX -= (e.clientX - lastX) / rect.width / chart.view.zoomX;
            } else {
              chart.view.panY += (e.clientY - lastY) / rect.height / chart.view.zoomY;
            }
            lastX = e.clientX;
            lastY = e.clientY;
            sendView();
            return;
          }
          if (gestureState === "pan" || chart.dragging) {
            const rect = el.getBoundingClientRect();
            const dx = (e.clientX - lastX) / rect.width;
            const dy = (e.clientY - lastY) / rect.height;
            const now = performance.now();
            if (now - lastTime < 100) {
              velX = velX * 0.3 + dx * 0.7;
              velY = velY * 0.3 + dy * 0.7;
            }
            lastTime = now;
            const m = mode();
            const panX = m === "both" || m === "x-only";
            const panY = m === "both" || m === "y-only";
            if (panX)
              chart.view.panX -= dx / chart.view.zoomX;
            if (panY)
              chart.view.panY += dy / chart.view.zoomY;
            lastX = e.clientX;
            lastY = e.clientY;
            if (panX || panY)
              sendView();
          }
        } else if (pointers.length === 2 && gestureState === "pinch") {
          if (e.pointerType === "touch") {
            e.preventDefault();
          }
          const rect = el.getBoundingClientRect();
          const dx = pointers[1].clientX - pointers[0].clientX;
          const dy = pointers[1].clientY - pointers[0].clientY;
          const dist = Math.hypot(dx, dy);
          const currentPinchCenterX = ((pointers[0].clientX + pointers[1].clientX) / 2 - rect.left) / rect.width;
          const currentPinchCenterY = 1 - ((pointers[0].clientY + pointers[1].clientY) / 2 - rect.top) / rect.height;
          const pixelChange = dist - pinchStartDist;
          const scale = Math.exp(pixelChange / 280);
          const pm = mode();
          const b = chart.bounds;
          const pinchX = pm === "both" || pm === "x-only";
          const pinchY = pm === "both" || pm === "y-only";
          if (pinchX) {
            const fx = chart.view.panX + currentPinchCenterX / chart.view.zoomX;
            const newZoomX = limitZoom(pinchStartZoomX * scale, chart.view.zoomX, b.minX, b.maxX, b.minX + fx * (b.maxX - b.minX));
            chart.view.zoomX = newZoomX;
            chart.view.panX = fx - currentPinchCenterX / newZoomX;
          }
          if (pinchY) {
            const fy = chart.view.panY + currentPinchCenterY / chart.view.zoomY;
            const newZoomY = limitZoom(pinchStartZoomY * scale, chart.view.zoomY, b.minY, b.maxY, b.minY + fy * (b.maxY - b.minY));
            chart.view.zoomY = newZoomY;
            chart.view.panY = fy - currentPinchCenterY / newZoomY;
          }
          if (pinchX || pinchY)
            sendView();
        }
      }, { passive: false, signal: ac.signal });
      const endPointer = (e) => {
        if (!pointers.some((p) => p.pointerId === e.pointerId))
          return;
        pointers = pointers.filter((p) => p.pointerId !== e.pointerId);
        try {
          el.releasePointerCapture(e.pointerId);
        } catch (err) {}
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        if (pointers.length === 0) {
          const totalDist = Math.hypot(e.clientX - startX, e.clientY - startY);
          const isTap = totalDist < TAP_THRESHOLD && gestureState !== "pan";
          if (!isTap) {
            chart.lastDragEndTime = Date.now();
          }
          if (isTap) {
            const now = Date.now();
            if (now - lastTapTime < 300) {
              mgr.resetView(chart.id);
              lastTapTime = 0;
            } else {
              lastTapTime = now;
            }
          }
          gestureState = "none";
          chart.dragging = false;
          axisMode = null;
          el.style.cursor = e.pointerType === "touch" ? "" : hoverCursor(e);
        } else if (pointers.length === 1) {
          gestureState = "detecting";
          startX = pointers[0].clientX;
          startY = pointers[0].clientY;
          lastX = pointers[0].clientX;
          lastY = pointers[0].clientY;
          chart.dragging = true;
        }
      };
      el.addEventListener("pointerup", endPointer, { signal: ac.signal });
      el.addEventListener("pointercancel", endPointer, { signal: ac.signal });
      el.addEventListener("pointerleave", () => {
        if (pointers.length === 0)
          el.style.cursor = "";
      }, { signal: ac.signal });
      let wheelTimeout = null;
      el.addEventListener("wheel", (e) => {
        const rect = el.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        const mx = localX / rect.width;
        const my = 1 - localY / rect.height;
        const scale = 1 - e.deltaY * 0.002;
        const margin = chartMargin(chart);
        const overYAxis = localX < margin.left || hasRightAxes(chart) && localX > rect.width - margin.right;
        const overXAxis = localY > rect.height - margin.bottom;
        let zoomX;
        let zoomY;
        if (overYAxis) {
          zoomX = false;
          zoomY = true;
        } else if (overXAxis) {
          zoomX = true;
          zoomY = false;
        } else {
          const wm = mode();
          zoomX = wm === "both" || wm === "x-only";
          zoomY = wm === "both" || wm === "y-only";
        }
        if (!zoomX && !zoomY)
          return;
        e.preventDefault();
        const b = chart.bounds;
        if (zoomX) {
          const fx = chart.view.panX + mx / chart.view.zoomX;
          chart.view.zoomX = limitZoom(chart.view.zoomX * scale, chart.view.zoomX, b.minX, b.maxX, b.minX + fx * (b.maxX - b.minX));
          chart.view.panX = fx - mx / chart.view.zoomX;
        }
        if (zoomY) {
          const fy = chart.view.panY + my / chart.view.zoomY;
          chart.view.zoomY = limitZoom(chart.view.zoomY * scale, chart.view.zoomY, b.minY, b.maxY, b.minY + fy * (b.maxY - b.minY));
          chart.view.panY = fy - my / chart.view.zoomY;
        }
        chart.dragging = true;
        if (wheelTimeout)
          clearTimeout(wheelTimeout);
        wheelTimeout = setTimeout(() => {
          chart.dragging = false;
        }, 150);
        sendView();
      }, { passive: false, signal: ac.signal });
    },
    resetView(chart) {},
    afterDraw(_, chart) {
      const s = state.get(chart);
      if (!s)
        return;
      const ta = touchActionFor(chart.config.zoomMode ?? "both", s.originalTouchAction);
      if (ta !== s.touchAction)
        s.el.style.touchAction = s.touchAction = ta;
    },
    uninstall(chart) {
      const s = state.get(chart);
      if (s) {
        s.el.style.touchAction = s.originalTouchAction;
        s.el.style.userSelect = s.originalUserSelect;
        s.el.style.webkitUserSelect = s.originalWebkitUserSelect;
        s.abort.abort();
        state.delete(chart);
      }
    }
  };
}
// src/shaders/shared.ts
var COMPUTE_WG = 256;
var MAX_WG_DIM = 65535;
function dispatch2D(samples) {
  const total = Math.ceil(Math.max(1, samples) / COMPUTE_WG);
  const x = Math.min(total, MAX_WG_DIM);
  return { x, y: Math.ceil(total / x) };
}
var SAMPLE_INDEX = `id.y * nwg.x * ${COMPUTE_WG}u + id.x`;
var UNIFORM_STRUCT = `struct Uniforms{width: f32,height: f32,viewMinX: f32,viewMaxX: f32,viewMinY: f32,viewMaxY: f32,_pad0: u32,seriesCount: u32,isDark: u32,bgR: f32,bgG: f32,bgB: f32,dataMinX: f32,dataMaxX: f32,dataMinY: f32,dataMaxY: f32,highlight: u32,_hl0: u32,_hl1: u32,_hl2: u32,};struct SeriesInfo{color: vec4f,visibleRange: vec2u,_pad0: f32,_pad1: f32,};struct SeriesIndex{index: u32,_pad0: u32,_pad1: u32,_pad2: u32,};`;
var BINARY_SEARCH = `fn lowerBound(val: f32,rangeStart: u32,rangeEnd: u32)-> u32{var lo = rangeStart;var hi = rangeEnd;while(lo < hi){let mid = lo +(hi - lo)/ 2u;if(dataX[mid] < val){lo = mid + 1u;}else{hi = mid;}}return lo;}`;

// src/shaders/line.ts
var LINE_COMPUTE_SHADER = `${UNIFORM_STRUCT}struct LineUniforms{maxSamplesPerPixel: u32,_p1: u32,_p2: u32,_p3: u32};struct LineData{screenX: f32,minScreenY: f32,maxScreenY: f32,valid: f32,};@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> dataX: array<f32>;@group(0)@binding(2)var<storage,read> dataY: array<f32>;@group(0)@binding(3)var<storage,read_write> lineData: array<LineData>;@group(0)@binding(4)var<storage,read> allSeries: array<SeriesInfo>;@group(0)@binding(5)var<uniform> lu: LineUniforms;@group(0)@binding(6)var<uniform> seriesIdx: SeriesIndex;${BINARY_SEARCH}@compute @workgroup_size(${COMPUTE_WG})fn main(@builtin(global_invocation_id)id: vec3u){let outputIdx = id.x;let maxCols = min(u32(u.width),arrayLength(&lineData));if(outputIdx >= maxCols){return;}let range = allSeries[seriesIdx.index].visibleRange;let seriesStart = range.x;let seriesEnd = range.x + range.y;let viewRangeX = u.viewMaxX - u.viewMinX;let viewRangeY = u.viewMaxY - u.viewMinY;if(range.y == 0u || viewRangeX <= 0.0 || viewRangeY <= 0.0){lineData[outputIdx] = LineData(-1.0,-1.0,-1.0,0.0);return;}let relPx = f32(outputIdx);let pixelMinX = u.viewMinX +(relPx / u.width)* viewRangeX;let pixelMaxX = u.viewMinX +((relPx + 1.0)/ u.width)* viewRangeX;let firstX = dataX[seriesStart];let lastX = dataX[seriesEnd - 1u];if((firstX > -1.0e38 && pixelMaxX < firstX)||(lastX > -1.0e38 && pixelMinX > lastX)){lineData[outputIdx] = LineData(-1.0,-1.0,-1.0,0.0);return;}let startIdx = lowerBound(pixelMinX,seriesStart,seriesEnd);let endIdx = lowerBound(pixelMaxX,startIdx,seriesEnd);let centerX =(pixelMinX + pixelMaxX)* 0.5;if(startIdx >= endIdx){var bestIdx = startIdx;if(startIdx > seriesStart && startIdx < seriesEnd){let distPrev = abs(dataX[startIdx - 1u] - centerX);let distCurr = abs(dataX[startIdx] - centerX);if(distPrev < distCurr){bestIdx = startIdx - 1u;}}else if(startIdx >= seriesEnd){bestIdx = seriesEnd - 1u;}if(outputIdx == 0u && startIdx > seriesStart){bestIdx = startIdx - 1u;}if(outputIdx + 1u == maxCols && startIdx < seriesEnd){bestIdx = startIdx;}if(bestIdx >= seriesEnd){lineData[outputIdx] = LineData(-1.0,-1.0,-1.0,0.0);return;}let y = dataY[bestIdx];if(y < -1.0e38){lineData[outputIdx] = LineData(-1.0,-1.0,-1.0,0.0);return;}let normY =(y - u.viewMinY)/ viewRangeY;let screenY = 1.0 - normY;let normX =(dataX[bestIdx] - u.viewMinX)/ viewRangeX;let screenX = normX;lineData[outputIdx] = LineData(screenX,screenY,screenY,1.0);return;}var dataMinY = 3.0e38;var dataMaxY = -3.0e38;let rangeCount = endIdx - startIdx;let maxSamples = lu.maxSamplesPerPixel;if(maxSamples > 1u && rangeCount > maxSamples){let stride = f32(rangeCount - 1u)/ f32(maxSamples - 1u);for(var s = 0u;s < maxSamples;s++){let idx = startIdx + u32(f32(s)* stride);if(idx < endIdx){let y = dataY[idx];if(y > -1.0e38){dataMinY = min(dataMinY,y);dataMaxY = max(dataMaxY,y);}}}let lastY = dataY[endIdx - 1u];if(lastY > -1.0e38){dataMinY = min(dataMinY,lastY);dataMaxY = max(dataMaxY,lastY);}}else{for(var i = startIdx;i < endIdx;i++){let y = dataY[i];if(y > -1.0e38){dataMinY = min(dataMinY,y);dataMaxY = max(dataMaxY,y);}}}if(dataMaxY < dataMinY){lineData[outputIdx] = LineData(-1.0,-1.0,-1.0,0.0);return;}let normX =((dataX[startIdx] + dataX[endIdx - 1u])* 0.5 - u.viewMinX)/ viewRangeX;let screenX = normX;let normMaxY =(dataMaxY - u.viewMinY)/ viewRangeY;let normMinY =(dataMinY - u.viewMinY)/ viewRangeY;let minScreenY = 1.0 - normMaxY;let maxScreenY = 1.0 - normMinY;lineData[outputIdx] = LineData(screenX,minScreenY,maxScreenY,1.0);}`;
var LINE_RENDER_SHADER = `${UNIFORM_STRUCT}struct LineData{screenX: f32,minScreenY: f32,maxScreenY: f32,valid: f32,};@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> lineData: array<LineData>;@group(0)@binding(2)var<storage,read> allSeries: array<SeriesInfo>;struct VertexOutput{@builtin(position)pos: vec4f,@location(0)alpha: f32,@location(1)@interpolate(flat)seriesIdx: u32,};@vertex fn vs(@builtin(vertex_index)vi: u32,@builtin(instance_index)series_idx: u32)-> VertexOutput{var out: VertexOutput;out.seriesIdx = series_idx;let maxCols = min(u32(u.width),arrayLength(&lineData));let segIdx = vi / 2u;let endpoint = vi % 2u;if(segIdx < maxCols){let d = lineData[segIdx];let y = select(d.maxScreenY,d.minScreenY,endpoint == 0u);out.pos = vec4f(d.screenX * 2.0 - 1.0,1.0 - y * 2.0,0.0,d.valid);out.alpha = d.valid;}else{let connIdx = segIdx - maxCols;if(connIdx + 1u >= maxCols){out.pos = vec4f(0.0,0.0,0.0,0.0);out.alpha = 0.0;return out;}let d0 = lineData[connIdx];let d1 = lineData[connIdx + 1u];let segValid = min(d0.valid,d1.valid);if(endpoint == 0u){let midY =(d0.minScreenY + d0.maxScreenY)* 0.5;out.pos = vec4f(d0.screenX * 2.0 - 1.0,1.0 - midY * 2.0,0.0,segValid);}else{let midY =(d1.minScreenY + d1.maxScreenY)* 0.5;out.pos = vec4f(d1.screenX * 2.0 - 1.0,1.0 - midY * 2.0,0.0,segValid);}out.alpha = segValid;}return out;}@fragment fn fs(in: VertexOutput)-> @location(0)vec4f{if(in.alpha < 0.1){discard;}let series = allSeries[in.seriesIdx];let dim = select(1.0,0.35,u.highlight != 0xffffffffu && in.seriesIdx != u.highlight);return vec4f(mix(vec3f(u.bgR,u.bgG,u.bgB),series.color.rgb,dim),1.0);}`;

// src/shaders/highlight.ts
var LINE_HIGHLIGHT_SHADER = `${UNIFORM_STRUCT}struct ColData{screenX: f32,minScreenY: f32,maxScreenY: f32,valid: f32,};@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> cols: array<ColData>;@group(0)@binding(2)var<storage,read> allSeries: array<SeriesInfo>;struct VertexOutput{@builtin(position)pos: vec4f,@location(0)@interpolate(flat)seriesIdx: u32,};@vertex fn vs(@builtin(vertex_index)vi: u32,@builtin(instance_index)series_idx: u32)-> VertexOutput{var out: VertexOutput;out.seriesIdx = series_idx;out.pos = vec4f(0.0,0.0,0.0,0.0);let maxCols = min(u32(u.width),arrayLength(&cols));let seg = vi / 6u;if(seg + 1u >= maxCols){return out;}let d0 = cols[seg];let d1 = cols[seg + 1u];if(min(d0.valid,d1.valid)< 0.5){return out;}let p0 = vec2f(d0.screenX * u.width,(d0.minScreenY + d0.maxScreenY)* 0.5 * u.height);let p1 = vec2f(d1.screenX * u.width,(d1.minScreenY + d1.maxScreenY)* 0.5 * u.height);let dir = p1 - p0;let len = length(dir);if(len < 1e-4){return out;}let n = vec2f(-dir.y,dir.x)/ len * 1.5;let k = vi % 6u;var pt = p0 + n;if(k == 1u || k == 3u){pt = p0 - n;}if(k == 2u || k == 5u){pt = p1 + n;}if(k == 4u){pt = p1 - n;}out.pos = vec4f(pt.x / u.width * 2.0 - 1.0,1.0 - pt.y / u.height * 2.0,0.0,1.0);return out;}@fragment fn fs(in: VertexOutput)-> @location(0)vec4f{let series = allSeries[in.seriesIdx];return vec4f(series.color.rgb,1.0);}`;
var ERROR_BAND_HIGHLIGHT_SHADER = `${UNIFORM_STRUCT}struct ColData{screenX: f32,loScreenY: f32,hiScreenY: f32,centerScreenY: f32,valid: f32,};@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> cols: array<ColData>;@group(0)@binding(2)var<storage,read> allSeries: array<SeriesInfo>;struct VertexOutput{@builtin(position)pos: vec4f,@location(0)@interpolate(flat)seriesIdx: u32,};@vertex fn vs(@builtin(vertex_index)vi: u32,@builtin(instance_index)series_idx: u32)-> VertexOutput{var out: VertexOutput;out.seriesIdx = series_idx;out.pos = vec4f(0.0,0.0,0.0,0.0);let maxCols = min(u32(u.width),arrayLength(&cols));let seg = vi / 6u;if(seg + 1u >= maxCols){return out;}let d0 = cols[seg];let d1 = cols[seg + 1u];if(min(d0.valid,d1.valid)< 0.5){return out;}let p0 = vec2f(d0.screenX * u.width,d0.centerScreenY * u.height);let p1 = vec2f(d1.screenX * u.width,d1.centerScreenY * u.height);let dir = p1 - p0;let len = length(dir);if(len < 1e-4){return out;}let n = vec2f(-dir.y,dir.x)/ len * 1.5;let k = vi % 6u;var pt = p0 + n;if(k == 1u || k == 3u){pt = p0 - n;}if(k == 2u || k == 5u){pt = p1 + n;}if(k == 4u){pt = p1 - n;}out.pos = vec4f(pt.x / u.width * 2.0 - 1.0,1.0 - pt.y / u.height * 2.0,0.0,1.0);return out;}@fragment fn fs(in: VertexOutput)-> @location(0)vec4f{let series = allSeries[in.seriesIdx];return vec4f(series.color.rgb,1.0);}`;

// src/charts/line.ts
var LineChart = {
  name: "line",
  shaders: {
    compute: LINE_COMPUTE_SHADER,
    render: LINE_RENDER_SHADER,
    highlight: LINE_HIGHLIGHT_SHADER
  },
  uniforms: [
    { name: "maxSamplesPerPixel", type: "u32", default: 1e4 }
  ],
  buffers: [
    {
      name: "lineBuffer",
      bytes: ({ width }) => Math.max(16, width * 4 * 4),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "lineBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "custom-uniforms" },
        { binding: 6, source: "series-index" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "line-list",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => Math.max(0, width * 4 - 2),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "lineBuffer" },
        { binding: 2, source: "series-info" }
      ]
    },
    {
      type: "render",
      shader: "highlight",
      topology: "triangle-list",
      loadOp: "load",
      highlight: true,
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => Math.max(0, (width - 1) * 6),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "lineBuffer" },
        { binding: 2, source: "series-info" }
      ]
    }
  ]
};
// src/shaders/area.ts
var AREA_RENDER_SHADER = `${UNIFORM_STRUCT}struct LineData{screenX: f32,minScreenY: f32,maxScreenY: f32,valid: f32,};@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> lineData: array<LineData>;@group(0)@binding(2)var<storage,read> allSeries: array<SeriesInfo>;struct VertexOutput{@builtin(position)pos: vec4f,@location(0)@interpolate(flat)seriesIdx: u32,@location(1)@interpolate(flat)valid: f32,};@vertex fn vs(@builtin(vertex_index)vi: u32,@builtin(instance_index)series_idx: u32)-> VertexOutput{var out: VertexOutput;out.seriesIdx = series_idx;out.valid = 0.0;let maxCols = min(u32(u.width),arrayLength(&lineData));if(vi >= maxCols * 2u){out.pos = vec4f(0.0,0.0,0.0,0.0);return out;}let col = vi / 2u;let onLine =(vi % 2u)== 0u;let d = lineData[col];let viewRangeY = u.viewMaxY - u.viewMinY;let baseline = select(1.0,1.0 -(u.dataMinY - u.viewMinY)/ viewRangeY,viewRangeY > 0.0);var sx = d.screenX;var py = select(baseline,(d.minScreenY + d.maxScreenY)* 0.5,onLine);if(d.valid < 0.5 && vi > 0u){let prevCol =(vi - 1u)/ 2u;let pd = lineData[prevCol];sx = pd.screenX;py = select(baseline,(pd.minScreenY + pd.maxScreenY)* 0.5,(vi - 1u)% 2u == 0u);}let clipX = sx * 2.0 - 1.0;let clipY = 1.0 - py * 2.0;out.valid = d.valid;out.pos = vec4f(clipX,clipY,0.0,1.0);return out;}@fragment fn fs(in: VertexOutput)-> @location(0)vec4f{if(in.valid < 0.5){discard;}let series = allSeries[in.seriesIdx];return vec4f(series.color.rgb,1.0);}`;

// src/charts/area.ts
var AreaChart = {
  name: "area",
  shaders: {
    compute: LINE_COMPUTE_SHADER,
    render: AREA_RENDER_SHADER
  },
  uniforms: [
    { name: "maxSamplesPerPixel", type: "u32", default: 1e4 }
  ],
  buffers: [
    {
      name: "lineBuffer",
      bytes: ({ width }) => Math.max(16, width * 4 * 4),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "lineBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "custom-uniforms" },
        { binding: 6, source: "series-index" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-strip",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => Math.max(0, width * 2),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "lineBuffer" },
        { binding: 2, source: "series-info" }
      ]
    }
  ]
};
// src/shaders/scatter.ts
var SCATTER_COMPUTE_SHADER = `${UNIFORM_STRUCT}struct ScatterUniforms{pointSize: f32,_p0: f32,_p1: f32,_p2: f32};@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> dataX: array<f32>;@group(0)@binding(2)var<storage,read> dataY: array<f32>;@group(0)@binding(3)var outputTex: texture_storage_2d<rgba8unorm,write>;@group(0)@binding(4)var<storage,read> allSeries: array<SeriesInfo>;@group(0)@binding(5)var<uniform> seriesIdx: SeriesIndex;@group(0)@binding(6)var<uniform> su: ScatterUniforms;@compute @workgroup_size(${COMPUTE_WG})fn main(@builtin(global_invocation_id)id: vec3u,@builtin(num_workgroups)nwg: vec3u){let series = allSeries[seriesIdx.index];let visStart = series.visibleRange.x;let visCount = series.visibleRange.y;let localIdx = ${SAMPLE_INDEX};if(localIdx >= visCount){return;}let idx = visStart + localIdx;let x = dataX[idx];let y = dataY[idx];if(abs(x)> 1.0e38 || y < -1.0e38){return;}if(y < u.viewMinY || y > u.viewMaxY){return;}let width = u32(u.width);let height = u32(u.height);let rangeX = u.viewMaxX - u.viewMinX;let rangeY = u.viewMaxY - u.viewMinY;if(rangeX <= 0.0 || rangeY <= 0.0){return;}let normX =(x - u.viewMinX)/ rangeX;let normY =(y - u.viewMinY)/ rangeY;let screenX = normX;let screenY = 1.0 - normY;let pixelX = i32(screenX * f32(width));let pixelY = i32(screenY * f32(height));if(idx > visStart){let prevX = dataX[idx - 1u];let prevY = dataY[idx - 1u];let prevNormX =(prevX - u.viewMinX)/ rangeX;let prevNormY =(prevY - u.viewMinY)/ rangeY;let prevPx = i32(prevNormX * f32(width));let prevPy = i32((1.0 - prevNormY)* f32(height));if(pixelX == prevPx && pixelY == prevPy){return;}}let iWidth = i32(width);let iHeight = i32(height);if(pixelX < 0 || pixelX >= iWidth){return;}if(pixelY < 0 || pixelY >= iHeight){return;}let color = series.color;let radius = i32(su.pointSize);for(var dy = -radius;dy <= radius;dy++){for(var dx = -radius;dx <= radius;dx++){if(dx * dx + dy * dy > radius * radius){continue;}let px = pixelX + dx;let py = pixelY + dy;if(px >= 0 && px < iWidth && py >= 0 && py < iHeight){textureStore(outputTex,vec2i(px,py),color);}}}}`;

// src/charts/scatter.ts
var ScatterChart = {
  name: "scatter",
  shaders: {
    compute: SCATTER_COMPUTE_SHADER
  },
  uniforms: [
    { name: "pointSize", type: "f32", default: 3 }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ samples }) => dispatch2D(samples),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "render-target", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" },
        { binding: 6, source: "custom-uniforms" }
      ]
    }
  ]
};
// src/shaders/box.ts
var BAR_UNIFORMS = `struct BarUniforms { maxSamplesPerPixel: u32, barOpacity: f32, _p2: u32, _p3: u32 };`;
var BOX_COMPUTE_SHADER = `${UNIFORM_STRUCT}${BAR_UNIFORMS}struct BarData{screenX: f32,minY: f32,maxY: f32,barWidth: f32,};@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> dataX: array<f32>;@group(0)@binding(2)var<storage,read> dataY: array<f32>;@group(0)@binding(3)var<storage,read_write> barData: array<BarData>;@group(0)@binding(4)var<storage,read> allSeries: array<SeriesInfo>;@group(0)@binding(5)var<uniform> seriesIdx: SeriesIndex;@group(0)@binding(6)var<uniform> bu: BarUniforms;${BINARY_SEARCH}fn barHalfWidth(idx: u32,seriesStart: u32,seriesEnd: u32)-> f32{if(seriesEnd - seriesStart <= 1u){return(u.viewMaxX - u.viewMinX)* 0.4;}var spacing: f32;if(idx == seriesStart){spacing = dataX[seriesStart + 1u] - dataX[seriesStart];}else if(idx + 1u >= seriesEnd){spacing = dataX[seriesEnd - 1u] - dataX[seriesEnd - 2u];}else{spacing = min(dataX[idx + 1u] - dataX[idx],dataX[idx] - dataX[idx - 1u]);}let seriesCount = max(1u,u.seriesCount);return(spacing * 0.4)/ f32(seriesCount);}@compute @workgroup_size(${COMPUTE_WG})fn main(@builtin(global_invocation_id)id: vec3u){let outputIdx = id.x;let maxCols = min(u32(u.width),arrayLength(&barData));if(outputIdx >= maxCols){return;}let range = allSeries[seriesIdx.index].visibleRange;let seriesStart = range.x;let seriesEnd = range.x + range.y;let viewRangeX = u.viewMaxX - u.viewMinX;let viewRangeY = u.viewMaxY - u.viewMinY;if(range.y == 0u || viewRangeX <= 0.0 || viewRangeY <= 0.0){barData[outputIdx] = BarData(0.0,0.0,0.0,0.0);return;}let relPx = f32(outputIdx);let pixelMinX = u.viewMinX +(relPx / u.width)* viewRangeX;let pixelMaxX = u.viewMinX +((relPx + 1.0)/ u.width)* viewRangeX;let startIdx = lowerBound(pixelMinX,seriesStart,seriesEnd);let endIdx = lowerBound(pixelMaxX,startIdx,seriesEnd);let centerX =(pixelMinX + pixelMaxX)* 0.5;let onePixel = 1.0 / u.width;if(startIdx >= endIdx){var hit = false;var bestX: f32 = 0.0;var bestY: f32 = 0.0;var bestHW: f32 = 0.0;var bestDist: f32 = 1e10;if(startIdx < seriesEnd && dataY[startIdx] > -1.0e38){let bx = dataX[startIdx];let hw = barHalfWidth(startIdx,seriesStart,seriesEnd);if(pixelMinX < bx + hw && pixelMaxX > bx - hw){let d = abs(bx - centerX);bestX = bx;bestY = dataY[startIdx];bestHW = hw;bestDist = d;hit = true;}}if(startIdx > seriesStart && dataY[startIdx - 1u] > -1.0e38){let prev = startIdx - 1u;let bx = dataX[prev];let hw = barHalfWidth(prev,seriesStart,seriesEnd);if(pixelMinX < bx + hw && pixelMaxX > bx - hw){let d = abs(bx - centerX);if(d < bestDist){bestX = bx;bestY = dataY[prev];bestHW = hw;bestDist = d;}hit = true;}}if(!hit){barData[outputIdx] = BarData(0.0,0.0,0.0,0.0);return;}let cx = clamp(bestX,u.viewMinX,u.viewMaxX);let owner =(pixelMinX <= cx && cx < pixelMaxX)||(outputIdx + 1u == maxCols && cx >= pixelMaxX);if(!owner){barData[outputIdx] = BarData(0.0,0.0,0.0,0.0);return;}let seriesCount = max(1u,u.seriesCount);let barOffset =(f32(seriesIdx.index)- f32(seriesCount - 1u)* 0.5)*(bestHW * 2.0);let offsetX = bestX + barOffset;let normX =(offsetX - u.viewMinX)/ viewRangeX;let fullWidth = bestHW * 2.0 / viewRangeX;let gapSize = max(onePixel,fullWidth * 0.05);let bw = max(fullWidth - gapSize,onePixel);barData[outputIdx] = BarData(normX,bestY,bestY,bw);return;}var dataMinY = 3.0e38;var dataMaxY = -3.0e38;let rangeCount = endIdx - startIdx;let maxSamples = bu.maxSamplesPerPixel;if(maxSamples > 1u && rangeCount > maxSamples){let stride = f32(rangeCount - 1u)/ f32(maxSamples - 1u);for(var s = 0u;s < maxSamples;s++){let idx = startIdx + u32(f32(s)* stride);if(idx < endIdx){let y = dataY[idx];if(y > -1.0e38){dataMinY = min(dataMinY,y);dataMaxY = max(dataMaxY,y);}}}let lastY = dataY[endIdx - 1u];if(lastY > -1.0e38){dataMinY = min(dataMinY,lastY);dataMaxY = max(dataMaxY,lastY);}}else{for(var i = startIdx;i < endIdx;i++){let y = dataY[i];if(y > -1.0e38){dataMinY = min(dataMinY,y);dataMaxY = max(dataMaxY,y);}}}if(dataMaxY < dataMinY){barData[outputIdx] = BarData(0.0,0.0,0.0,0.0);return;}let hw = barHalfWidth(startIdx,seriesStart,seriesEnd);let fullWidth = hw * 2.0 / viewRangeX;let gapSize = max(onePixel,fullWidth * 0.05);let bw = max(fullWidth - gapSize,onePixel);let seriesCount = max(1u,u.seriesCount);let barOffset =(f32(seriesIdx.index)- f32(seriesCount - 1u)* 0.5)*(hw * 2.0);let dataX_centered = dataX[startIdx] + barOffset;let normX =(dataX_centered - u.viewMinX)/ viewRangeX;barData[outputIdx] = BarData(normX,dataMinY,dataMaxY,bw);}`;
var BOX_RENDER_SHADER = `${UNIFORM_STRUCT}${BAR_UNIFORMS}struct BarData{screenX: f32,minY: f32,maxY: f32,barWidth: f32,};@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> barData: array<BarData>;@group(0)@binding(2)var<storage,read> allSeries: array<SeriesInfo>;@group(0)@binding(3)var<uniform> bu: BarUniforms;struct VertexOutput{@builtin(position)pos: vec4f,@location(0)normY: f32,@location(1)@interpolate(flat)seriesIdx: u32,};@vertex fn vs(@builtin(vertex_index)vi: u32,@builtin(instance_index)series_idx: u32)-> VertexOutput{var out: VertexOutput;out.seriesIdx = series_idx;let maxCols = min(u32(u.width),arrayLength(&barData));let colIdx = vi / 6u;let vertexType = vi % 6u;if(colIdx >= maxCols){out.pos = vec4f(0.0,0.0,0.0,0.0);out.normY = 0.0;return out;}let bd = barData[colIdx];if(bd.barWidth <= 0.0){out.pos = vec4f(0.0,0.0,0.0,0.0);out.normY = 0.0;return out;}let viewRangeY = u.viewMaxY - u.viewMinY;let safeRangeY = select(viewRangeY,1.0,viewRangeY <= 0.0);let normMinY =(min(bd.minY,0.0)- u.viewMinY)/ safeRangeY;let normMaxY =(max(bd.maxY,0.0)- u.viewMinY)/ safeRangeY;let top = 1.0 - normMaxY;let bottom = 1.0 - normMinY;let halfW = bd.barWidth * 0.5;let left = bd.screenX - halfW;let right = bd.screenX + halfW;var positions = array<vec2f,6>(vec2f(left,bottom),vec2f(right,bottom),vec2f(left,top),vec2f(left,top),vec2f(right,bottom),vec2f(right,top));let screenPos = positions[vertexType];let clipX = screenPos.x * 2.0 - 1.0;let clipY = 1.0 - screenPos.y * 2.0;out.pos = vec4f(clipX,clipY,0.0,1.0);out.normY = normMaxY;return out;}@fragment fn fs(in: VertexOutput)-> @location(0)vec4f{let series = allSeries[in.seriesIdx];return vec4f(series.color.rgb,bu.barOpacity);}`;

// src/charts/bar.ts
var BarChart = {
  name: "bar",
  shaders: {
    compute: BOX_COMPUTE_SHADER,
    render: BOX_RENDER_SHADER
  },
  uniforms: [
    { name: "maxSamplesPerPixel", type: "u32", default: 1e4 },
    { name: "barOpacity", type: "f32", default: 1 }
  ],
  buffers: [
    {
      name: "barBuffer",
      bytes: ({ width }) => Math.max(16, width * 4 * 4),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "barBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" },
        { binding: 6, source: "custom-uniforms" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => width * 6,
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "barBuffer" },
        { binding: 2, source: "series-info" },
        { binding: 3, source: "custom-uniforms" }
      ]
    }
  ]
};
// src/shaders/candlestick.ts
var CANDLE_TYPES = `struct CandleUniforms{maxSamples: f32,upColor: u32,downColor: u32,binSize: u32,interval: f32,_p0: u32,_p1: u32,_p2: u32,};struct CandleData{screenX: f32,barWidth: f32,low: f32,bodyBottom: f32,bodyTop: f32,high: f32,isUp: f32,};`;
var EFFECTIVE_INTERVAL = `fn effectiveInterval()-> f32{let viewRangeX = u.viewMaxX - u.viewMinX;var iv = cu.interval;if(iv <= 0.0){let raw = viewRangeX / u.width * f32(max(cu.binSize,1u));let steps = array<f32,20>(1.0,2.0,5.0,10.0,15.0,30.0,60.0,120.0,300.0,600.0,900.0,1800.0,3600.0,7200.0,14400.0,43200.0,86400.0,259200.0,604800.0,2592000.0);iv = raw;for(var i = 0u;i < 20u;i++){if(steps[i] >= raw){iv = steps[i];break;}}}let cols = max(u.width - 2.0,1.0);return iv * max(1.0,ceil(viewRangeX /(iv * cols)));}fn candleBins(interval: f32)-> u32{let viewRangeX = u.viewMaxX - u.viewMinX;return min(u32(ceil(viewRangeX / interval))+ 2u,min(u32(u.width),arrayLength(&candleData)));}`;
var CANDLESTICK_COMPUTE_SHADER = `${UNIFORM_STRUCT}${CANDLE_TYPES}@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> dataX: array<f32>;@group(0)@binding(2)var<storage,read> dataClose: array<f32>;@group(0)@binding(3)var<storage,read_write> candleData: array<CandleData>;@group(0)@binding(4)var<storage,read> allSeries: array<SeriesInfo>;@group(0)@binding(5)var<uniform> seriesIdx: SeriesIndex;@group(0)@binding(6)var<uniform> cu: CandleUniforms;@group(0)@binding(7)var<storage,read> dataOpen: array<f32>;@group(0)@binding(8)var<storage,read> dataHigh: array<f32>;@group(0)@binding(9)var<storage,read> dataLow: array<f32>;${BINARY_SEARCH}${EFFECTIVE_INTERVAL}fn candleAt(i: u32)-> vec4f{let c = dataClose[i];var o = dataOpen[i];if(o < -1.0e38){o = c;}var h = dataHigh[i];if(h < -1.0e38){h = max(o,c);}var l = dataLow[i];if(l < -1.0e38){l = min(o,c);}return vec4f(o,h,l,c);}@compute @workgroup_size(${COMPUTE_WG})fn main(@builtin(global_invocation_id)id: vec3u){let binIdx = id.x;let maxBins = min(u32(u.width),arrayLength(&candleData));if(binIdx >= maxBins){return;}let range = allSeries[seriesIdx.index].visibleRange;let seriesStart = range.x;let seriesEnd = range.x + range.y;let viewRangeX = u.viewMaxX - u.viewMinX;let viewRangeY = u.viewMaxY - u.viewMinY;if(range.y == 0u || viewRangeX <= 0.0 || viewRangeY <= 0.0){candleData[binIdx] = CandleData(0.0,0.0,0.0,0.0,0.0,0.0,0.0);return;}let interval = effectiveInterval();let alignedStart = floor(u.viewMinX / interval)* interval;let numBins = candleBins(interval);if(binIdx >= numBins){return;}let binMinX = alignedStart + f32(binIdx)* interval;let binMaxX = binMinX + interval;if(binMinX >= u.viewMaxX){candleData[binIdx] = CandleData(0.0,0.0,0.0,0.0,0.0,0.0,0.0);return;}let binMidX = binMinX + interval * 0.5;let screenX =(binMidX - u.viewMinX)/ viewRangeX;let barWidth = interval / viewRangeX;let onePixel = 1.0 / u.width;let bw = max(barWidth * 0.95,onePixel);let startIdx = lowerBound(binMinX,seriesStart,seriesEnd);let endIdx = lowerBound(binMaxX,startIdx,seriesEnd);if(startIdx >= endIdx){var bestIdx: u32 = 0u;var bestDist: f32 = 1e10;var hit = false;if(startIdx < seriesEnd){let bx = dataX[startIdx];let hw = interval * 0.5;if(binMinX < bx + hw && binMaxX > bx - hw){bestIdx = startIdx;bestDist = abs(bx - binMidX);hit = true;}}if(startIdx > seriesStart){let prev = startIdx - 1u;let bx = dataX[prev];let hw = interval * 0.5;if(binMinX < bx + hw && binMaxX > bx - hw){let d = abs(bx - binMidX);if(!hit || d < bestDist){bestIdx = prev;}hit = true;}}let k = candleAt(bestIdx);if(!hit || k.w < -1.0e38){candleData[binIdx] = CandleData(0.0,0.0,0.0,0.0,0.0,0.0,0.0);return;}candleData[binIdx] = CandleData(screenX,bw,k.z,min(k.x,k.w),max(k.x,k.w),k.y,select(0.0,1.0,k.w>=k.x));return;}var found = false;var o = 0.0;var c = 0.0;var h = -3.0e38;var l = 3.0e38;let rangeCount = endIdx - startIdx;let maxSamples = u32(cu.maxSamples);if(maxSamples > 1u && rangeCount > maxSamples){let stride = f32(rangeCount - 1u)/ f32(maxSamples - 1u);for(var s = 0u;s <= maxSamples;s++){let idx = select(startIdx + u32(f32(s)* stride),endIdx - 1u,s == maxSamples);if(idx < endIdx){let k = candleAt(idx);if(k.w > -1.0e38){if(!found){o = k.x;found = true;}c = k.w;h = max(h,k.y);l = min(l,k.z);}}}}else{for(var i = startIdx;i < endIdx;i++){let k = candleAt(i);if(k.w > -1.0e38){if(!found){o = k.x;found = true;}c = k.w;h = max(h,k.y);l = min(l,k.z);}}}if(!found){candleData[binIdx] = CandleData(0.0,0.0,0.0,0.0,0.0,0.0,0.0);return;}candleData[binIdx] = CandleData(screenX,bw,l,min(o,c),max(o,c),h,select(0.0,1.0,c>=o));}`;
var CANDLESTICK_RENDER_SHADER = `${UNIFORM_STRUCT}${CANDLE_TYPES}@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> candleData: array<CandleData>;@group(0)@binding(2)var<uniform> cu: CandleUniforms;${EFFECTIVE_INTERVAL}struct VertexOutput{@builtin(position)pos: vec4f,@location(0)@interpolate(flat)isUp: f32,@location(1)@interpolate(flat)isWick: f32,};@vertex fn vs(@builtin(vertex_index)vi: u32)-> VertexOutput{var out: VertexOutput;let viewRangeX = u.viewMaxX - u.viewMinX;let colIdx = vi / 30u;let localVi = vi % 30u;let section = localVi / 6u;let vertexType = localVi % 6u;if(viewRangeX <= 0.0 || colIdx >= candleBins(effectiveInterval())){out.pos = vec4f(0.0,0.0,0.0,0.0);out.isUp = 0.0;out.isWick = 0.0;return out;}let cd = candleData[colIdx];if(cd.barWidth <= 0.0){out.pos = vec4f(0.0,0.0,0.0,0.0);out.isUp = 0.0;out.isWick = 0.0;return out;}out.isUp = cd.isUp;out.isWick = select(0.0,1.0,section > 0u);let viewRangeY = u.viewMaxY - u.viewMinY;let safeRangeY = select(viewRangeY,1.0,viewRangeY <= 0.0);let onePixelX = 1.0 / u.width;let onePixelY = 1.0 / u.height;var sLeft: f32;var sRight: f32;var sTop: f32;var sBottom: f32;if(section == 0u){let nb =(cd.bodyBottom - u.viewMinY)/ safeRangeY;let nt =(cd.bodyTop - u.viewMinY)/ safeRangeY;sBottom = 1.0 - nb;sTop = 1.0 - nt;let hw = cd.barWidth * 0.5;sLeft = cd.screenX - hw;sRight = cd.screenX + hw;}else if(section == 1u){let nb =(cd.bodyTop - u.viewMinY)/ safeRangeY;let nt =(cd.high - u.viewMinY)/ safeRangeY;sBottom = 1.0 - nb;sTop = 1.0 - nt;let hw = max(onePixelX,cd.barWidth * 0.08);sLeft = cd.screenX - hw;sRight = cd.screenX + hw;}else if(section == 2u){let nb =(cd.low - u.viewMinY)/ safeRangeY;let nt =(cd.bodyBottom - u.viewMinY)/ safeRangeY;sBottom = 1.0 - nb;sTop = 1.0 - nt;let hw = max(onePixelX,cd.barWidth * 0.08);sLeft = cd.screenX - hw;sRight = cd.screenX + hw;}else if(section == 3u){let sy = 1.0 -(cd.high - u.viewMinY)/ safeRangeY;let wickHW = max(onePixelX,cd.barWidth * 0.08);let capHH = wickHW * u.width / u.height;sTop = sy - capHH;sBottom = sy + capHH;let hw = max(onePixelX * 2.0,cd.barWidth * 0.28);sLeft = cd.screenX - hw;sRight = cd.screenX + hw;}else{let sy = 1.0 -(cd.low - u.viewMinY)/ safeRangeY;let wickHW = max(onePixelX,cd.barWidth * 0.08);let capHH = wickHW * u.width / u.height;sTop = sy - capHH;sBottom = sy + capHH;let hw = max(onePixelX * 2.0,cd.barWidth * 0.28);sLeft = cd.screenX - hw;sRight = cd.screenX + hw;}var positions = array<vec2f,6>(vec2f(sLeft,sBottom),vec2f(sRight,sBottom),vec2f(sLeft,sTop),vec2f(sLeft,sTop),vec2f(sRight,sBottom),vec2f(sRight,sTop));let sp = positions[vertexType];out.pos = vec4f(sp.x * 2.0 - 1.0,1.0 - sp.y * 2.0,0.0,1.0);return out;}@fragment fn fs(in: VertexOutput)-> @location(0)vec4f{let upRgb = unpack4x8unorm(cu.upColor).rgb;let downRgb = unpack4x8unorm(cu.downColor).rgb;let base = select(downRgb,upRgb,in.isUp > 0.5);let color = select(base,base * 0.65,in.isWick > 0.5);return vec4f(color,0.92);}`;

// src/charts/candlestick.ts
var packRGB = (r, g, b) => (Math.round(r * 255) & 255 | (Math.round(g * 255) & 255) << 8 | (Math.round(b * 255) & 255) << 16 | 255 << 24) >>> 0;
var BYTES_PER_CANDLE = 7 * 4;
var CandlestickChart = {
  name: "candlestick",
  shaders: {
    compute: CANDLESTICK_COMPUTE_SHADER,
    render: CANDLESTICK_RENDER_SHADER
  },
  uniforms: [
    { name: "maxSamples", type: "f32", default: 1e4 },
    { name: "upColor", type: "u32", default: packRGB(0.2, 0.7, 0.3) },
    { name: "downColor", type: "u32", default: packRGB(0.9, 0.3, 0.3) },
    { name: "binSize", type: "u32", default: 8 },
    { name: "interval", type: "f32", default: 0 }
  ],
  buffers: [
    {
      name: "candleBuffer",
      bytes: ({ width }) => Math.max(16, width * BYTES_PER_CANDLE),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "candleBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" },
        { binding: 6, source: "custom-uniforms" },
        { binding: 7, source: "open-data" },
        { binding: 8, source: "high-data" },
        { binding: 9, source: "low-data" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => width * 30,
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "candleBuffer" },
        { binding: 2, source: "custom-uniforms" }
      ]
    }
  ],
  computeBounds(series) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of series) {
      for (const x of s.rawX) {
        if (x == null || x !== x)
          continue;
        if (x < minX)
          minX = x;
        if (x > maxX)
          maxX = x;
      }
      for (const arr of [s.rawY, s.extra.high ?? [], s.extra.low ?? []]) {
        for (const y of arr) {
          if (y == null || y !== y)
            continue;
          if (y < minY)
            minY = y;
          if (y > maxY)
            maxY = y;
        }
      }
    }
    if (!isFinite(minX))
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    if (!isFinite(minY)) {
      minY = 0;
      maxY = 1;
    }
    const px = (maxX - minX) * 0.05 || 1;
    const py = (maxY - minY) * 0.1 || 1;
    return { minX: minX - px, maxX: maxX + px, minY: minY - py, maxY: maxY + py };
  }
};
// src/shaders/boids.ts
var BOID_STATE = `struct BoidState { pos: vec2f, vel: vec2f, species: u32, _pad: u32 }`;
var PERCEPTION = 0.2;
var SEP_R = PERCEPTION * 0.2;
var MAX_SPD = 0.003;
var TURN_RATE = 0.7;
var W_SEP = 0.15;
var W_ALIGN = 0.02;
var W_COH = 0.001;
var W_NOISE = 0.2;
var CONTAIN_STRENGTH = 0.003;
var CONTAIN_PAD = 0.1;
var CLOSE_CELLS = 1;
var GRID_W = 16;
var GRID_H = 16;
var MAX_PER_CELL = 16;
var GRID_HELPERS = `
const GRID_W       = ${GRID_W}u;
const GRID_H       = ${GRID_H}u;
const MAX_PER_CELL = ${MAX_PER_CELL}u;
// Returns (cellX, cellY, gridMinX, gridMinY) sized to cover the padded view.
fn gridParams(vMinX: f32, vMaxX: f32, vMinY: f32, vMaxY: f32) -> vec4f {
  let cX = (vMaxX - vMinX) * ${1 + CONTAIN_PAD}f / f32(GRID_W);
  let cY = (vMaxY - vMinY) * ${1 + CONTAIN_PAD}f / f32(GRID_H);
  return vec4f(cX, cY,
    (vMinX + vMaxX) * 0.5 - cX * f32(GRID_W) * 0.5,
    (vMinY + vMaxY) * 0.5 - cY * f32(GRID_H) * 0.5);
}
fn boidToCell(pos: vec2f, gp: vec4f) -> vec2i {
  return clamp(
    vec2i(i32((pos.x - gp.z) / gp.x), i32((pos.y - gp.w) / gp.y)),
    vec2i(0, 0), vec2i(i32(GRID_W) - 1, i32(GRID_H) - 1)
  );
}`;
var BOIDS_INIT_SHADER = `${UNIFORM_STRUCT}${BOID_STATE}@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> dataX: array<f32>;@group(0)@binding(2)var<storage,read> dataY: array<f32>;@group(0)@binding(3)var<storage,read_write> boidsState: array<BoidState>;@group(0)@binding(4)var<uniform> seriesIdx: SeriesIndex;@group(0)@binding(5)var<storage,read> allSeries: array<SeriesInfo>;fn hash2(p: vec2f)-> vec2f{let q = vec2f(dot(p,vec2f(127.1,311.7)),dot(p,vec2f(269.5,183.3)));return fract(sin(q)* 43758.5453);}@compute @workgroup_size(${COMPUTE_WG})fn main(@builtin(global_invocation_id)id: vec3u,@builtin(num_workgroups)nwg: vec3u){let i = ${SAMPLE_INDEX};let count = allSeries[seriesIdx.index].visibleRange.y;if(i >= count){return;}let b = boidsState[i];if(b.vel.x == 0.0 && b.vel.y == 0.0){let seed = f32(seriesIdx.index * count + i);let rPos = hash2(vec2f(seed * 0.1,1.7));let rVel = hash2(vec2f(seed * 0.1,0.5));let a = rVel.x * 6.28318;let spd = 0.002 + rVel.y * 0.003;boidsState[i] = BoidState(vec2f(rPos.x,rPos.y),vec2f(cos(a)* spd,sin(a)* spd),seriesIdx.index,0u);}}`;
var BOIDS_CLEAR_SHADER = `${GRID_HELPERS}@group(0)@binding(0)var<storage,read_write> gridCount: array<atomic<u32>>;@compute @workgroup_size(${GRID_W * GRID_H})fn main(@builtin(global_invocation_id)id: vec3u){atomicStore(&gridCount[id.x],0u);}`;
var BOIDS_INSERT_SHADER = `${UNIFORM_STRUCT}${BOID_STATE}${GRID_HELPERS}@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> boidsState: array<BoidState>;@group(0)@binding(2)var<storage,read_write> gridCount: array<atomic<u32>>;@group(0)@binding(3)var<storage,read_write> gridBoids: array<u32>;@group(0)@binding(4)var<storage,read> allSeries: array<SeriesInfo>;@group(0)@binding(5)var<uniform> seriesIdx: SeriesIndex;@compute @workgroup_size(${COMPUTE_WG})fn main(@builtin(global_invocation_id)id: vec3u,@builtin(num_workgroups)nwg: vec3u){let i = ${SAMPLE_INDEX};if(i >= allSeries[seriesIdx.index].visibleRange.y){return;}let gp = gridParams(u.viewMinX,u.viewMaxX,u.viewMinY,u.viewMaxY);let gc = boidToCell(boidsState[i].pos,gp);let cell = u32(gc.y * i32(GRID_W)+ gc.x);let slot = atomicAdd(&gridCount[cell],1u);if(slot < MAX_PER_CELL){gridBoids[cell * MAX_PER_CELL + slot] = i;}}`;
var BOIDS_SIM_SHADER = `${UNIFORM_STRUCT}${BOID_STATE}${GRID_HELPERS}@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read_write> boidsState: array<BoidState>;@group(0)@binding(2)var<uniform> seriesIdx: SeriesIndex;@group(0)@binding(3)var<storage,read> gridCount: array<u32>;@group(0)@binding(4)var<storage,read> gridBoids: array<u32>;@group(0)@binding(5)var<storage,read> allSeries: array<SeriesInfo>;fn hash2(p: vec2f)-> vec2f{let q = vec2f(dot(p,vec2f(127.1,311.7)),dot(p,vec2f(269.5,183.3)));return fract(sin(q)* 43758.5453);}@compute @workgroup_size(${COMPUTE_WG})fn main(@builtin(global_invocation_id)id: vec3u,@builtin(num_workgroups)nwg: vec3u){let i = ${SAMPLE_INDEX};if(i >= allSeries[seriesIdx.index].visibleRange.y){return;}let me = boidsState[i];let viewRange =(u.viewMaxX - u.viewMinX + u.viewMaxY - u.viewMinY)* 0.5;let dynMaxSpd = ${MAX_SPD}* max(viewRange,1.0);let gp = gridParams(u.viewMinX,u.viewMaxX,u.viewMinY,u.viewMaxY);let cellSize = min(gp.x,gp.y);let dynPer = cellSize * 2.0;let dynSep = dynPer * ${SEP_R / PERCEPTION};let perSq = dynPer * dynPer;let sepSq = dynSep * dynSep;var sep = vec2f(0.0);var align = vec2f(0.0);var coh = vec2f(0.0);var sameCnt = 0u;let lookahead = me.pos + me.vel;let gc = boidToCell(me.pos,gp);for(var dy = -${CLOSE_CELLS};dy <= ${CLOSE_CELLS};dy++){for(var dx = -${CLOSE_CELLS};dx <= ${CLOSE_CELLS};dx++){let nx = gc.x + dx;let ny = gc.y + dy;if(nx < 0 || nx >= i32(GRID_W)|| ny < 0 || ny >= i32(GRID_H)){continue;}let cell = u32(ny * i32(GRID_W)+ nx);let cnt = min(gridCount[cell],MAX_PER_CELL);let base = cell * MAX_PER_CELL;for(var s = 0u;s < cnt;s++){let j = gridBoids[base + s];if(j == i){continue;}let o = boidsState[j];let d = o.pos - lookahead;let dSq = dot(d,d);if(dSq < perSq && dSq > 1e-10){sameCnt += 1u;if(dSq < sepSq){sep -= d / dSq;}align += o.vel;coh += o.pos;}}}}var accel = vec2f(0.0);if(sameCnt > 0u){let fc = f32(sameCnt);let sepMag = length(sep);if(sepMag > 1e-9){accel +=(sep / sepMag)* dynMaxSpd * ${W_SEP};}let avgVel = align / fc;let avgSpd = length(avgVel);if(avgSpd > 1e-9){accel +=(avgVel / avgSpd * dynMaxSpd - me.vel)* ${W_ALIGN};}let toCenter = coh / fc - me.pos;let toCenterLen = length(toCenter);if(toCenterLen > 1e-9){accel +=(toCenter / toCenterLen * dynMaxSpd - me.vel)* ${W_COH};}}let n = hash2(me.pos * 150.0 + vec2f(f32(i)* 0.013,0.0));accel +=(n - 0.5)*(dynMaxSpd * ${W_NOISE});let cx =(u.viewMinX + u.viewMaxX)* 0.5;let cy =(u.viewMinY + u.viewMaxY)* 0.5;let ax =(u.viewMaxX - u.viewMinX)* 0.5 *(1.0 + ${CONTAIN_PAD});let ay =(u.viewMaxY - u.viewMinY)* 0.5 *(1.0 + ${CONTAIN_PAD});let ex =(me.pos.x - cx)/ ax;let ey =(me.pos.y - cy)/ ay;let er = pow(ex*ex*ex*ex + ey*ey*ey*ey,0.25);let edge = max(1.0 - er,1e-4);let bW = dynMaxSpd * ${CONTAIN_STRENGTH};let maxB = dynMaxSpd * 1.5;let fMag = clamp(bW /(edge * edge),0.0,maxB);let gx = ex * ex * ex / ax;let gy = ey * ey * ey / ay;let gLen = max(sqrt(gx*gx + gy*gy),1e-8);accel -= vec2f(gx,gy)/ gLen * fMag;let curLen = length(me.vel);let curDir = select(vec2f(1.0,0.0),me.vel / curLen,curLen > 1e-12);let desired = me.vel + accel;let desLen = length(desired);let desDir = select(curDir,desired / desLen,desLen > 1e-12);let vel = normalize(mix(curDir,desDir,${TURN_RATE}))* dynMaxSpd;boidsState[i] = BoidState(me.pos + vel,vel,me.species,0u);}`;
var BOIDS_RENDER_SHADER = `${UNIFORM_STRUCT}${BOID_STATE}struct BoidUniforms{radius: f32,_p0: u32,_p1: u32,_p2: u32}@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> boidsState: array<BoidState>;@group(0)@binding(2)var<storage,read> allSeries: array<SeriesInfo>;@group(0)@binding(3)var<uniform> seriesIdx: SeriesIndex;@group(0)@binding(4)var<uniform> bu: BoidUniforms;struct VertexOutput{@builtin(position)pos: vec4f,@location(0)uv: vec2f,@location(1)color: vec4f}@vertex fn vs(@builtin(vertex_index)vi: u32)-> VertexOutput{var out: VertexOutput;out.uv = vec2f(0.0);out.color = vec4f(0.0);out.pos = vec4f(0.0,0.0,2.0,1.0);let boidIdx = vi / 6u;let series = allSeries[seriesIdx.index];if(boidIdx >= series.visibleRange.y){return out;}let vtxInQuad = vi % 6u;let b = boidsState[boidIdx];let rx = u.viewMaxX - u.viewMinX;let ry = u.viewMaxY - u.viewMinY;if(rx <= 0.0 || ry <= 0.0){return out;}let normX =(b.pos.x - u.viewMinX)/ rx;let normY =(b.pos.y - u.viewMinY)/ ry;let clipX = normX * 2.0 - 1.0;let clipY = normY * 2.0 - 1.0;let zoomScale = clamp(pow(1.0 / min(max(rx,1e-5),max(ry,1e-5)),0.5),0.25,12.0);let r = max(3.0,bu.radius * zoomScale);var corners = array<vec2f,6>(vec2f(-r,r),vec2f(r,r),vec2f(-r,-r),vec2f(-r,-r),vec2f(r,r),vec2f(r,-r));let p = corners[vtxInQuad];out.pos = vec4f(clipX + p.x * 2.0 / u.width,clipY + p.y * 2.0 / u.height,0.0,1.0);out.uv = p;out.color = series.color;return out;}@fragment fn fs(in: VertexOutput)-> @location(0)vec4f{let rx = u.viewMaxX - u.viewMinX;let ry = u.viewMaxY - u.viewMinY;let zoomScale = clamp(pow(1.0 / min(max(rx,1e-5),max(ry,1e-5)),0.5),0.25,12.0);let r = max(3.0,bu.radius * zoomScale);let d = length(in.uv);if(d > r){discard;}let alpha = 1.0 - smoothstep(r * 0.85,r,d);let ringT = smoothstep(r * 0.60,r * 0.88,d);let darkCol = in.color.rgb * 0.40;let col = mix(in.color.rgb,darkCol,ringT * 0.55);return vec4f(col,alpha);}`;

// src/charts/boids.ts
var BOID_BYTES = 24;
var boidsAnimMap = new WeakMap;
var BoidsChart = {
  name: "boids",
  shaders: {
    init: BOIDS_INIT_SHADER,
    clear: BOIDS_CLEAR_SHADER,
    insert: BOIDS_INSERT_SHADER,
    sim: BOIDS_SIM_SHADER,
    render: BOIDS_RENDER_SHADER
  },
  uniforms: [{ name: "radius", type: "f32", default: 6 }],
  buffers: [
    {
      name: "boidsState",
      bytes: ({ samples }) => Math.max(16, samples * BOID_BYTES),
      usages: ["STORAGE"]
    },
    {
      name: "gridCount",
      bytes: () => GRID_W * GRID_H * 4,
      usages: ["STORAGE"]
    },
    {
      name: "gridBoids",
      bytes: () => GRID_W * GRID_H * MAX_PER_CELL * 4,
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "init",
      perSeries: true,
      dispatch: ({ samples }) => dispatch2D(samples),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "boidsState", write: true },
        { binding: 4, source: "series-index" },
        { binding: 5, source: "series-info" }
      ]
    },
    {
      type: "compute",
      shader: "clear",
      perSeries: true,
      dispatch: () => ({ x: 1 }),
      bindings: [{ binding: 0, source: "gridCount", write: true }]
    },
    {
      type: "compute",
      shader: "insert",
      perSeries: true,
      dispatch: ({ samples }) => dispatch2D(samples),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "boidsState" },
        { binding: 2, source: "gridCount", write: true },
        { binding: 3, source: "gridBoids", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" }
      ]
    },
    {
      type: "compute",
      shader: "sim",
      perSeries: true,
      dispatch: ({ samples }) => dispatch2D(samples),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "boidsState", write: true },
        { binding: 2, source: "series-index" },
        { binding: 3, source: "gridCount" },
        { binding: 4, source: "gridBoids" },
        { binding: 5, source: "series-info" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      perSeries: true,
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ samples }) => samples * 6,
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "boidsState" },
        { binding: 2, source: "series-info" },
        { binding: 3, source: "series-index" },
        { binding: 4, source: "custom-uniforms" }
      ]
    }
  ],
  computeBounds() {
    return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  },
  install(chart, _el) {
    const tick = () => {
      ChartManager.requestRender(chart.id);
      boidsAnimMap.set(chart, requestAnimationFrame(tick));
    };
    boidsAnimMap.set(chart, requestAnimationFrame(tick));
  },
  uninstall(chart) {
    const id = boidsAnimMap.get(chart);
    if (id != null) {
      cancelAnimationFrame(id);
      boidsAnimMap.delete(chart);
    }
  }
};
// src/shaders/experimental/step.ts
var STEP_RENDER_SHADER = `${UNIFORM_STRUCT}struct LineData{screenX: f32,minScreenY: f32,maxScreenY: f32,valid: f32,};struct StepUniforms{maxSamplesPerPixel: u32,stepMode: u32,_p2: u32,_p3: u32,};@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> lineData: array<LineData>;@group(0)@binding(2)var<storage,read> allSeries: array<SeriesInfo>;@group(0)@binding(3)var<uniform> su: StepUniforms;struct VertexOutput{@builtin(position)pos: vec4f,@location(0)alpha: f32,@location(1)@interpolate(flat)seriesIdx: u32,};@vertex fn vs(@builtin(vertex_index)vi: u32,@builtin(instance_index)series_idx: u32)-> VertexOutput{var out: VertexOutput;out.seriesIdx = series_idx;let maxCols = min(u32(u.width),arrayLength(&lineData));let spanVerts = maxCols * 2u;if(vi < spanVerts){let segIdx = vi / 2u;let endpoint = vi % 2u;let d = lineData[segIdx];let y = select(d.maxScreenY,d.minScreenY,endpoint == 0u);out.pos = vec4f(d.screenX * 2.0 - 1.0,1.0 - y * 2.0,0.0,d.valid);out.alpha = d.valid;}else{let connOffset = vi - spanVerts;let connIdx = connOffset / 4u;let localVert = connOffset % 4u;let segInConn = localVert / 2u;let endpoint = localVert % 2u;if(connIdx + 1u >= maxCols){out.pos = vec4f(0.0,0.0,0.0,0.0);out.alpha = 0.0;return out;}let d0 = lineData[connIdx];let d1 = lineData[connIdx + 1u];let segValid = min(d0.valid,d1.valid);let midY0 =(d0.minScreenY + d0.maxScreenY)* 0.5;let midY1 =(d1.minScreenY + d1.maxScreenY)* 0.5;let midX =(d0.screenX + d1.screenX)* 0.5;var px: f32;var py: f32;if(su.stepMode == 0u){if(segInConn == 0u){px = select(d0.screenX,d1.screenX,endpoint == 1u);py = midY0;}else{px = d1.screenX;py = select(midY0,midY1,endpoint == 1u);}}else if(su.stepMode == 1u){if(segInConn == 0u){px = d0.screenX;py = select(midY0,midY1,endpoint == 1u);}else{px = select(d0.screenX,d1.screenX,endpoint == 1u);py = midY1;}}else{if(segInConn == 0u){px = select(d0.screenX,midX,endpoint == 1u);py = midY0;}else{px = midX;py = select(midY0,midY1,endpoint == 1u);}}out.pos = vec4f(px * 2.0 - 1.0,1.0 - py * 2.0,0.0,segValid);out.alpha = segValid;}return out;}@fragment fn fs(in: VertexOutput)-> @location(0)vec4f{if(in.alpha < 0.1){discard;}let series = allSeries[in.seriesIdx];let dim = select(1.0,0.35,u.highlight != 0xffffffffu && in.seriesIdx != u.highlight);return vec4f(mix(vec3f(u.bgR,u.bgG,u.bgB),series.color.rgb,dim),1.0);}`;

// src/charts/experimental/step.ts
var StepChart = {
  name: "step",
  shaders: {
    compute: LINE_COMPUTE_SHADER,
    render: STEP_RENDER_SHADER
  },
  uniforms: [
    { name: "maxSamplesPerPixel", type: "u32", default: 1e4 },
    { name: "stepMode", type: "u32", default: 0, values: { after: 0, before: 1, center: 2 } }
  ],
  buffers: [
    {
      name: "lineBuffer",
      bytes: ({ width }) => Math.max(16, width * 4 * 4),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "lineBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "custom-uniforms" },
        { binding: 6, source: "series-index" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "line-list",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => Math.max(0, width * 2 + (width - 1) * 4),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "lineBuffer" },
        { binding: 2, source: "series-info" },
        { binding: 3, source: "custom-uniforms" }
      ]
    }
  ]
};
// src/shaders/experimental/histogram.ts
var HIST_UNIFORMS_STRUCT = `struct HistUniforms {
binCount: u32,
minValue: f32,
maxValue: f32,
_p0: f32,
};
fn histRange() -> vec2f {
let custom = hu.minValue < hu.maxValue;
return vec2f(select(u.dataMinX, hu.minValue, custom), select(u.dataMaxX, hu.maxValue, custom));
}
fn histBins() -> u32 {
let n = select(u32(u.width), hu.binCount, hu.binCount > 0u);
return clamp(n, 1u, 4096u);
}
`;
var HIST_CLEAR_SHADER = `${UNIFORM_STRUCT}${HIST_UNIFORMS_STRUCT}@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read_write> histBuffer: array<u32>;@group(0)@binding(2)var<uniform> hu: HistUniforms;@compute @workgroup_size(${COMPUTE_WG})fn main(@builtin(global_invocation_id)id: vec3u){let idx = id.x;if(idx < 4096u){histBuffer[idx] = 0u;}}`;
var HIST_COUNT_SHADER = `${UNIFORM_STRUCT}${HIST_UNIFORMS_STRUCT}@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> dataX: array<f32>;@group(0)@binding(2)var<storage,read_write> histBuffer: array<atomic<u32>>;@group(0)@binding(3)var<uniform> hu: HistUniforms;@group(0)@binding(4)var<storage,read> allSeries: array<SeriesInfo>;@group(0)@binding(5)var<uniform> seriesIdx: SeriesIndex;@compute @workgroup_size(${COMPUTE_WG})fn main(@builtin(global_invocation_id)id: vec3u,@builtin(num_workgroups)nwg: vec3u){let range = allSeries[seriesIdx.index].visibleRange;let i = ${SAMPLE_INDEX};if(i >= range.y){return;}let x = dataX[range.x + i];let bounds = histRange();let minVal = bounds.x;let maxVal = bounds.y;let span = maxVal - minVal;if(x < -1.0e38 || span <= 0.0 || x < minVal || x > maxVal){return;}let binCount = histBins();let bin = min(u32((x - minVal)/ span * f32(binCount)),binCount - 1u);atomicAdd(&histBuffer[bin],1u);}`;
var HIST_FIND_MAX_SHADER = `${UNIFORM_STRUCT}${HIST_UNIFORMS_STRUCT}@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> histBuffer: array<u32>;@group(0)@binding(2)var<storage,read_write> maxBuffer: array<u32>;@group(0)@binding(3)var<uniform> hu: HistUniforms;@compute @workgroup_size(1)fn main(){let binCount = histBins();var maxVal = 0u;for(var i = 0u;i < binCount;i++){let v = histBuffer[i];if(v > maxVal){maxVal = v;}}maxBuffer[0] = maxVal;}`;
var HIST_RENDER_SHADER = `${UNIFORM_STRUCT}${HIST_UNIFORMS_STRUCT}@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> histBuffer: array<u32>;@group(0)@binding(2)var<storage,read> maxBuffer: array<u32>;@group(0)@binding(3)var<storage,read> allSeries: array<SeriesInfo>;@group(0)@binding(4)var<uniform> si: SeriesIndex;@group(0)@binding(5)var<uniform> hu: HistUniforms;struct VertexOutput{@builtin(position)pos: vec4f,@location(0)alpha: f32,@location(1)@interpolate(flat)seriesIdx: u32,};@vertex fn vs(@builtin(vertex_index)vi: u32)-> VertexOutput{var out: VertexOutput;out.seriesIdx = si.index;let colIdx = vi / 6u;let vertexType = vi % 6u;let binCount = histBins();let maxCount = maxBuffer[0];if(colIdx >= binCount || maxCount == 0u){out.pos = vec4f(0.0,0.0,0.0,0.0);out.alpha = 0.0;return out;}let count = histBuffer[colIdx];if(count == 0u){out.pos = vec4f(0.0,0.0,0.0,0.0);out.alpha = 0.0;return out;}let bounds = histRange();let minVal = bounds.x;let range = bounds.y - bounds.x;let viewRangeX = u.viewMaxX - u.viewMinX;let viewRangeY = u.viewMaxY - u.viewMinY;let safeRangeX = select(viewRangeX,1.0,viewRangeX <= 0.0);let safeRangeY = select(viewRangeY,1.0,viewRangeY <= 0.0);let binLeft = minVal + f32(colIdx)/ f32(binCount)* range;let binRight = minVal + f32(colIdx + 1u)/ f32(binCount)* range;let screenLeft =(binLeft - u.viewMinX)/ safeRangeX;let screenRight =(binRight - u.viewMinX)/ safeRangeX;let screenBottom = 1.0 -(0.0 - u.viewMinY)/ safeRangeY;let screenTop = 1.0 -(f32(count)- u.viewMinY)/ safeRangeY;var positions = array<vec2f,6>(vec2f(screenLeft,screenBottom),vec2f(screenRight,screenBottom),vec2f(screenLeft,screenTop),vec2f(screenLeft,screenTop),vec2f(screenRight,screenBottom),vec2f(screenRight,screenTop));let screenPos = positions[vertexType];out.pos = vec4f(screenPos.x * 2.0 - 1.0,1.0 - screenPos.y * 2.0,0.0,1.0);out.alpha = 1.0;return out;}@fragment fn fs(in: VertexOutput)-> @location(0)vec4f{if(in.alpha < 0.1){discard;}let series = allSeries[in.seriesIdx];return vec4f(series.color.rgb,0.85);}`;

// src/charts/experimental/histogram.ts
var MAX_BINS = 4096;
function histogramBins(chart) {
  const set = (chart?.config.binCount ?? 0) >>> 0;
  if (set > 0)
    return Math.min(MAX_BINS, set);
  if (!chart)
    return 512;
  const dpr = chart.dpr || globalThis.devicePixelRatio || 1;
  return Math.max(1, Math.min(MAX_BINS, Math.round(chart.width * dpr)));
}
var HistogramChart = {
  name: "histogram",
  shaders: {
    clear: HIST_CLEAR_SHADER,
    count: HIST_COUNT_SHADER,
    findMax: HIST_FIND_MAX_SHADER,
    render: HIST_RENDER_SHADER
  },
  uniforms: [
    { name: "binCount", type: "u32", default: 0 },
    { name: "minValue", type: "f32", default: 0, xPosition: true },
    { name: "maxValue", type: "f32", default: 0, xPosition: true }
  ],
  buffers: [
    {
      name: "histBuffer",
      bytes: () => MAX_BINS * 4,
      usages: ["STORAGE"]
    },
    {
      name: "maxBuffer",
      bytes: () => 4,
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "clear",
      perSeries: true,
      dispatch: () => ({ x: Math.ceil(MAX_BINS / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "histBuffer", write: true },
        { binding: 2, source: "custom-uniforms" }
      ]
    },
    {
      type: "compute",
      shader: "count",
      perSeries: true,
      dispatch: ({ samples }) => dispatch2D(samples),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "histBuffer", write: true },
        { binding: 3, source: "custom-uniforms" },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" }
      ]
    },
    {
      type: "compute",
      shader: "findMax",
      perSeries: true,
      dispatch: () => ({ x: 1 }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "histBuffer" },
        { binding: 2, source: "maxBuffer", write: true },
        { binding: 3, source: "custom-uniforms" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      perSeries: true,
      draw: () => MAX_BINS * 6,
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "histBuffer" },
        { binding: 2, source: "maxBuffer" },
        { binding: 3, source: "series-info" },
        { binding: 4, source: "series-index" },
        { binding: 5, source: "custom-uniforms" }
      ]
    }
  ],
  sortX: false,
  boundsDependOnSize: true,
  computeBounds(series, chart) {
    const cfg = chart?.config ?? {};
    const custom = typeof cfg.minValue === "number" && typeof cfg.maxValue === "number" && cfg.minValue < cfg.maxValue;
    let lo = Infinity;
    let hi = -Infinity;
    if (custom) {
      lo = cfg.minValue;
      hi = cfg.maxValue;
    } else {
      for (const s of series) {
        for (const x of s.rawX) {
          if (x == null || x !== x)
            continue;
          if (x < lo)
            lo = x;
          if (x > hi)
            hi = x;
        }
      }
    }
    if (!isFinite(lo) || !isFinite(hi))
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    if (!(hi > lo)) {
      lo -= 0.5;
      hi += 0.5;
    }
    const db = custom ? undefined : cfg.defaultBounds;
    const binLo = db?.minX ?? lo;
    const binHi = db?.maxX ?? hi;
    const bins = histogramBins(chart);
    const counts = new Uint32Array(bins);
    const span = binHi - binLo;
    if (span > 0) {
      for (const s of series) {
        for (const x of s.rawX) {
          if (x == null || !(x >= binLo && x <= binHi))
            continue;
          counts[Math.min(bins - 1, Math.floor((x - binLo) / span * bins))]++;
        }
      }
    }
    let maxCount = 0;
    for (let i = 0;i < bins; i++)
      if (counts[i] > maxCount)
        maxCount = counts[i];
    return { minX: lo, maxX: hi, minY: 0, maxY: Math.max(1, Math.ceil(maxCount * 1.1)) };
  }
};
// src/shaders/experimental/heatmap.ts
var HEATMAP_RENDER_SHADER = `${UNIFORM_STRUCT}struct HeatmapUniforms{gridColumns: u32,gridRows: u32,colorScale: u32,_p0: u32,};@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> dataX: array<f32>;@group(0)@binding(2)var<storage,read> dataY: array<f32>;@group(0)@binding(3)var<storage,read> allSeries: array<SeriesInfo>;@group(0)@binding(4)var<uniform> seriesIdx: SeriesIndex;@group(0)@binding(5)var<uniform> hu: HeatmapUniforms;@group(0)@binding(6)var<storage,read> dataValue: array<f32>;fn viridis(t: f32)-> vec3f{let c0 = vec3f(0.267,0.005,0.329);let c1 = vec3f(0.229,0.322,0.545);let c2 = vec3f(0.128,0.566,0.551);let c3 = vec3f(0.370,0.789,0.383);let c4 = vec3f(0.993,0.906,0.144);let s = clamp(t,0.0,1.0)* 4.0;let i = u32(s);let f = s - f32(i);if(i == 0u){return mix(c0,c1,f);}if(i == 1u){return mix(c1,c2,f);}if(i == 2u){return mix(c2,c3,f);}return mix(c3,c4,clamp(f,0.0,1.0));}fn plasma(t: f32)-> vec3f{let c0 = vec3f(0.050,0.030,0.528);let c1 = vec3f(0.558,0.003,0.667);let c2 = vec3f(0.879,0.176,0.334);let c3 = vec3f(0.980,0.534,0.125);let c4 = vec3f(0.940,0.975,0.131);let s = clamp(t,0.0,1.0)* 4.0;let i = u32(s);let f = s - f32(i);if(i == 0u){return mix(c0,c1,f);}if(i == 1u){return mix(c1,c2,f);}if(i == 2u){return mix(c2,c3,f);}return mix(c3,c4,clamp(f,0.0,1.0));}fn applyColorScale(t: f32,scale: u32)-> vec3f{let tc = clamp(t,0.0,1.0);if(scale == 1u){return plasma(tc);}if(scale == 2u){return mix(vec3f(0.0,1.0,1.0),vec3f(1.0,0.0,1.0),tc);}if(scale == 3u){return mix(vec3f(1.0,1.0,0.0),vec3f(1.0,0.0,0.0),tc);}return viridis(tc);}struct VertexOutput{@builtin(position)pos: vec4f,@location(0)@interpolate(flat)color: vec3f,};@vertex fn vs(@builtin(vertex_index)vi: u32)-> VertexOutput{var out: VertexOutput;out.pos = vec4f(0.0,0.0,0.0,0.0);out.color = vec3f(0.0);let range = allSeries[seriesIdx.index].visibleRange;let cell = vi / 6u;if(cell >= range.y){return out;}let idx = range.x + cell;let col = dataX[idx];let row = dataY[idx];let t = dataValue[idx];if(abs(col)> 1.0e38 || row < -1.0e38 || t < -1.0e38){return out;}let rangeX = u.viewMaxX - u.viewMinX;let rangeY = u.viewMaxY - u.viewMinY;if(rangeX <= 0.0 || rangeY <= 0.0){return out;}var corners = array<vec2f,6>(vec2f(-0.5,-0.5),vec2f(0.5,-0.5),vec2f(-0.5,0.5),vec2f(-0.5,0.5),vec2f(0.5,-0.5),vec2f(0.5,0.5));let c = corners[vi % 6u];let normX =(col + c.x - u.viewMinX)/ rangeX;let normY =(row + c.y - u.viewMinY)/ rangeY;out.pos = vec4f(normX * 2.0 - 1.0,normY * 2.0 - 1.0,0.0,1.0);out.color = applyColorScale(t,hu.colorScale);return out;}@fragment fn fs(in: VertexOutput)-> @location(0)vec4f{return vec4f(in.color,1.0);}`;

// src/charts/experimental/heatmap.ts
var HeatmapChart = {
  name: "heatmap",
  shaders: {
    render: HEATMAP_RENDER_SHADER
  },
  uniforms: [
    { name: "gridColumns", type: "u32", default: 1 },
    { name: "gridRows", type: "u32", default: 1 },
    { name: "colorScale", type: "u32", default: 0, values: { viridis: 0, plasma: 1, cool: 2, warm: 3 } }
  ],
  passes: [
    {
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      perSeries: true,
      draw: ({ samples }) => Math.max(0, samples * 6),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "series-info" },
        { binding: 4, source: "series-index" },
        { binding: 5, source: "custom-uniforms" },
        { binding: 6, source: "value-data" }
      ]
    }
  ],
  computeBounds(series) {
    let maxCol = 0;
    let maxRow = 0;
    for (const s of series) {
      for (const x of s.rawX)
        if (x > maxCol)
          maxCol = x;
      for (const y of s.rawY)
        if (y > maxRow)
          maxRow = y;
    }
    return { minX: -0.5, maxX: maxCol + 0.5, minY: -0.5, maxY: maxRow + 0.5 };
  }
};
// src/shaders/experimental/bubble.ts
var BUBBLE_COMPUTE_SHADER = `${UNIFORM_STRUCT}struct BubbleUniforms{maxPointSize: f32,minPointSize: f32,_p0: f32,_p1: f32,};@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> dataX: array<f32>;@group(0)@binding(2)var<storage,read> dataY: array<f32>;@group(0)@binding(3)var outputTex: texture_storage_2d<rgba8unorm,write>;@group(0)@binding(4)var<storage,read> allSeries: array<SeriesInfo>;@group(0)@binding(5)var<uniform> seriesIdx: SeriesIndex;@group(0)@binding(6)var<uniform> bu: BubbleUniforms;@group(0)@binding(7)var<storage,read> dataR: array<f32>;@compute @workgroup_size(${COMPUTE_WG})fn main(@builtin(global_invocation_id)id: vec3u,@builtin(num_workgroups)nwg: vec3u){let series = allSeries[seriesIdx.index];let visStart = series.visibleRange.x;let visCount = series.visibleRange.y;let localIdx = ${SAMPLE_INDEX};if(localIdx >= visCount){return;}let idx = visStart + localIdx;let x = dataX[idx];let y = dataY[idx];let r = dataR[idx];if(abs(x)> 1.0e38 || y < -1.0e38 || !(r > 0.0)){return;}let rangeX = u.viewMaxX - u.viewMinX;let rangeY = u.viewMaxY - u.viewMinY;if(rangeX <= 0.0 || rangeY <= 0.0){return;}let normX =(x - u.viewMinX)/ rangeX;let normY =(y - u.viewMinY)/ rangeY;let centerX = normX * u.width;let centerY =(1.0 - normY)* u.height;let minDim = min(u.width,u.height);let maxRange = max(rangeX,rangeY);let rawRadius = r * minDim / maxRange;let radius = i32(clamp(rawRadius,bu.minPointSize,bu.maxPointSize));let fr = f32(radius)+ 1.0;if(centerX < -fr || centerX > u.width + fr || centerY < -fr || centerY > u.height + fr){return;}let pixelX = i32(centerX);let pixelY = i32(centerY);let iWidth = i32(u.width);let iHeight = i32(u.height);let borderR: f32 = max(1.0,f32(radius)* 0.08);let innerR = f32(radius)- borderR;let border = vec4f(series.color.rgb * 0.5 * 0.95,0.95);let fill = vec4f(series.color.rgb * 0.65,0.65);let dy0 = max(-radius,-pixelY);let dy1 = min(radius,iHeight - 1 - pixelY);for(var dy = dy0;dy <= dy1;dy++){let span = i32(sqrt(f32(radius * radius - dy * dy)));let dx0 = max(-span,-pixelX);let dx1 = min(span,iWidth - 1 - pixelX);for(var dx = dx0;dx <= dx1;dx++){let dist2 = f32(dx * dx + dy * dy);textureStore(outputTex,vec2i(pixelX + dx,pixelY + dy),select(fill,border,dist2 > innerR * innerR));}}}`;

// src/charts/experimental/bubble.ts
var BubbleChart = {
  name: "bubble",
  shaders: {
    compute: BUBBLE_COMPUTE_SHADER
  },
  uniforms: [
    { name: "maxPointSize", type: "f32", default: 40 },
    { name: "minPointSize", type: "f32", default: 2 }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ samples }) => dispatch2D(samples),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "render-target", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" },
        { binding: 6, source: "custom-uniforms" },
        { binding: 7, source: "r-data" }
      ]
    }
  ]
};
// src/shaders/experimental/baseline-area.ts
var BASELINE_AREA_RENDER_SHADER = `${UNIFORM_STRUCT}struct LineData{screenX: f32,minScreenY: f32,maxScreenY: f32,valid: f32,};struct BaselineAreaUniforms{maxSamplesPerPixel: u32,baseline: f32,positiveColor: u32,negativeColor: u32,};@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> lineData: array<LineData>;@group(0)@binding(2)var<storage,read> allSeries: array<SeriesInfo>;@group(0)@binding(3)var<uniform> bau: BaselineAreaUniforms;struct VertexOutput{@builtin(position)pos: vec4f,@location(0)@interpolate(flat)seriesIdx: u32,@location(1)@interpolate(flat)valid: f32,@location(2)lineNormY: f32,@location(3)baselineNormY: f32,};@vertex fn vs(@builtin(vertex_index)vi: u32,@builtin(instance_index)series_idx: u32)-> VertexOutput{var out: VertexOutput;out.seriesIdx = series_idx;out.valid = 0.0;out.lineNormY = 0.0;out.baselineNormY = 0.0;let maxCols = min(u32(u.width),arrayLength(&lineData));if(vi >= maxCols * 2u){out.pos = vec4f(0.0,0.0,0.0,0.0);return out;}let col = vi / 2u;let onLine =(vi % 2u)== 0u;let d = lineData[col];let viewRangeY = u.viewMaxY - u.viewMinY;let normBaseline = select(0.0,(bau.baseline - u.viewMinY)/ viewRangeY,viewRangeY > 0.0);let baselineScreenY = 1.0 - normBaseline;var sx = d.screenX;let midScreenY =(d.minScreenY + d.maxScreenY)* 0.5;let lineNormY = 1.0 - midScreenY;var py = select(baselineScreenY,midScreenY,onLine);if(d.valid < 0.5 && vi > 0u){let prevCol =(vi - 1u)/ 2u;let pd = lineData[prevCol];sx = pd.screenX;let prevMidScreenY =(pd.minScreenY + pd.maxScreenY)* 0.5;py = select(baselineScreenY,prevMidScreenY,(vi - 1u)% 2u == 0u);}let clipX = sx * 2.0 - 1.0;let clipY = 1.0 - py * 2.0;out.valid = d.valid;out.lineNormY = lineNormY;out.baselineNormY = normBaseline;out.pos = vec4f(clipX,clipY,0.0,1.0);return out;}@fragment fn fs(in: VertexOutput)-> @location(0)vec4f{if(in.valid < 0.5){discard;}let packedColor = select(bau.negativeColor,bau.positiveColor,in.lineNormY > in.baselineNormY);let color = unpack4x8unorm(packedColor);return vec4f(color.rgb,0.8);}`;

// src/charts/experimental/baseline-area.ts
var packRGB2 = (r, g, b) => (Math.round(r * 255) & 255 | (Math.round(g * 255) & 255) << 8 | (Math.round(b * 255) & 255) << 16 | 255 << 24) >>> 0;
var BaselineAreaChart = {
  name: "baseline-area",
  shaders: {
    compute: LINE_COMPUTE_SHADER,
    render: BASELINE_AREA_RENDER_SHADER
  },
  uniforms: [
    { name: "maxSamplesPerPixel", type: "u32", default: 1e4 },
    { name: "baseline", type: "f32", default: 0 },
    { name: "positiveColor", type: "u32", default: packRGB2(0.2, 0.7, 0.4) },
    { name: "negativeColor", type: "u32", default: packRGB2(0.9, 0.3, 0.25) }
  ],
  buffers: [
    {
      name: "lineBuffer",
      bytes: ({ width }) => Math.max(16, width * 4 * 4),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "lineBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "custom-uniforms" },
        { binding: 6, source: "series-index" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-strip",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => Math.max(0, width * 2),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "lineBuffer" },
        { binding: 2, source: "series-info" },
        { binding: 3, source: "custom-uniforms" }
      ]
    }
  ]
};
// src/shaders/experimental/error-band.ts
var ERROR_BAND_COMPUTE_SHADER = `${UNIFORM_STRUCT}struct ErrorBandUniforms{maxSamplesPerPixel: u32,bandOpacity: f32,_p0: u32,_p1: u32,};struct BandData{screenX: f32,loScreenY: f32,hiScreenY: f32,centerScreenY: f32,valid: f32,};@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> dataX: array<f32>;@group(0)@binding(2)var<storage,read> dataY: array<f32>;@group(0)@binding(3)var<storage,read_write> bandData: array<BandData>;@group(0)@binding(4)var<storage,read> allSeries: array<SeriesInfo>;@group(0)@binding(5)var<uniform> eu: ErrorBandUniforms;@group(0)@binding(6)var<storage,read> loData: array<f32>;@group(0)@binding(7)var<storage,read> hiData: array<f32>;@group(0)@binding(8)var<uniform> seriesIdx: SeriesIndex;${BINARY_SEARCH}fn bandAt(i: u32,y: f32)-> vec2f{var lo = loData[i];var hi = hiData[i];if(lo < -1.0e38){lo = y;}if(hi < -1.0e38){hi = y;}return vec2f(min(lo,hi),max(lo,hi));}@compute @workgroup_size(${COMPUTE_WG})fn main(@builtin(global_invocation_id)id: vec3u){let outputIdx = id.x;let maxCols = min(u32(u.width),arrayLength(&bandData));if(outputIdx >= maxCols){return;}let range = allSeries[seriesIdx.index].visibleRange;let seriesStart = range.x;let seriesEnd = range.x + range.y;let viewRangeX = u.viewMaxX - u.viewMinX;let viewRangeY = u.viewMaxY - u.viewMinY;if(range.y == 0u || viewRangeX <= 0.0 || viewRangeY <= 0.0){bandData[outputIdx] = BandData(-1.0,-1.0,-1.0,-1.0,0.0);return;}let relPx = f32(outputIdx);let pixelMinX = u.viewMinX +(relPx / u.width)* viewRangeX;let pixelMaxX = u.viewMinX +((relPx + 1.0)/ u.width)* viewRangeX;let firstX = dataX[seriesStart];let lastX = dataX[seriesEnd - 1u];if((firstX > -1.0e38 && pixelMaxX < firstX)||(lastX > -1.0e38 && pixelMinX > lastX)){bandData[outputIdx] = BandData(-1.0,-1.0,-1.0,-1.0,0.0);return;}let startIdx = lowerBound(pixelMinX,seriesStart,seriesEnd);let endIdx = lowerBound(pixelMaxX,startIdx,seriesEnd);let centerX =(pixelMinX + pixelMaxX)* 0.5;if(startIdx >= endIdx){var bestIdx = startIdx;if(startIdx > seriesStart && startIdx < seriesEnd){let distPrev = abs(dataX[startIdx - 1u] - centerX);let distCurr = abs(dataX[startIdx] - centerX);if(distPrev < distCurr){bestIdx = startIdx - 1u;}}else if(startIdx >= seriesEnd){bestIdx = seriesEnd - 1u;}if(outputIdx == 0u && startIdx > seriesStart){bestIdx = startIdx - 1u;}if(outputIdx + 1u == maxCols && startIdx < seriesEnd){bestIdx = startIdx;}if(bestIdx >= seriesEnd){bandData[outputIdx] = BandData(-1.0,-1.0,-1.0,-1.0,0.0);return;}let y = dataY[bestIdx];if(y < -1.0e38){bandData[outputIdx] = BandData(-1.0,-1.0,-1.0,-1.0,0.0);return;}let band = bandAt(bestIdx,y);let normX =(dataX[bestIdx] - u.viewMinX)/ viewRangeX;let normY =(y - u.viewMinY)/ viewRangeY;let normLo =(band.x - u.viewMinY)/ viewRangeY;let normHi =(band.y - u.viewMinY)/ viewRangeY;bandData[outputIdx] = BandData(normX,1.0 - normLo,1.0 - normHi,1.0 - normY,1.0);return;}var dataMinY = 3.0e38;var dataMaxY = -3.0e38;var bandMin = 3.0e38;var bandMax = -3.0e38;let rangeCount = endIdx - startIdx;let maxSamples = eu.maxSamplesPerPixel;if(maxSamples > 1u && rangeCount > maxSamples){let stride = f32(rangeCount - 1u)/ f32(maxSamples - 1u);for(var s = 0u;s < maxSamples;s++){let idx = startIdx + u32(f32(s)* stride);if(idx < endIdx){let y = dataY[idx];if(y > -1.0e38){dataMinY = min(dataMinY,y);dataMaxY = max(dataMaxY,y);let band = bandAt(idx,y);bandMin = min(bandMin,band.x);bandMax = max(bandMax,band.y);}}}let lastY = dataY[endIdx - 1u];if(lastY > -1.0e38){dataMinY = min(dataMinY,lastY);dataMaxY = max(dataMaxY,lastY);let band = bandAt(endIdx - 1u,lastY);bandMin = min(bandMin,band.x);bandMax = max(bandMax,band.y);}}else{for(var i = startIdx;i < endIdx;i++){let y = dataY[i];if(y > -1.0e38){dataMinY = min(dataMinY,y);dataMaxY = max(dataMaxY,y);let band = bandAt(i,y);bandMin = min(bandMin,band.x);bandMax = max(bandMax,band.y);}}}if(dataMaxY < dataMinY){bandData[outputIdx] = BandData(-1.0,-1.0,-1.0,-1.0,0.0);return;}let normX =((dataX[startIdx] + dataX[endIdx - 1u])* 0.5 - u.viewMinX)/ viewRangeX;let normMinLo =(bandMin - u.viewMinY)/ viewRangeY;let normMaxHi =(bandMax - u.viewMinY)/ viewRangeY;let normMinY =(dataMinY - u.viewMinY)/ viewRangeY;let normMaxY =(dataMaxY - u.viewMinY)/ viewRangeY;let loScreenY = 1.0 - normMinLo;let hiScreenY = 1.0 - normMaxHi;let centerScreenY = 1.0 -(normMinY + normMaxY)* 0.5;bandData[outputIdx] = BandData(normX,loScreenY,hiScreenY,centerScreenY,1.0);}`;
var ERROR_BAND_FILL_RENDER_SHADER = `${UNIFORM_STRUCT}struct ErrorBandUniforms{maxSamplesPerPixel: u32,bandOpacity: f32,_p0: u32,_p1: u32,};struct BandData{screenX: f32,loScreenY: f32,hiScreenY: f32,centerScreenY: f32,valid: f32,};@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> bandData: array<BandData>;@group(0)@binding(2)var<storage,read> allSeries: array<SeriesInfo>;@group(0)@binding(3)var<uniform> eu: ErrorBandUniforms;struct VertexOutput{@builtin(position)pos: vec4f,@location(0)@interpolate(flat)seriesIdx: u32,@location(1)@interpolate(flat)valid: f32,};@vertex fn vs(@builtin(vertex_index)vi: u32,@builtin(instance_index)series_idx: u32)-> VertexOutput{var out: VertexOutput;out.seriesIdx = series_idx;out.valid = 0.0;let maxCols = min(u32(u.width),arrayLength(&bandData));if(vi >= maxCols * 2u){out.pos = vec4f(0.0,0.0,0.0,0.0);return out;}let col = vi / 2u;let onHi =(vi % 2u)== 0u;let d = bandData[col];var sx = d.screenX;var py = select(d.loScreenY,d.hiScreenY,onHi);if(d.valid < 0.5 && vi > 0u){let prevCol =(vi - 1u)/ 2u;let pd = bandData[prevCol];sx = pd.screenX;py = select(pd.loScreenY,pd.hiScreenY,(vi - 1u)% 2u == 0u);}let clipX = sx * 2.0 - 1.0;let clipY = 1.0 - py * 2.0;out.valid = d.valid;out.pos = vec4f(clipX,clipY,0.0,1.0);return out;}@fragment fn fs(in: VertexOutput)-> @location(0)vec4f{if(in.valid < 0.5){discard;}let series = allSeries[in.seriesIdx];let dim = select(1.0,0.35,u.highlight != 0xffffffffu && in.seriesIdx != u.highlight);return vec4f(mix(vec3f(u.bgR,u.bgG,u.bgB),series.color.rgb,dim),eu.bandOpacity * dim);}`;
var ERROR_BAND_LINE_RENDER_SHADER = `${UNIFORM_STRUCT}struct BandData{screenX: f32,loScreenY: f32,hiScreenY: f32,centerScreenY: f32,valid: f32,};@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> bandData: array<BandData>;@group(0)@binding(2)var<storage,read> allSeries: array<SeriesInfo>;struct VertexOutput{@builtin(position)pos: vec4f,@location(0)alpha: f32,@location(1)@interpolate(flat)seriesIdx: u32,};@vertex fn vs(@builtin(vertex_index)vi: u32,@builtin(instance_index)series_idx: u32)-> VertexOutput{var out: VertexOutput;out.seriesIdx = series_idx;out.alpha = 0.0;let maxCols = min(u32(u.width),arrayLength(&bandData));let segIdx = vi / 2u;let endpoint = vi % 2u;if(segIdx + 1u >= maxCols){out.pos = vec4f(0.0,0.0,0.0,0.0);return out;}let d = bandData[segIdx + endpoint];let d0 = bandData[segIdx];let d1 = bandData[segIdx + 1u];let segValid = min(d0.valid,d1.valid);out.pos = vec4f(d.screenX * 2.0 - 1.0,1.0 - d.centerScreenY * 2.0,0.0,segValid);out.alpha = segValid;return out;}@fragment fn fs(in: VertexOutput)-> @location(0)vec4f{if(in.alpha < 0.1){discard;}let series = allSeries[in.seriesIdx];let dim = select(1.0,0.35,u.highlight != 0xffffffffu && in.seriesIdx != u.highlight);return vec4f(mix(vec3f(u.bgR,u.bgG,u.bgB),series.color.rgb,dim),1.0);}`;

// src/charts/experimental/error-band.ts
var ErrorBandChart = {
  name: "error-band",
  shaders: {
    compute: ERROR_BAND_COMPUTE_SHADER,
    fill: ERROR_BAND_FILL_RENDER_SHADER,
    line: ERROR_BAND_LINE_RENDER_SHADER,
    highlight: ERROR_BAND_HIGHLIGHT_SHADER
  },
  uniforms: [
    { name: "maxSamplesPerPixel", type: "u32", default: 1e4 },
    { name: "bandOpacity", type: "f32", default: 0.25 }
  ],
  buffers: [
    {
      name: "bandBuffer",
      bytes: ({ width }) => Math.max(16, width * 5 * 4),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "bandBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "custom-uniforms" },
        { binding: 6, source: "lo-data" },
        { binding: 7, source: "hi-data" },
        { binding: 8, source: "series-index" }
      ]
    },
    {
      type: "render",
      shader: "fill",
      topology: "triangle-strip",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => Math.max(0, width * 2),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "bandBuffer" },
        { binding: 2, source: "series-info" },
        { binding: 3, source: "custom-uniforms" }
      ]
    },
    {
      type: "render",
      shader: "line",
      topology: "line-list",
      loadOp: "load",
      draw: ({ width }) => Math.max(0, (width - 1) * 2),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "bandBuffer" },
        { binding: 2, source: "series-info" }
      ]
    },
    {
      type: "render",
      shader: "highlight",
      topology: "triangle-list",
      loadOp: "load",
      highlight: true,
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => Math.max(0, (width - 1) * 6),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "bandBuffer" },
        { binding: 2, source: "series-info" }
      ]
    }
  ],
  computeBounds(series) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of series) {
      for (const x of s.rawX) {
        if (x == null || x !== x)
          continue;
        if (x < minX)
          minX = x;
        if (x > maxX)
          maxX = x;
      }
      for (const y of s.extra.hi ?? []) {
        if (y != null && y > maxY)
          maxY = y;
      }
      for (const y of s.extra.lo ?? []) {
        if (y != null && y < minY)
          minY = y;
      }
      for (const y of s.rawY) {
        if (y != null && y < minY)
          minY = y;
        if (y != null && y > maxY)
          maxY = y;
      }
    }
    if (!isFinite(minX))
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    const py = (maxY - minY) * 0.1 || 1;
    return { minX, maxX, minY: minY - py, maxY: maxY + py };
  }
};
// src/shaders/experimental/ohlc.ts
var OHLC_RENDER_SHADER = `${UNIFORM_STRUCT}${CANDLE_TYPES}@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> candleData: array<CandleData>;@group(0)@binding(2)var<uniform> cu: CandleUniforms;${EFFECTIVE_INTERVAL}struct VertexOutput{@builtin(position)pos: vec4f,@location(0)@interpolate(flat)isUp: f32,};@vertex fn vs(@builtin(vertex_index)vi: u32)-> VertexOutput{var out: VertexOutput;let viewRangeX = u.viewMaxX - u.viewMinX;let colIdx = vi / 18u;let localVi = vi % 18u;let section = localVi / 6u;let vertexType = localVi % 6u;if(viewRangeX <= 0.0 || colIdx >= candleBins(effectiveInterval())){out.pos = vec4f(0.0,0.0,0.0,0.0);out.isUp = 0.0;return out;}let cd = candleData[colIdx];if(cd.barWidth <= 0.0){out.pos = vec4f(0.0,0.0,0.0,0.0);out.isUp = 0.0;return out;}out.isUp = cd.isUp;let viewRangeY = u.viewMaxY - u.viewMinY;let safeRangeY = select(viewRangeY,1.0,viewRangeY <= 0.0);let onePixelX = 1.0 / u.width;let onePixelY = 1.0 / u.height;let wickWidth = max(onePixelX,cd.barWidth * 0.07);let tickHalfH = max(onePixelY,wickWidth * u.width / u.height);let openPrice = select(cd.bodyTop,cd.bodyBottom,cd.isUp > 0.5);let closePrice = select(cd.bodyBottom,cd.bodyTop,cd.isUp > 0.5);var sLeft: f32;var sRight: f32;var sTop: f32;var sBottom: f32;if(section == 0u){let nb =(cd.low - u.viewMinY)/ safeRangeY;let nt =(cd.high - u.viewMinY)/ safeRangeY;sBottom = 1.0 - nb;sTop = 1.0 - nt;sLeft = cd.screenX - wickWidth;sRight = cd.screenX + wickWidth;}else if(section == 1u){let ny =(openPrice - u.viewMinY)/ safeRangeY;let sy = 1.0 - ny;sTop = sy - tickHalfH;sBottom = sy + tickHalfH;sLeft = cd.screenX - cd.barWidth * 0.45;sRight = cd.screenX;}else{let ny =(closePrice - u.viewMinY)/ safeRangeY;let sy = 1.0 - ny;sTop = sy - tickHalfH;sBottom = sy + tickHalfH;sLeft = cd.screenX;sRight = cd.screenX + cd.barWidth * 0.45;}var positions = array<vec2f,6>(vec2f(sLeft,sBottom),vec2f(sRight,sBottom),vec2f(sLeft,sTop),vec2f(sLeft,sTop),vec2f(sRight,sBottom),vec2f(sRight,sTop));let sp = positions[vertexType];out.pos = vec4f(sp.x * 2.0 - 1.0,1.0 - sp.y * 2.0,0.0,1.0);return out;}@fragment fn fs(in: VertexOutput)-> @location(0)vec4f{let upRgb = unpack4x8unorm(cu.upColor).rgb;let downRgb = unpack4x8unorm(cu.downColor).rgb;let color = select(downRgb,upRgb,in.isUp > 0.5);return vec4f(color,0.92);}`;

// src/charts/experimental/ohlc.ts
var BYTES_PER_CANDLE2 = 7 * 4;
var OhlcChart = {
  name: "ohlc",
  shaders: {
    compute: CANDLESTICK_COMPUTE_SHADER,
    render: OHLC_RENDER_SHADER
  },
  uniforms: [
    { name: "maxSamples", type: "f32", default: 1e4 },
    { name: "upColor", type: "u32", default: packRGB(0.2, 0.7, 0.3) },
    { name: "downColor", type: "u32", default: packRGB(0.9, 0.3, 0.3) },
    { name: "binSize", type: "u32", default: 8 },
    { name: "interval", type: "f32", default: 0 }
  ],
  buffers: [
    {
      name: "candleBuffer",
      bytes: ({ width }) => Math.max(16, width * BYTES_PER_CANDLE2),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "candleBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" },
        { binding: 6, source: "custom-uniforms" },
        { binding: 7, source: "open-data" },
        { binding: 8, source: "high-data" },
        { binding: 9, source: "low-data" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => width * 18,
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "candleBuffer" },
        { binding: 2, source: "custom-uniforms" }
      ]
    }
  ],
  computeBounds: CandlestickChart.computeBounds
};
// src/shaders/experimental/waterfall.ts
var WATERFALL_TYPES = `
struct WaterfallUniforms {
  upColor:    u32,
  downColor:  u32,
  totalColor: u32,
  _pad:       u32,
};`;
var WATERFALL_RENDER_SHADER = `${UNIFORM_STRUCT}${WATERFALL_TYPES}@group(0)@binding(0)var<uniform> u: Uniforms;@group(0)@binding(1)var<storage,read> dataX: array<f32>;@group(0)@binding(2)var<storage,read> dataY: array<f32>;@group(0)@binding(3)var<uniform> wu: WaterfallUniforms;@group(0)@binding(4)var<storage,read> dataH: array<f32>;@group(0)@binding(5)var<storage,read> dataT: array<f32>;@group(0)@binding(6)var<storage,read> dataBW: array<f32>;@group(0)@binding(7)var<storage,read> allSeries: array<SeriesInfo>;struct VertexOutput{@builtin(position)pos: vec4f,@location(0)@interpolate(flat)colorType: f32,};@vertex fn vs(@builtin(vertex_index)vi: u32,@builtin(instance_index)series_idx: u32)-> VertexOutput{var out: VertexOutput;let range = allSeries[series_idx].visibleRange;let bar = vi / 6u;let vertexType = vi % 6u;if(bar >= range.y){out.pos = vec4f(0.0,0.0,0.0,1.0);out.colorType = 0.0;return out;}let barIdx = range.x + bar;let x = dataX[barIdx];let barBottom = dataY[barIdx];let barHeight = max(dataH[barIdx],0.0);let barTop = barBottom + barHeight;let barWidth = dataBW[barIdx];if(abs(x)> 1.0e38 || barBottom < -1.0e38 || barWidth < -1.0e38){out.pos = vec4f(0.0,0.0,0.0,1.0);out.colorType = 0.0;return out;}let viewRangeX = u.viewMaxX - u.viewMinX;let viewRangeY = u.viewMaxY - u.viewMinY;let safeRangeX = select(viewRangeX,1.0,viewRangeX <= 0.0);let safeRangeY = select(viewRangeY,1.0,viewRangeY <= 0.0);let screenX =(x - u.viewMinX)/ safeRangeX;let halfW =(barWidth * 0.5)/ safeRangeX;let left = screenX - halfW;let right = screenX + halfW;let normBottom =(barBottom - u.viewMinY)/ safeRangeY;let normTop =(barTop - u.viewMinY)/ safeRangeY;let sBottom = max(1.0 - normBottom,1.0 - normTop);let sTop = min(1.0 - normBottom,1.0 - normTop);var positions = array<vec2f,6>(vec2f(left,sBottom),vec2f(right,sBottom),vec2f(left,sTop),vec2f(left,sTop),vec2f(right,sBottom),vec2f(right,sTop));let sp = positions[vertexType];out.pos = vec4f(sp.x * 2.0 - 1.0,1.0 - sp.y * 2.0,0.0,1.0);out.colorType = dataT[barIdx];return out;}@fragment fn fs(in: VertexOutput)-> @location(0)vec4f{let upRgb = unpack4x8unorm(wu.upColor).rgb;let downRgb = unpack4x8unorm(wu.downColor).rgb;let totalRgb = unpack4x8unorm(wu.totalColor).rgb;var color: vec3f;if(in.colorType < 0.5){color = upRgb;}else if(in.colorType < 1.5){color = downRgb;}else{color = totalRgb;}return vec4f(color,0.9);}`;

// src/charts/experimental/waterfall.ts
function prepareWaterfall(positions, deltas, totals) {
  const n = deltas.length;
  const y = new Array(n);
  const h = new Array(n);
  const t = new Array(n);
  const bw = new Array(n);
  let running = 0;
  for (let i = 0;i < n; i++) {
    const isTotal = (totals?.[i] ?? 0) > 0.5;
    const delta = deltas[i];
    if (isTotal) {
      y[i] = Math.min(0, running);
      h[i] = Math.abs(running);
      t[i] = 2;
    } else {
      if (delta >= 0) {
        y[i] = running;
        h[i] = delta;
        t[i] = 0;
      } else {
        y[i] = running + delta;
        h[i] = Math.abs(delta);
        t[i] = 1;
      }
      running += delta;
    }
  }
  for (let i = 0;i < n; i++) {
    let spacing;
    if (n <= 1) {
      spacing = 1;
    } else if (i === 0) {
      spacing = positions[1] - positions[0];
    } else if (i === n - 1) {
      spacing = positions[n - 1] - positions[n - 2];
    } else {
      spacing = Math.min(positions[i + 1] - positions[i], positions[i] - positions[i - 1]);
    }
    bw[i] = spacing * 0.8;
  }
  return { x: positions, y, h, t, bw };
}
var WaterfallChart = {
  name: "waterfall",
  shaders: { render: WATERFALL_RENDER_SHADER },
  uniforms: [
    { name: "upColor", type: "u32", default: packRGB(0.2, 0.7, 0.3) },
    { name: "downColor", type: "u32", default: packRGB(0.9, 0.3, 0.3) },
    { name: "totalColor", type: "u32", default: packRGB(0.5, 0.5, 0.6) }
  ],
  passes: [
    {
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      perSeries: true,
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ samples }) => Math.max(0, samples * 6),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "custom-uniforms" },
        { binding: 4, source: "h-data" },
        { binding: 5, source: "t-data" },
        { binding: 6, source: "bw-data" },
        { binding: 7, source: "series-info" }
      ]
    }
  ],
  computeBounds(series) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of series) {
      for (let i = 0;i < s.rawX.length; i++) {
        const x = s.rawX[i];
        const barBottom = s.rawY[i];
        if (x == null || barBottom == null || x !== x || barBottom !== barBottom)
          continue;
        const barHeight = s.extra["h"]?.[i] || 0;
        const barTop = barBottom + Math.max(0, barHeight);
        if (x < minX)
          minX = x;
        if (x > maxX)
          maxX = x;
        if (barBottom < minY)
          minY = barBottom;
        if (barTop > maxY)
          maxY = barTop;
      }
    }
    if (!isFinite(minX))
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    const px = (maxX - minX) * 0.05 || 1;
    const py = (maxY - minY) * 0.1 || 0.1;
    return { minX: minX - px, maxX: maxX + px, minY: minY - py, maxY: maxY + py };
  }
};
// src/plugins/experimental/annotations.ts
var DEFAULT_COLOR = "rgba(100,100,200,0.8)";
var PILL_HEIGHT = 18;
var PILL_PADDING = 12;
var LANE_GAP = 3;
function pillWidth(ctx, txt, fontFamily) {
  ctx.font = `600 10px ${fontFamily}`;
  return ctx.measureText(txt).width + PILL_PADDING;
}
function drawPill(ctx, txt, cx, cy, color, dark, fontFamily) {
  const pw = pillWidth(ctx, txt, fontFamily);
  const ph = PILL_HEIGHT;
  const px = cx - pw / 2;
  const py = cy - ph / 2;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 4);
  ctx.fillStyle = dark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(txt, cx, cy);
  return { x: px, y: py, w: pw, h: ph };
}
var pillBoxes = new WeakMap;
var pointerStates = new WeakMap;
function pillAt(chart, x, y) {
  const boxes = pillBoxes.get(chart);
  if (!boxes)
    return null;
  for (let i = boxes.length - 1;i >= 0; i--) {
    const b = boxes[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)
      return b.ann;
  }
  return null;
}
function assignLanes(items) {
  items.sort((a, b) => a.cx - b.cx);
  const laneEnd = [];
  for (const it of items) {
    const left = it.cx - it.pw / 2;
    let lane = 0;
    while (lane < laneEnd.length && left < laneEnd[lane] + 4)
      lane++;
    laneEnd[lane] = it.cx + it.pw / 2;
    it.lane = lane;
  }
}
var annotationsPlugin = {
  name: "annotations",
  install(chart, el) {
    const ac = new AbortController;
    const st = { abort: ac, downX: 0, downY: 0 };
    pointerStates.set(chart, st);
    const host = chart.el;
    const local = (e) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    host.addEventListener("pointerdown", (e) => {
      st.downX = e.clientX;
      st.downY = e.clientY;
    }, { signal: ac.signal });
    host.addEventListener("pointermove", (e) => {
      if (chart.dragging)
        return;
      const { x, y } = local(e);
      if (pillAt(chart, x, y) && el.style.cursor !== "pointer")
        el.style.cursor = "pointer";
    }, { signal: ac.signal });
    host.addEventListener("click", (e) => {
      if (Math.hypot(e.clientX - st.downX, e.clientY - st.downY) > 4)
        return;
      const t = e.target;
      if (!(t instanceof HTMLCanvasElement) || t.parentElement !== el)
        return;
      const { x, y } = local(e);
      const ann = pillAt(chart, x, y);
      if (!ann)
        return;
      e.stopPropagation();
      chart.config.onAnnotationClick?.(ann);
      host.dispatchEvent(new CustomEvent("chartai-annotation-click", {
        detail: { id: ann.id ?? null, annotation: ann },
        bubbles: true,
        composed: true
      }));
    }, { capture: true, signal: ac.signal });
  },
  uninstall(chart) {
    pointerStates.get(chart)?.abort.abort();
    pointerStates.delete(chart);
    pillBoxes.delete(chart);
  },
  beforeDraw(ctx, chart) {
    const annotations = chart.config.annotations ?? [];
    const { width: w, height: h } = chart;
    const m = chartMargin(chart);
    const dark = ChartManager.isDark;
    const fontFamily = chart.config.fontFamily ?? DEFAULT_FONT;
    const regions = annotations.filter((a) => a.type === "hregion" || a.type === "vregion");
    if (regions.length === 0)
      return;
    ctx.save();
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.left, m.top, w - m.left - m.right, h - m.top - m.bottom);
    ctx.clip();
    for (const ann of regions) {
      const color = ann.color ?? (dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)");
      const { y: sy1 } = dataToScreen(0, ann.value, chart, w, h);
      const { x: sx1 } = dataToScreen(ann.value, 0, chart, w, h);
      const v2 = ann.value2 ?? ann.value;
      const { y: sy2 } = dataToScreen(0, v2, chart, w, h);
      const { x: sx2 } = dataToScreen(v2, 0, chart, w, h);
      ctx.fillStyle = color;
      if (ann.type === "hregion") {
        const top = Math.min(sy1, sy2);
        const bottom = Math.max(sy1, sy2);
        ctx.fillRect(m.left, top, w - m.left - m.right, bottom - top);
      } else {
        const left = Math.min(sx1, sx2);
        const right = Math.max(sx1, sx2);
        ctx.fillRect(left, m.top, right - left, h - m.top - m.bottom);
      }
    }
    ctx.restore();
    for (const ann of regions) {
      if (!ann.label)
        continue;
      const color = ann.color ?? (dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)");
      const { y: sy1 } = dataToScreen(0, ann.value, chart, w, h);
      const { x: sx1 } = dataToScreen(ann.value, 0, chart, w, h);
      const v2 = ann.value2 ?? ann.value;
      const { y: sy2 } = dataToScreen(0, v2, chart, w, h);
      const { x: sx2 } = dataToScreen(v2, 0, chart, w, h);
      if (ann.type === "hregion") {
        const cy = (sy1 + sy2) / 2;
        if (cy < m.top - 9 || cy > h - m.bottom + 9)
          continue;
        const pw = pillWidth(ctx, ann.label, fontFamily);
        const cx = w - m.right - pw / 2 - 4;
        drawPill(ctx, ann.label, cx, cy, color, dark, fontFamily);
      } else {
        const pw = pillWidth(ctx, ann.label, fontFamily);
        const cx = (sx1 + sx2) / 2;
        if (cx < m.left - (pw / 2 + 2) || cx > w - m.right + (pw / 2 + 2))
          continue;
        const cy = h - m.bottom / 2;
        drawPill(ctx, ann.label, cx, cy, color, dark, fontFamily);
      }
    }
    ctx.restore();
  },
  afterDraw(ctx, chart) {
    const annotations = chart.config.annotations ?? [];
    const { width: w, height: h } = chart;
    const m = chartMargin(chart);
    const dark = ChartManager.isDark;
    const fontFamily = chart.config.fontFamily ?? DEFAULT_FONT;
    const lines = annotations.filter((a) => a.type === "hline" || a.type === "vline");
    const boxes = [];
    pillBoxes.set(chart, boxes);
    if (lines.length === 0)
      return;
    ctx.save();
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.left, m.top, w - m.left - m.right, h - m.top - m.bottom);
    ctx.clip();
    for (const ann of lines) {
      const color = ann.color ?? DEFAULT_COLOR;
      ctx.strokeStyle = color;
      ctx.lineWidth = ann.lineWidth ?? 1.5;
      ctx.setLineDash(ann.dash ?? []);
      ctx.beginPath();
      if (ann.type === "hline") {
        const { y: sy } = dataToScreen(0, ann.value, chart, w, h);
        ctx.moveTo(m.left, sy);
        ctx.lineTo(w - m.right, sy);
      } else {
        const { x: sx } = dataToScreen(ann.value, 0, chart, w, h);
        ctx.moveTo(sx, m.top);
        ctx.lineTo(sx, h - m.bottom);
      }
      ctx.stroke();
    }
    ctx.restore();
    const vlabels = [];
    for (const ann of lines) {
      if (!ann.label)
        continue;
      const color = ann.color ?? DEFAULT_COLOR;
      if (ann.type === "hline") {
        const { y: sy } = dataToScreen(0, ann.value, chart, w, h);
        if (sy < m.top - 9 || sy > h - m.bottom + 9)
          continue;
        const pw = pillWidth(ctx, ann.label, fontFamily);
        const cx = w - m.right - pw / 2 - 4;
        boxes.push({ ...drawPill(ctx, ann.label, cx, sy, color, dark, fontFamily), ann });
      } else {
        const { x: sx } = dataToScreen(ann.value, 0, chart, w, h);
        const pw = pillWidth(ctx, ann.label, fontFamily);
        if (sx < m.left - (pw / 2 + 2) || sx > w - m.right + (pw / 2 + 2))
          continue;
        vlabels.push({ ann, cx: sx, pw, color, lane: 0 });
      }
    }
    assignLanes(vlabels);
    for (const it of vlabels) {
      const step = PILL_HEIGHT + LANE_GAP;
      const cy = it.ann.labelPosition === "top" ? m.top + 4 + PILL_HEIGHT / 2 + it.lane * step : h - m.bottom / 2 - it.lane * step;
      boxes.push({ ...drawPill(ctx, it.ann.label, it.cx, cy, it.color, dark, fontFamily), ann: it.ann });
    }
    ctx.restore();
  }
};
// src/plugins/experimental/crosshair.ts
var states3 = new WeakMap;
var crosshairPlugin = {
  name: "crosshair",
  install(chart, el) {
    const ac = new AbortController;
    const state = {
      mouseX: 0,
      mouseY: 0,
      visible: false,
      abort: ac
    };
    states3.set(chart, state);
    el.addEventListener("mousemove", (e) => {
      e.preventDefault();
      if (chart.dragging)
        return;
      const r = el.getBoundingClientRect();
      state.mouseX = e.clientX - r.left;
      state.mouseY = e.clientY - r.top;
      state.visible = true;
      scheduleDraw(chart);
    }, { signal: ac.signal });
    ["mouseleave", "pointerdown"].forEach((ev) => el.addEventListener(ev, () => {
      state.visible = false;
      scheduleDraw(chart);
    }, { signal: ac.signal }));
  },
  afterDraw(ctx, chart) {
    const state = states3.get(chart);
    if (!state?.visible)
      return;
    const cfg = chart.config;
    const showX = cfg.crosshairX ?? true;
    const showY = cfg.crosshairY ?? true;
    if (!showX && !showY)
      return;
    const { width: w, height: h } = chart;
    const m = chartMargin(chart);
    const dark = ChartManager.isDark;
    const color = cfg.crosshairColor ?? (dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)");
    const dash = cfg.crosshairDash ?? [4, 3];
    const lineWidth = cfg.crosshairWidth ?? 1;
    const { mouseX: mx, mouseY: my } = state;
    if (mx < m.left || mx > w - m.right || my < m.top || my > h - m.bottom) {
      state.visible = false;
      return;
    }
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash);
    ctx.beginPath();
    if (showX) {
      ctx.moveTo(mx, m.top);
      ctx.lineTo(mx, h - m.bottom);
    }
    if (showY) {
      ctx.moveTo(m.left, my);
      ctx.lineTo(w - m.right, my);
    }
    ctx.stroke();
    ctx.restore();
  },
  uninstall(chart) {
    const state = states3.get(chart);
    state?.abort.abort();
    states3.delete(chart);
  }
};
// src/plugins/experimental/thumbnail.ts
var newThumbnail = () => ({ canvas: null, key: null });
function seriesThumbnail(thumb, chart, w, h, pad, dpr) {
  const b = chart.bounds;
  const key = [chart.series, hiddenKey(chart), b.minX, b.maxX, b.minY, b.maxY, w, h, pad, dpr];
  for (const s of chart.series)
    key.push(s.rawX, s.plotY ?? s.rawY, s.rawX.length);
  if (thumb.canvas && sameKey(thumb.key, key))
    return thumb.canvas;
  const canvas = thumb.canvas ?? document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx)
    return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const rangeX = b.maxX - b.minX || 1;
  const rangeY = b.maxY - b.minY || 1;
  const iw = w - 2 * pad, ih = h - 2 * pad;
  const hidden = chart.config.hiddenSeries;
  ctx.lineWidth = 1;
  chart.series.forEach((series, si) => {
    const n = series.rawX.length;
    if (n === 0 || hidden?.has(si))
      return;
    const { r, g, b: bv } = series.color;
    ctx.strokeStyle = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(bv * 255)},0.7)`;
    ctx.beginPath();
    const step = Math.max(1, Math.floor(n / w));
    const plotY = series.plotY ?? series.rawY;
    let pen = false;
    for (let i = 0;i < n; i += step) {
      const x = series.rawX[i], y = plotY[i];
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        pen = false;
        continue;
      }
      const px = pad + (x - b.minX) / rangeX * iw;
      const py = pad + (1 - (y - b.minY) / rangeY) * ih;
      if (pen)
        ctx.lineTo(px, py);
      else
        ctx.moveTo(px, py);
      pen = true;
    }
    ctx.stroke();
  });
  thumb.canvas = canvas;
  thumb.key = key;
  return canvas;
}

// src/plugins/experimental/minimap.ts
var states4 = new WeakMap;
var INNER_PAD = 4;
function getMinimapOrigin(pos, mSize, cw, ch, chart) {
  const pad = 8;
  const m = chart ? chartMargin(chart) : MARGIN;
  switch (pos) {
    case "top-left":
      return { mx: m.left + pad, my: m.top + pad };
    case "top-right":
      return { mx: cw - m.right - mSize - pad, my: m.top + pad };
    case "bottom-left":
      return { mx: m.left + pad, my: ch - m.bottom - mSize - pad };
    case "bottom-right":
      return { mx: cw - m.right - mSize - pad, my: ch - m.bottom - mSize - pad };
  }
}
var minimapPlugin = {
  name: "minimap",
  install(chart, el) {
    const ac = new AbortController;
    const host = chart.el;
    states4.set(chart, { abort: ac, drag: null, didDrag: false, thumb: newThumbnail() });
    const getMinimapCoords = (e) => {
      const cfg = chart.config;
      const mSize = cfg.minimapSize ?? 120;
      const pos = cfg.minimapPosition ?? "bottom-right";
      const { width: cw, height: ch } = chart;
      const r = el.getBoundingClientRect();
      const scaleX = cw / r.width;
      const scaleY = ch / r.height;
      const cx = (e.clientX - r.left) * scaleX;
      const cy = (e.clientY - r.top) * scaleY;
      const { mx, my } = getMinimapOrigin(pos, mSize, cw, ch, chart);
      return { cx, cy, mx, my, mSize };
    };
    const onCanvas = (e) => e.target instanceof HTMLCanvasElement && e.target.parentElement === el;
    host.addEventListener("pointerdown", (e) => {
      if (!onCanvas(e))
        return;
      const { cx, cy, mx, my, mSize } = getMinimapCoords(e);
      if (cx < mx || cx > mx + mSize || cy < my || cy > my + mSize)
        return;
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      const state = states4.get(chart);
      if (!state)
        return;
      const fx = (cx - mx) / mSize;
      const fy = (cy - my) / mSize;
      state.drag = {
        startFx: fx,
        startFy: fy,
        startPanX: chart.view.panX,
        startPanY: chart.view.panY
      };
    }, { capture: true, signal: ac.signal });
    window.addEventListener("pointermove", (e) => {
      const state = states4.get(chart);
      if (!state?.drag)
        return;
      if (e.buttons === 0) {
        state.drag = null;
        return;
      }
      const { cx, cy, mx, my, mSize } = getMinimapCoords(e);
      const fx = (cx - mx) / mSize;
      const fy = (cy - my) / mSize;
      const dfx = fx - state.drag.startFx;
      const dfy = fy - state.drag.startFy;
      const hv = chart.homeView;
      chart.view.panX = Math.max(hv.panX, Math.min(hv.panX + 1 / hv.zoomX - 1 / chart.view.zoomX, state.drag.startPanX + dfx / hv.zoomX));
      chart.view.panY = Math.max(hv.panY, Math.min(hv.panY + 1 / hv.zoomY - 1 / chart.view.zoomY, state.drag.startPanY - dfy / hv.zoomY));
      if (Math.abs(dfx) > 0.005 || Math.abs(dfy) > 0.005)
        state.didDrag = true;
      commitView(chart);
    }, { signal: ac.signal });
    window.addEventListener("pointerup", () => {
      const state = states4.get(chart);
      if (state) {
        if (state.drag) {
          setTimeout(() => {
            if (state)
              state.didDrag = false;
          }, 50);
        }
        state.drag = null;
      }
    }, { signal: ac.signal });
    host.addEventListener("click", (e) => {
      const state = states4.get(chart);
      if (!state)
        return;
      if (state.didDrag) {
        state.didDrag = false;
        e.stopPropagation();
        return;
      }
      if (clickFollowsDrag(chart) || !onCanvas(e))
        return;
      const { cx, cy, mx, my, mSize } = getMinimapCoords(e);
      if (cx < mx || cx > mx + mSize || cy < my || cy > my + mSize)
        return;
      e.preventDefault();
      e.stopPropagation();
      const fx = (cx - mx) / mSize;
      const fy = (cy - my) / mSize;
      const fyData = 1 - fy;
      const hv = chart.homeView;
      chart.view.panX = Math.max(hv.panX, Math.min(hv.panX + 1 / hv.zoomX - 1 / chart.view.zoomX, hv.panX + fx / hv.zoomX - 0.5 / chart.view.zoomX));
      chart.view.panY = Math.max(hv.panY, Math.min(hv.panY + 1 / hv.zoomY - 1 / chart.view.zoomY, hv.panY + fyData / hv.zoomY - 0.5 / chart.view.zoomY));
      commitView(chart);
    }, { capture: true, signal: ac.signal });
  },
  afterDraw(ctx, chart) {
    const state = states4.get(chart);
    if (!state)
      return;
    const cfg = chart.config;
    const mSize = cfg.minimapSize ?? 120;
    const opacity = cfg.minimapOpacity ?? 0.85;
    const pos = cfg.minimapPosition ?? "bottom-right";
    const { width: cw, height: ch } = chart;
    const dark = ChartManager.isDark;
    const { mx, my } = getMinimapOrigin(pos, mSize, cw, ch, chart);
    const mw = mSize;
    const mh = mSize;
    const borderR = 6;
    const innerPad = INNER_PAD;
    ctx.save();
    ctx.globalAlpha = opacity;
    const bgColor = cfg.bgColor ?? (dark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
    ctx.fillStyle = `rgb(${bgColor.map((c) => Math.round(c * 255)).join(",")})`;
    ctx.beginPath();
    ctx.roundRect(mx, my, mw, mh, borderR);
    ctx.fill();
    ctx.strokeStyle = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(mx + 1, my + 1, mw - 2, mh - 2, borderR - 1);
    ctx.clip();
    const thumb = seriesThumbnail(state.thumb, chart, mw, mh, innerPad, chartDpr(chart));
    if (thumb)
      ctx.drawImage(thumb, mx, my, mw, mh);
    const { view: v } = chart;
    const hv = chart.homeView;
    const homeRangeX = 1 / hv.zoomX;
    const homeRangeY = 1 / hv.zoomY;
    const vx = mx + innerPad + (v.panX - hv.panX) * hv.zoomX * (mw - innerPad * 2);
    const vy = my + innerPad + (1 - (v.panY - hv.panY) * hv.zoomY - 1 / v.zoomY / homeRangeY) * (mh - innerPad * 2);
    const vw = 1 / v.zoomX / homeRangeX * (mw - innerPad * 2);
    const vh = 1 / v.zoomY / homeRangeY * (mh - innerPad * 2);
    ctx.fillStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(0,100,255,0.1)";
    ctx.fillRect(vx, vy, vw, vh);
    ctx.strokeStyle = dark ? "rgba(255,255,255,0.5)" : "rgba(0,100,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);
    ctx.restore();
  },
  uninstall(chart) {
    const s = states4.get(chart);
    if (s) {
      s.abort.abort();
      states4.delete(chart);
    }
  }
};
// src/plugins/experimental/range-selector.ts
var states5 = new WeakMap;
var EDGE_PX = 5;
var EDGE_PX_TOUCH = 12;
function fitCanvas(chart, state) {
  const w = Math.max(1, chart.width);
  const dpr = chartDpr(chart);
  if (w === state.width && dpr === state.dpr)
    return;
  state.width = w;
  state.dpr = dpr;
  state.canvas.width = Math.round(w * dpr);
  state.canvas.height = Math.round(state.height * dpr);
}
function drawMiniCanvas(chart, state) {
  const { ctx, width: w, height: h, dpr } = state;
  const dark = ChartManager.isDark;
  const cfg = chart.config;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bgColor = cfg.bgColor ?? (dark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
  ctx.fillStyle = `rgb(${bgColor.map((c) => Math.round(c * 255)).join(",")})`;
  ctx.fillRect(0, 0, w, h);
  const thumb = seriesThumbnail(state.thumb, chart, w, h, 0, dpr);
  if (thumb)
    ctx.drawImage(thumb, 0, 0, w, h);
  const { view: v } = chart;
  const hv = chart.homeView;
  const homeRange = 1 / hv.zoomX;
  const brushL = (v.panX - hv.panX) / homeRange * w;
  const brushR = (v.panX - hv.panX + 1 / v.zoomX) / homeRange * w;
  const brushColor = cfg.brushColor ?? (dark ? "rgba(255,255,255,0.12)" : "rgba(0,100,255,0.1)");
  const brushBorder = dark ? "rgba(255,255,255,0.35)" : "rgba(0,100,255,0.5)";
  ctx.fillStyle = dark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.5)";
  ctx.fillRect(0, 0, brushL, h);
  ctx.fillRect(brushR, 0, w - brushR, h);
  ctx.fillStyle = brushColor;
  ctx.fillRect(brushL, 0, brushR - brushL, h);
  ctx.strokeStyle = brushBorder;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(brushL, 0.75, brushR - brushL, h - 1.5);
}
var rangeSelectorPlugin = {
  name: "range-selector",
  install(chart, el) {
    const cfg = chart.config;
    const height = cfg.rangeSelectorHeight ?? 60;
    const margin = cfg.rangeSelectorMargin ?? 4;
    const ac = new AbortController;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = `display:block;margin-top:${margin}px;width:100%;height:${height}px;touch-action:pan-y;`;
    const originalHeight = el.style.height;
    if (el.parentElement) {
      el.style.height = `calc(100% - ${height + margin}px)`;
      el.parentElement.insertBefore(canvas, el.nextSibling);
    }
    const ctx2d = canvas.getContext("2d");
    const state = {
      canvas,
      ctx: ctx2d,
      abort: ac,
      brushDrag: null,
      thumb: newThumbnail(),
      width: 0,
      height,
      dpr: 0,
      el,
      originalHeight
    };
    states5.set(chart, state);
    const getRelX = (e) => {
      const rect = canvas.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    };
    const brush = (e) => {
      const { view: v } = chart;
      const hv = chart.homeView;
      const homeRange = 1 / hv.zoomX;
      const left = (v.panX - hv.panX) / homeRange;
      return {
        left,
        right: left + hv.zoomX / v.zoomX,
        tol: (e.pointerType === "touch" ? EDGE_PX_TOUCH : EDGE_PX) / (state.width || 1)
      };
    };
    const hoverCursor = (e) => {
      const rx = getRelX(e);
      const { left, right, tol } = brush(e);
      canvas.style.cursor = Math.abs(rx - left) < tol || Math.abs(rx - right) < tol ? "ew-resize" : rx > left && rx < right ? "grab" : "default";
    };
    canvas.addEventListener("pointerdown", (e) => {
      const rx = getRelX(e);
      const { view: v } = chart;
      const { left, right, tol } = brush(e);
      const start = (type) => {
        state.brushDrag = { type, startX: rx, startPanX: v.panX, startZoomX: v.zoomX };
        canvas.setPointerCapture(e.pointerId);
      };
      if (Math.abs(rx - left) < tol) {
        start("left");
      } else if (Math.abs(rx - right) < tol) {
        start("right");
      } else if (rx > left && rx < right) {
        start("move");
        canvas.style.cursor = "grabbing";
      } else {
        const hv = chart.homeView;
        const homeRange = 1 / hv.zoomX;
        const brushWidth = 1 / v.zoomX;
        chart.view.panX = Math.max(hv.panX, Math.min(hv.panX + homeRange - brushWidth, hv.panX + rx * homeRange - brushWidth / 2));
        commitView(chart);
      }
      e.preventDefault();
    }, { signal: ac.signal });
    canvas.addEventListener("pointermove", (e) => {
      if (!state.brushDrag) {
        if (e.pointerType !== "touch")
          hoverCursor(e);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const rx = (e.clientX - rect.left) / rect.width;
      const dx = rx - state.brushDrag.startX;
      const { startPanX, startZoomX } = state.brushDrag;
      const hv = chart.homeView;
      const homeRange = 1 / hv.zoomX;
      if (state.brushDrag.type === "move") {
        chart.view.panX = Math.max(hv.panX, Math.min(hv.panX + homeRange - 1 / startZoomX, startPanX + dx * homeRange));
      } else if (state.brushDrag.type === "left") {
        const newLeft = Math.max(hv.panX, startPanX + dx * homeRange);
        const newRight = startPanX + 1 / startZoomX;
        if (newLeft < newRight - 0.01) {
          chart.view.panX = newLeft;
          chart.view.zoomX = Math.max(hv.zoomX, 1 / (newRight - newLeft));
        }
      } else if (state.brushDrag.type === "right") {
        const newRight = Math.min(hv.panX + homeRange, startPanX + 1 / startZoomX + dx * homeRange);
        if (newRight > startPanX + 0.01) {
          chart.view.zoomX = Math.max(hv.zoomX, 1 / (newRight - startPanX));
        }
      }
      commitView(chart);
    }, { signal: ac.signal });
    const endDrag = (e) => {
      if (!state.brushDrag)
        return;
      state.brushDrag = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
      if (e.pointerType !== "touch")
        hoverCursor(e);
      else
        canvas.style.cursor = "";
    };
    canvas.addEventListener("pointerup", endDrag, { signal: ac.signal });
    canvas.addEventListener("pointercancel", endDrag, { signal: ac.signal });
    fitCanvas(chart, state);
    drawMiniCanvas(chart, state);
  },
  afterDraw(_, chart) {
    const state = states5.get(chart);
    if (!state)
      return;
    fitCanvas(chart, state);
    drawMiniCanvas(chart, state);
  },
  uninstall(chart) {
    const state = states5.get(chart);
    if (state) {
      state.abort.abort();
      state.canvas.remove();
      state.el.style.height = state.originalHeight;
      states5.delete(chart);
    }
  }
};
// src/plugins/experimental/ruler.ts
var states6 = new WeakMap;
var ENDPOINT_HIT_PX = 12;
function rulerAt(state, chart, sx, sy, w, h) {
  for (let i = state.rulers.length - 1;i >= 0; i--) {
    const ruler = state.rulers[i];
    const sa = dataToScreen(ruler.a.dataX, ruler.a.dataY, chart, w, h);
    const sb = dataToScreen(ruler.b.dataX, ruler.b.dataY, chart, w, h);
    if (Math.hypot(sa.x - sx, sa.y - sy) <= ENDPOINT_HIT_PX || Math.hypot(sb.x - sx, sb.y - sy) <= ENDPOINT_HIT_PX)
      return i;
  }
  return -1;
}
function showClearBtn(btn, visible) {
  const isVisible = btn.hasAttribute("data-visible");
  if (visible === isVisible)
    return;
  btn.style.transform = "";
  if (visible) {
    btn.setAttribute("data-visible", "");
  } else {
    btn.removeAttribute("data-visible");
  }
}
function injectRulerStyles() {
  if (document.getElementById("chart-ruler-styles"))
    return;
  const style = document.createElement("style");
  style.id = "chart-ruler-styles";
  style.textContent = `
@layer chartai.ruler {
  .chart-ruler-wrapper {
    position: absolute;
    z-index: 1000;
    pointer-events: none;
    display: inline-block;
  }
  .chart-ruler-btn {
    position: relative;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1.5px solid var(--ruler-btn-border);
    background: var(--ruler-btn-bg);
    color: var(--ruler-btn-color);
    z-index: 100;
    cursor: pointer;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.18);
  }
  .chart-ruler-btn[data-active] {
    --ruler-btn-border: var(--ruler-active-border);
    --ruler-btn-bg: var(--ruler-active-bg);
    --ruler-btn-color: var(--ruler-active-color);
  }
  .chart-ruler-clear {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid oklch(from var(--ruler-active-color) calc(l * 0.7) c h / 1);
    background: oklch(from var(--ruler-active-color) calc(l * 0.22) c h / 1);
    color: var(--ruler-active-color);
    z-index: 101;
    cursor: pointer;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.22);
    opacity: 0;
    transform: scale(0.5);
    transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.4, 0, 1, 1);
  }
  .chart-ruler-clear[data-visible] {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
    transition: opacity 0.22s ease, transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}`;
  document.head.appendChild(style);
}
function applyTheme(el, dark) {
  const s = el.style;
  if (dark) {
    s.setProperty("--ruler-btn-border", "rgba(255,255,255,0.2)");
    s.setProperty("--ruler-btn-bg", "rgba(30,30,32,0.88)");
    s.setProperty("--ruler-btn-color", "rgba(200,200,200,0.9)");
    s.setProperty("--ruler-active-border", "rgba(255,200,50,0.8)");
    s.setProperty("--ruler-active-bg", "rgba(255,200,50,0.2)");
    s.setProperty("--ruler-active-color", "rgba(255,200,50,0.95)");
    s.setProperty("--ruler-clear-border", "rgba(255,255,255,0.18)");
    s.setProperty("--ruler-clear-bg", "rgba(30,30,32,0.95)");
    s.setProperty("--ruler-clear-color", "rgba(200,200,200,0.9)");
  } else {
    s.setProperty("--ruler-btn-border", "rgba(0,0,0,0.15)");
    s.setProperty("--ruler-btn-bg", "rgba(255,255,255,0.92)");
    s.setProperty("--ruler-btn-color", "rgba(80,80,80,0.9)");
    s.setProperty("--ruler-active-border", "rgba(180,100,0,0.8)");
    s.setProperty("--ruler-active-bg", "rgba(180,100,0,0.12)");
    s.setProperty("--ruler-active-color", "rgba(180,100,0,0.95)");
    s.setProperty("--ruler-clear-border", "rgba(0,0,0,0.13)");
    s.setProperty("--ruler-clear-bg", "rgba(255,255,255,0.97)");
    s.setProperty("--ruler-clear-color", "rgba(80,80,80,0.9)");
  }
}
function setWrapperPosition(el, pos = "bottom-right", chart) {
  const m = chart ? chartMargin(chart) : MARGIN;
  const pad = 8;
  el.style.removeProperty("top");
  el.style.removeProperty("bottom");
  el.style.removeProperty("left");
  el.style.removeProperty("right");
  switch (pos) {
    case "top-left":
      el.style.top = `${m.top + pad}px`;
      el.style.left = `${m.left + pad}px`;
      break;
    case "top-right":
      el.style.top = `${m.top + pad}px`;
      el.style.right = `${m.right + pad}px`;
      break;
    case "bottom-right":
      el.style.bottom = `${m.bottom + pad}px`;
      el.style.right = `${m.right + pad}px`;
      break;
    default:
      el.style.bottom = `${m.bottom + pad}px`;
      el.style.left = `${m.left + pad}px`;
  }
}
function drawPill2(ctx, text, cx, cy, color, fontFamily, dark) {
  ctx.font = `500 11px ${fontFamily}`;
  const tw = ctx.measureText(text).width;
  const pw = tw + 16;
  const ph = 20;
  const px = cx - pw / 2;
  const py = cy - ph / 2;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 5);
  ctx.fillStyle = dark ? "rgba(20,20,22,0.90)" : "rgba(255,255,255,0.95)";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy);
}
function drawEndpoint(ctx, x, y, color, dark) {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
function drawRulerShape(ctx, a, b, axis, chart, w, h, color, formatX, formatY, fontFamily, dark) {
  const sa = dataToScreen(a.dataX, a.dataY, chart, w, h);
  const sb = dataToScreen(b.dataX, b.dataY, chart, w, h);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  const TICK = 6;
  if (axis === "x") {
    const midY = (sa.y + sb.y) / 2;
    ctx.beginPath();
    ctx.moveTo(sa.x, midY);
    ctx.lineTo(sb.x, midY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(sa.x, midY - TICK);
    ctx.lineTo(sa.x, midY + TICK);
    ctx.moveTo(sb.x, midY - TICK);
    ctx.lineTo(sb.x, midY + TICK);
    ctx.stroke();
    drawEndpoint(ctx, sa.x, sa.y, color, dark);
    drawEndpoint(ctx, sb.x, sb.y, color, dark);
    const labelX = (sa.x + sb.x) / 2;
    const labelY = midY - 16;
    const dx = Math.abs(b.dataX - a.dataX);
    drawPill2(ctx, `ΔX: ${formatX(dx)}`, labelX, labelY, color, fontFamily, dark);
  } else if (axis === "y") {
    const midX = (sa.x + sb.x) / 2;
    ctx.beginPath();
    ctx.moveTo(midX, sa.y);
    ctx.lineTo(midX, sb.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(midX - TICK, sa.y);
    ctx.lineTo(midX + TICK, sa.y);
    ctx.moveTo(midX - TICK, sb.y);
    ctx.lineTo(midX + TICK, sb.y);
    ctx.stroke();
    drawEndpoint(ctx, sa.x, sa.y, color, dark);
    drawEndpoint(ctx, sb.x, sb.y, color, dark);
    const labelX = midX + 20;
    const labelY = (sa.y + sb.y) / 2;
    const dy = Math.abs(b.dataY - a.dataY);
    drawPill2(ctx, `ΔY: ${formatY(dy)}`, labelX, labelY, color, fontFamily, dark);
  } else {
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
    drawEndpoint(ctx, sa.x, sa.y, color, dark);
    drawEndpoint(ctx, sb.x, sb.y, color, dark);
    const labelX = (sa.x + sb.x) / 2;
    const labelY = (sa.y + sb.y) / 2 - 18;
    const dx = Math.abs(b.dataX - a.dataX);
    const dy = Math.abs(b.dataY - a.dataY);
    drawPill2(ctx, `ΔX: ${formatX(dx)}  ΔY: ${formatY(dy)}`, labelX, labelY, color, fontFamily, dark);
  }
  ctx.restore();
}
var rulerPlugin = {
  name: "ruler",
  install(chart, el) {
    injectRulerStyles();
    const ac = new AbortController;
    const cfg = chart.config;
    const dark = ChartManager.isDark;
    const wrapper = document.createElement("div");
    wrapper.className = "chart-ruler-wrapper";
    setWrapperPosition(wrapper, cfg.rulerPosition, chart);
    applyTheme(wrapper, dark);
    wrapper.addEventListener("click", (e) => e.stopPropagation(), { signal: ac.signal });
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chart-ruler-btn";
    button.title = "Toggle ruler tool";
    button.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4.5" width="12" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><line x1="3.5" y1="4.5" x2="3.5" y2="7" stroke="currentColor" stroke-width="1.2"/><line x1="5.5" y1="4.5" x2="5.5" y2="6" stroke="currentColor" stroke-width="1.2"/><line x1="7" y1="4.5" x2="7" y2="7" stroke="currentColor" stroke-width="1.2"/><line x1="8.5" y1="4.5" x2="8.5" y2="6" stroke="currentColor" stroke-width="1.2"/><line x1="10.5" y1="4.5" x2="10.5" y2="7" stroke="currentColor" stroke-width="1.2"/></svg>`;
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "chart-ruler-clear";
    clearBtn.title = "Clear all rulers";
    clearBtn.innerHTML = `<svg width="5" height="5" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="1" y1="1" x2="5" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="5" y1="1" x2="1" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    wrapper.appendChild(button);
    wrapper.appendChild(clearBtn);
    el.appendChild(wrapper);
    const state = {
      rulers: [],
      pending: null,
      cursorDataX: 0,
      cursorDataY: 0,
      active: false,
      abort: ac,
      button,
      clearBtn,
      wrapper,
      wrapperKey: ""
    };
    states6.set(chart, state);
    button.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      state.active = !state.active;
      if (!state.active)
        state.pending = null;
      if (state.active)
        button.dataset.active = "";
      else
        delete button.dataset.active;
      scheduleDraw(chart);
    }, { signal: ac.signal });
    clearBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      clearBtn.style.transform = "scale(0.78)";
      state.rulers = [];
      state.pending = null;
      scheduleDraw(chart);
    }, { signal: ac.signal });
    el.addEventListener("mousemove", (e) => {
      if (!state.active && state.pending === null)
        return;
      const r = el.getBoundingClientRect();
      const { x, y } = screenToData(e.clientX - r.left, e.clientY - r.top, chart, r.width, r.height);
      state.cursorDataX = x;
      state.cursorDataY = y;
      scheduleDraw(chart);
    }, { signal: ac.signal });
    el.addEventListener("click", (e) => {
      if (!state.active)
        return;
      if (chart.dragging || clickFollowsDrag(chart))
        return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      const { x: dataX, y: dataY } = screenToData(sx, sy, chart, r.width, r.height);
      const hit = rulerAt(state, chart, sx, sy, r.width, r.height);
      if (hit !== -1) {
        state.rulers.splice(hit, 1);
        scheduleDraw(chart);
        return;
      }
      if (state.pending === null) {
        state.pending = { dataX, dataY };
      } else {
        const rulerMax = chart.config.rulerMax ?? 10;
        if (state.rulers.length >= rulerMax)
          state.rulers.shift();
        state.rulers.push({ a: state.pending, b: { dataX, dataY } });
        state.pending = null;
      }
      scheduleDraw(chart);
    }, { signal: ac.signal });
    el.addEventListener("contextmenu", (e) => {
      if (!state.active)
        return;
      if (state.pending !== null) {
        state.pending = null;
      } else {
        const r = el.getBoundingClientRect();
        const hit = rulerAt(state, chart, e.clientX - r.left, e.clientY - r.top, r.width, r.height);
        if (hit === -1)
          return;
        state.rulers.splice(hit, 1);
      }
      e.preventDefault();
      scheduleDraw(chart);
    }, { signal: ac.signal });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.active) {
        state.pending = null;
        scheduleDraw(chart);
      }
    }, { signal: ac.signal });
  },
  afterDraw(ctx, chart) {
    const state = states6.get(chart);
    if (!state)
      return;
    const w = chart.width;
    const h = chart.height;
    const dark = ChartManager.isDark;
    const cfg = chart.config;
    const axis = cfg.rulerAxis ?? "x";
    const color = cfg.rulerColor ?? (dark ? "rgba(255,200,50,0.9)" : "rgba(180,100,0,0.9)");
    const formatX = cfg.formatX ?? String;
    const formatY = cfg.formatY ?? String;
    const fontFamily = cfg.fontFamily ?? DEFAULT_FONT;
    const m = chartMargin(chart);
    const wrapperKey = `${cfg.rulerPosition}|${m.top}|${m.right}|${m.bottom}|${m.left}|${dark}`;
    if (wrapperKey !== state.wrapperKey) {
      state.wrapperKey = wrapperKey;
      setWrapperPosition(state.wrapper, cfg.rulerPosition, chart);
      applyTheme(state.wrapper, dark);
    }
    showClearBtn(state.clearBtn, state.rulers.length > 0);
    ctx.save();
    for (const ruler of state.rulers) {
      drawRulerShape(ctx, ruler.a, ruler.b, axis, chart, w, h, color, formatX, formatY, fontFamily, dark);
    }
    if (state.pending !== null) {
      const cursor = {
        dataX: state.cursorDataX,
        dataY: state.cursorDataY
      };
      drawRulerShape(ctx, state.pending, cursor, axis, chart, w, h, color, formatX, formatY, fontFamily, dark);
      const sc = dataToScreen(state.cursorDataX, state.cursorDataY, chart, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, 5, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  },
  uninstall(chart) {
    const state = states6.get(chart);
    if (!state)
      return;
    state.abort.abort();
    state.wrapper.remove();
    states6.delete(chart);
  }
};
// src/plugins/experimental/stats.ts
var newAccumulator = () => ({
  n: 0,
  shift: 0,
  sum: 0,
  sumSq: 0,
  min: Infinity,
  max: -Infinity
});
function accumulate(acc, values, start, end) {
  let { n, shift, sum, sumSq, min, max } = acc;
  for (let i = start;i < end; i++) {
    const v = values[i];
    if (!Number.isFinite(v))
      continue;
    if (n === 0)
      shift = v;
    const d = v - shift;
    n++;
    sum += d;
    sumSq += d * d;
    if (v < min)
      min = v;
    if (v > max)
      max = v;
  }
  Object.assign(acc, { n, shift, sum, sumSq, min, max });
}
function finish(acc) {
  if (acc.n === 0)
    return null;
  const d = acc.sum / acc.n;
  return {
    min: acc.min,
    max: acc.max,
    mean: acc.shift + d,
    stddev: Math.sqrt(Math.max(0, acc.sumSq / acc.n - d * d)),
    count: acc.n
  };
}
function computeStats(values) {
  const acc = newAccumulator();
  accumulate(acc, values, 0, values.length);
  return finish(acc);
}
function sortedRange(x, lo, hi) {
  let a = 0, b = x.length;
  while (a < b) {
    const mid = a + b >> 1;
    if (x[mid] < lo)
      a = mid + 1;
    else
      b = mid;
  }
  const start = a;
  b = x.length;
  while (a < b) {
    const mid = a + b >> 1;
    if (x[mid] <= hi)
      a = mid + 1;
    else
      b = mid;
  }
  return [start, a];
}
function computeGroups(chart) {
  const { bounds: b, view: v } = chart;
  const fullX = b.maxX - b.minX;
  const visMinX = b.minX + v.panX * fullX;
  const visMaxX = visMinX + fullX / v.zoomX;
  const hidden = chart.config.hiddenSeries;
  const sorted = chart.renderer.sortX !== false;
  const accs = [];
  for (let si = 0;si < chart.series.length; si++) {
    if (hidden?.has(si))
      continue;
    const s = chart.series[si];
    const ai = s.axisIndex ?? 0;
    const acc = accs[ai] ??= newAccumulator();
    if (sorted) {
      const [start, end] = sortedRange(s.rawX, visMinX, visMaxX);
      accumulate(acc, s.rawY, start, end);
    } else {
      const n = Math.min(s.rawX.length, s.rawY.length);
      for (let i = 0;i < n; i++) {
        const x = s.rawX[i];
        if (x >= visMinX && x <= visMaxX)
          accumulate(acc, s.rawY, i, i + 1);
      }
    }
  }
  const groups = [];
  accs.forEach((acc, ai) => {
    const stats = finish(acc);
    if (stats)
      groups.push({ axis: chart.yAxes?.[ai] ?? null, stats });
  });
  return groups;
}
function statsKey(chart) {
  const { bounds: b, view: v } = chart;
  const key = [
    chart.series,
    chart.yAxes,
    b.minX,
    b.maxX,
    v.panX,
    v.zoomX,
    hiddenKey(chart)
  ];
  for (const s of chart.series)
    key.push(s.rawX, s.rawY, s.rawX.length, s.rawY.length);
  return key;
}
var STATS_INTERVAL_MS = 100;
var states7 = new WeakMap;
function escapeHtml2(s) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
function applyLook(chart, state, visible) {
  const { overlay } = state;
  const dark = ChartManager.isDark;
  const cfg = chart.config;
  const bgColor = cfg.bgColor ?? (dark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
  const rgb = bgColor.map((c) => Math.round(c * 255)).join(",");
  const panelBg = dark ? `rgba(${rgb},0.92)` : "rgba(255,255,255,0.95)";
  const border = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)";
  const text = cfg.textColor ?? (dark ? "#c0c0c0" : "#333333");
  const font = cfg.fontFamily ?? DEFAULT_FONT;
  const pos = cfg.statsPosition ?? "top-left";
  const m = chartMargin(chart);
  const place = state.dragOffset ? "drag" : state.customPos ? `${state.customPos.x},${state.customPos.y}` : `${pos}|${m.top}|${m.right}|${m.bottom}|${m.left}`;
  const key = [visible, panelBg, border, text, font, place].join("|");
  if (key === state.lookKey)
    return;
  state.lookKey = key;
  overlay.style.display = visible ? "block" : "none";
  overlay.style.position = "absolute";
  overlay.style.pointerEvents = "auto";
  overlay.style.zIndex = "15";
  overlay.style.background = panelBg;
  overlay.style.border = `1px solid ${border}`;
  overlay.style.borderRadius = "6px";
  overlay.style.padding = "7px 10px";
  overlay.style.fontFamily = font;
  overlay.style.fontSize = "11px";
  overlay.style.color = text;
  overlay.style.minWidth = "100px";
  overlay.style.userSelect = "none";
  if (state.dragOffset)
    return;
  const pad = 6;
  if (state.customPos) {
    overlay.style.top = `${state.customPos.y}px`;
    overlay.style.left = `${state.customPos.x}px`;
    overlay.style.right = "auto";
    overlay.style.bottom = "auto";
  } else {
    overlay.style.right = "auto";
    overlay.style.bottom = "auto";
    overlay.style.top = "auto";
    overlay.style.left = "auto";
    if (pos === "top-left") {
      overlay.style.top = `${m.top + pad}px`;
      overlay.style.left = `${m.left + pad}px`;
    }
    if (pos === "top-right") {
      overlay.style.top = `${m.top + pad}px`;
      overlay.style.right = `${m.right + pad}px`;
      overlay.style.left = "auto";
    }
    if (pos === "bottom-left") {
      overlay.style.bottom = `${m.bottom + pad}px`;
      overlay.style.left = `${m.left + pad}px`;
      overlay.style.top = "auto";
    }
    if (pos === "bottom-right") {
      overlay.style.bottom = `${m.bottom + pad}px`;
      overlay.style.right = `${m.right + pad}px`;
      overlay.style.top = "auto";
      overlay.style.left = "auto";
    }
  }
}
function setContent(state, headerHtml, bodyHtml) {
  if (headerHtml !== state.headerHtml)
    state.header.innerHTML = state.headerHtml = headerHtml;
  if (bodyHtml !== state.bodyHtml)
    state.body.innerHTML = state.bodyHtml = bodyHtml;
}
function updateOverlay(chart, state) {
  const dark = ChartManager.isDark;
  const cfg = chart.config;
  const muted = dark ? "#777" : "#aaa";
  const precision = cfg.statsPrecision ?? 2;
  const fmt = cfg.formatValue ?? ((n) => n.toFixed(precision));
  const title = (arrow) => `<span style="color:${muted};font-size:10px;font-weight:600;letter-spacing:.04em;cursor:grab">STATS ${arrow}</span>`;
  if (state.collapsed) {
    applyLook(chart, state, true);
    setContent(state, title("&#9660;"), "");
    return;
  }
  const key = statsKey(chart);
  if (!sameKey(state.key, key)) {
    const now = performance.now();
    const wait = state.computedAt + STATS_INTERVAL_MS - now;
    if (wait <= 0) {
      state.key = key;
      state.computedAt = now;
      state.groups = computeGroups(chart);
    } else if (state.timer === null) {
      state.timer = setTimeout(() => {
        state.timer = null;
        if (states7.get(chart) === state)
          updateOverlay(chart, state);
      }, wait);
    }
  }
  const groups = state.groups;
  applyLook(chart, state, groups.length > 0);
  if (groups.length === 0)
    return;
  const cell = (s) => `<span>${s}</span>`;
  const row = (label, value) => `<span style="color:${muted}">${label}</span>${groups.map((g) => cell(value(g))).join("")}`;
  const head = groups.length > 1 ? `<span></span>${groups.map((g) => {
    const color = g.axis?.color ? `color:${escapeHtml2(g.axis.color)};` : `color:${muted};`;
    return `<span style="${color}font-weight:600">${escapeHtml2(g.axis?.id ?? "")}</span>`;
  }).join("")}` : "";
  const body = `
    <div style="display:grid;grid-template-columns:auto${" auto".repeat(groups.length)};gap:1px 10px">
      ${head}
      ${row("min", (g) => fmt(g.stats.min))}
      ${row("max", (g) => fmt(g.stats.max))}
      ${row("avg", (g) => fmt(g.stats.mean))}
      ${row("&#963;", (g) => fmt(g.stats.stddev))}
      ${row("n", (g) => g.stats.count.toLocaleString())}
    </div>`;
  setContent(state, `<div style="margin-bottom:4px">${title("&#9650;")}</div>`, body);
}
var statsPlugin = {
  name: "stats",
  install(chart, el) {
    const ac = new AbortController;
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:absolute;pointer-events:auto;z-index:15;";
    const header = document.createElement("div");
    const body = document.createElement("div");
    overlay.appendChild(header);
    overlay.appendChild(body);
    el.appendChild(overlay);
    const state = {
      overlay,
      header,
      body,
      collapsed: false,
      abort: ac,
      dragOffset: null,
      customPos: null,
      pressOnHeader: false,
      dragMoved: false,
      tiltAngle: 0,
      tiltVelocity: 0,
      tiltRafId: null,
      key: null,
      groups: [],
      computedAt: -Infinity,
      timer: null,
      lookKey: "",
      headerHtml: "",
      bodyHtml: ""
    };
    states7.set(chart, state);
    overlay.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!state.pressOnHeader || state.dragMoved)
        return;
      state.collapsed = !state.collapsed;
      updateOverlay(chart, state);
    }, { signal: ac.signal });
    overlay.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      state.pressOnHeader = header.contains(e.target);
      if (!state.customPos) {
        state.customPos = { x: overlay.offsetLeft, y: overlay.offsetTop };
        overlay.style.left = state.customPos.x + "px";
        overlay.style.top = state.customPos.y + "px";
        overlay.style.right = "auto";
        overlay.style.bottom = "auto";
      }
      state.dragOffset = { x: 0, y: 0 };
      state.dragMoved = false;
      if (state.tiltRafId !== null) {
        cancelAnimationFrame(state.tiltRafId);
        state.tiltRafId = null;
      }
      overlay.setPointerCapture(e.pointerId);
      overlay.style.cursor = "grabbing";
    }, { signal: ac.signal });
    overlay.addEventListener("pointermove", (e) => {
      if (!state.dragOffset || !state.customPos)
        return;
      const x = Math.max(0, Math.min(state.customPos.x + e.movementX, el.clientWidth - overlay.offsetWidth));
      const y = Math.max(0, Math.min(state.customPos.y + e.movementY, el.clientHeight - overlay.offsetHeight));
      state.dragOffset.x += e.movementX;
      state.dragOffset.y += e.movementY;
      if (Math.hypot(state.dragOffset.x, state.dragOffset.y) > 3)
        state.dragMoved = true;
      state.customPos = { x, y };
      overlay.style.left = x + "px";
      overlay.style.top = y + "px";
      state.tiltVelocity = state.tiltVelocity * 0.6 + e.movementX * 0.4;
      state.tiltAngle = Math.max(-15, Math.min(15, state.tiltVelocity * 1.5));
      overlay.style.transform = `rotate(${state.tiltAngle}deg)`;
    }, { signal: ac.signal });
    overlay.addEventListener("pointerup", () => {
      state.dragOffset = null;
      overlay.style.cursor = "";
      const decayTilt = () => {
        state.tiltAngle *= 0.78;
        state.tiltVelocity *= 0.78;
        if (Math.abs(state.tiltAngle) > 0.05) {
          overlay.style.transform = `rotate(${state.tiltAngle}deg)`;
          state.tiltRafId = requestAnimationFrame(decayTilt);
        } else {
          state.tiltAngle = 0;
          state.tiltVelocity = 0;
          overlay.style.transform = "";
          state.tiltRafId = null;
        }
      };
      state.tiltRafId = requestAnimationFrame(decayTilt);
    }, { signal: ac.signal });
  },
  afterDraw(_, chart) {
    const state = states7.get(chart);
    if (!state)
      return;
    updateOverlay(chart, state);
  },
  uninstall(chart) {
    const state = states7.get(chart);
    if (state) {
      if (state.tiltRafId !== null)
        cancelAnimationFrame(state.tiltRafId);
      if (state.timer !== null)
        clearTimeout(state.timer);
      state.abort.abort();
      state.overlay.remove();
      states7.delete(chart);
    }
  }
};
// src/plugins/experimental/threshold.ts
var thresholdPlugin = {
  name: "threshold",
  beforeDraw(ctx, chart) {
    const cfg = chart.config;
    const thresholds = cfg.thresholds;
    if (!thresholds?.length)
      return;
    const w = chart.width;
    const h = chart.height;
    const m = chartMargin(chart);
    for (const threshold of thresholds) {
      if (!threshold.fillAbove && !threshold.fillBelow)
        continue;
      const sy = dataToScreen(0, threshold.y, chart, w, h).y;
      ctx.save();
      ctx.beginPath();
      ctx.rect(m.left, m.top, w - m.left - m.right, h - m.top - m.bottom);
      ctx.clip();
      if (threshold.fillAbove) {
        ctx.fillStyle = threshold.fillAbove;
        ctx.fillRect(m.left, m.top, w - m.left - m.right, sy - m.top);
      }
      if (threshold.fillBelow) {
        ctx.fillStyle = threshold.fillBelow;
        ctx.fillRect(m.left, sy, w - m.left - m.right, h - m.bottom - sy);
      }
      ctx.restore();
    }
  },
  afterDraw(ctx, chart) {
    const cfg = chart.config;
    const thresholds = cfg.thresholds;
    if (!thresholds?.length)
      return;
    const w = chart.width;
    const h = chart.height;
    const m = chartMargin(chart);
    const dark = ChartManager.isDark;
    const fontFamily = cfg.fontFamily ?? DEFAULT_FONT;
    for (const threshold of thresholds) {
      const sy = dataToScreen(0, threshold.y, chart, w, h).y;
      if (sy < m.top || sy > h - m.bottom)
        continue;
      ctx.save();
      ctx.strokeStyle = threshold.color;
      ctx.lineWidth = threshold.lineWidth ?? 1.5;
      ctx.setLineDash(threshold.dash ?? [5, 3]);
      ctx.beginPath();
      ctx.moveTo(m.left, sy);
      ctx.lineTo(w - m.right, sy);
      ctx.stroke();
      ctx.restore();
      if (threshold.label) {
        ctx.save();
        ctx.font = `600 10px ${fontFamily}`;
        const tw = ctx.measureText(threshold.label).width;
        const pw = tw + 10;
        const ph = 17;
        const px = w - m.right - pw - 4;
        const py = sy - ph / 2;
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 3);
        ctx.fillStyle = dark ? "rgba(20,20,22,0.88)" : "rgba(255,255,255,0.92)";
        ctx.fill();
        ctx.strokeStyle = threshold.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.fillStyle = threshold.color;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(threshold.label, px + 5, sy);
        ctx.restore();
      }
    }
  }
};
// src/plugins/experimental/tooltip-pin.ts
var states8 = new WeakMap;
var MAX_PIN_PX = 30;
function findNearestPin(chart, screenX, screenY, width, height) {
  if (chart.series.length === 0)
    return null;
  const { x: dataX, y: dataY } = screenToData(screenX, screenY, chart, width, height);
  let bestSi = -1;
  let bestIdx = -1;
  let bestDx = Infinity;
  let bestDy = Infinity;
  const hidden = chart.config.hiddenSeries;
  for (let s = 0;s < chart.series.length; s++) {
    if (hidden?.has(s))
      continue;
    const sr = chart.series[s];
    const n = sr.rawX.length;
    if (n === 0)
      continue;
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (sr.rawX[mid] < dataX)
        lo = mid + 1;
      else
        hi = mid;
    }
    let idx = lo;
    if (lo > 0 && Math.abs(sr.rawX[lo - 1] - dataX) < Math.abs(sr.rawX[lo] - dataX)) {
      idx = lo - 1;
    }
    const y = (sr.plotY ?? sr.rawY)[idx];
    if (!Number.isFinite(y) || !Number.isFinite(sr.rawX[idx]))
      continue;
    const dx = Math.abs(sr.rawX[idx] - dataX);
    const dy = Math.abs(y - dataY);
    if (dx < bestDx || dx === bestDx && dy < bestDy) {
      bestDx = dx;
      bestDy = dy;
      bestSi = s;
      bestIdx = idx;
    }
  }
  if (bestSi === -1)
    return null;
  const sr = chart.series[bestSi];
  const plotY = sr.plotY ?? sr.rawY;
  const { x: candidateSx, y: candidateSy } = dataToScreen(sr.rawX[bestIdx], plotY[bestIdx], chart, width, height);
  if (Math.hypot(candidateSx - screenX, candidateSy - screenY) > MAX_PIN_PX)
    return null;
  return {
    dataX: sr.rawX[bestIdx],
    dataY: plotY[bestIdx],
    value: sr.rawY[bestIdx],
    seriesIndex: bestSi,
    seriesLabel: sr.label,
    color: sr.color
  };
}
var tooltipPinPlugin = {
  name: "tooltip-pin",
  install(chart, el) {
    const ac = new AbortController;
    const state = { pins: [], abort: ac };
    states8.set(chart, state);
    el.addEventListener("click", (e) => {
      if (chart.dragging || clickFollowsDrag(chart))
        return;
      const r = el.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      for (let i = state.pins.length - 1;i >= 0; i--) {
        const pin = state.pins[i];
        const { x: pinSx, y: pinSy } = dataToScreen(pin.dataX, pin.dataY, chart, r.width, r.height);
        if (Math.hypot(pinSx - sx, pinSy - sy) < 20) {
          state.pins.splice(i, 1);
          e.preventDefault();
          scheduleDraw(chart);
          return;
        }
      }
      const nearest = findNearestPin(chart, sx, sy, r.width, r.height);
      if (!nearest)
        return;
      e.preventDefault();
      const cfg = chart.config;
      const maxPins = cfg.pinMax ?? 5;
      if (state.pins.length >= maxPins)
        state.pins.shift();
      state.pins.push(nearest);
      scheduleDraw(chart);
    }, { signal: ac.signal });
  },
  afterDraw(ctx, chart) {
    const state = states8.get(chart);
    if (!state || state.pins.length === 0)
      return;
    const w = chart.width;
    const h = chart.height;
    const m = chartMargin(chart);
    const dark = ChartManager.isDark;
    const cfg = chart.config;
    const formatX = cfg.formatX ?? String;
    const fontFamily = cfg.fontFamily ?? DEFAULT_FONT;
    ctx.save();
    ctx.font = `500 10px ${fontFamily}`;
    for (const pin of state.pins) {
      const { x: pinSx, y: pinSy } = dataToScreen(pin.dataX, pin.dataY, chart, w, h);
      const colRgb = `${Math.round(pin.color.r * 255)},${Math.round(pin.color.g * 255)},${Math.round(pin.color.b * 255)}`;
      const col = `rgb(${colRgb})`;
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = `rgba(${colRgb},0.4)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pinSx, m.top);
      ctx.lineTo(pinSx, h - m.bottom);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(pinSx, pinSy, 5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const xLabel = formatX(pin.dataX);
      const yLabel = `${pin.seriesLabel}: ${seriesAxisFormat(chart, pin.seriesIndex)(pin.value ?? pin.dataY)}`;
      ctx.font = `500 10px ${fontFamily}`;
      const cardW = Math.max(ctx.measureText(xLabel).width, ctx.measureText(yLabel).width) + 20;
      const cardH = 14 + 2 * 17;
      let bx = pinSx + 10;
      let by = pinSy - cardH - 8;
      if (bx + cardW > w)
        bx = pinSx - cardW - 10;
      by = Math.max(m.top + 4, Math.min(h - m.bottom - cardH - 4, by));
      ctx.beginPath();
      ctx.roundRect(bx, by, cardW, cardH, 5);
      ctx.fillStyle = dark ? "rgba(28,28,30,0.94)" : "rgba(255,255,255,0.96)";
      ctx.fill();
      ctx.strokeStyle = `rgba(${colRgb},0.4)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(bx, by, cardW, 3, [5, 5, 0, 0]);
      ctx.fill();
      ctx.font = `500 10px ${fontFamily}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = dark ? "#888" : "#999";
      ctx.fillText(xLabel, bx + 10, by + 10);
      ctx.fillStyle = dark ? "#eee" : "#1a1a1a";
      ctx.fillText(yLabel, bx + 10, by + 27);
    }
    ctx.restore();
  },
  uninstall(chart) {
    const state = states8.get(chart);
    if (state) {
      state.abort.abort();
      states8.delete(chart);
    }
  }
};
// src/plugins/experimental/watermark.ts
var watermarkPlugin = {
  name: "watermark",
  beforeDraw(ctx, chart) {
    const cfg = chart.config;
    const text = cfg.watermarkText;
    if (!text)
      return;
    const { width: w, height: h } = chart;
    const m = chartMargin(chart);
    const chartW = w - m.left - m.right;
    const chartH = h - m.top - m.bottom;
    const position = cfg.watermarkPosition ?? "center";
    const opacity = cfg.watermarkOpacity ?? 0.07;
    const fontSize = cfg.watermarkFontSize ?? Math.max(12, Math.round(Math.min(chartW, chartH) * 0.06));
    const dark = ChartManager.isDark;
    const color = cfg.watermarkColor ?? (dark ? "#ffffff" : "#000000");
    const fontFamily = cfg.fontFamily ?? DEFAULT_FONT;
    const rotation = cfg.watermarkRotation ?? (position === "center" ? -30 : 0);
    const pad = 16;
    let x;
    let y;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    switch (position) {
      case "center":
        x = m.left + chartW / 2;
        y = m.top + chartH / 2;
        ctx.textAlign = "center";
        break;
      case "top-left":
        x = m.left + pad;
        y = m.top + pad + fontSize / 2;
        ctx.textAlign = "left";
        break;
      case "top-right":
        x = w - m.right - pad;
        y = m.top + pad + fontSize / 2;
        ctx.textAlign = "right";
        break;
      case "bottom-left":
        x = m.left + pad;
        y = h - m.bottom - pad - fontSize / 2;
        ctx.textAlign = "left";
        break;
      case "bottom-right":
        x = w - m.right - pad;
        y = h - m.bottom - pad - fontSize / 2;
        ctx.textAlign = "right";
        break;
    }
    ctx.translate(x, y);
    if (rotation !== 0)
      ctx.rotate(rotation * Math.PI / 180);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
};
export {
  AreaChart,
  BarChart,
  BaselineAreaChart,
  BoidsChart,
  BubbleChart,
  CandlestickChart,
  Chart,
  ChartManager,
  DEFAULT_FONT,
  DEFAULT_LABEL_SIZE,
  ErrorBandChart,
  HeatmapChart,
  HistogramChart,
  LineChart,
  OhlcChart,
  ScatterChart,
  StepChart,
  WaterfallChart,
  annotationsPlugin,
  chartMargin,
  chooseOriginX,
  computeStats,
  crosshairPlugin,
  hoverPlugin,
  labelsPanelPlugin,
  labelsPlugin,
  legendPlugin,
  minimapPlugin,
  normalizeUniform,
  packRGB,
  prepareWaterfall,
  rangeSelectorPlugin,
  rulerPlugin,
  sortOrder,
  statsPlugin,
  thresholdPlugin,
  toGpu,
  tooltipPinPlugin,
  watermarkPlugin,
  zoomPlugin
};
